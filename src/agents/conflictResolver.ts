/**
 * Conflict Resolver Agent
 * Automatically resolves git merge conflicts by analyzing code history and intent
 * Uses Gemini 3 to understand WHAT each side wanted and WHY
 */

import { GoogleGenAI } from '@google/genai';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export interface ConflictResolverConfig {
  geminiApiKey: string;
  autoApply?: boolean;  // Automatically apply resolutions
  onProgress?: (update: ConflictProgress) => void;
  onResolved?: (result: ConflictResolution) => void;
}

export interface ConflictProgress {
  phase: 'detecting' | 'analyzing' | 'resolving' | 'applying' | 'complete';
  file?: string;
  message: string;
  conflictsFound?: number;
  conflictsResolved?: number;
}

export interface MergeConflict {
  file: string;
  startLine: number;
  endLine: number;
  oursContent: string;   // HEAD / current branch
  theirsContent: string; // Incoming changes
  baseContent?: string;  // Common ancestor (if available)
  context: {
    before: string;      // Lines before conflict
    after: string;       // Lines after conflict
  };
}

export interface ConflictResolution {
  conflict: MergeConflict;
  resolution: string;
  strategy: 'ours' | 'theirs' | 'merge' | 'rewrite';
  reasoning: string;
  confidence: number;
  appliedAt?: Date;
}

export interface ResolverReport {
  totalConflicts: number;
  resolved: number;
  failed: number;
  resolutions: ConflictResolution[];
  timestamp: Date;
}

// Conflict marker regex patterns
const CONFLICT_START = /^<<<<<<<\s*(.*)$/;
const CONFLICT_MIDDLE = /^=======$/;
const CONFLICT_END = /^>>>>>>>\s*(.*)$/;

export class ConflictResolverAgent {
  private genai: GoogleGenAI;
  private git: SimpleGit;
  private config: ConflictResolverConfig;
  private repoPath: string;

  constructor(repoPath: string, config: ConflictResolverConfig) {
    this.repoPath = repoPath;
    this.config = config;
    this.genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    this.git = simpleGit(repoPath);
  }

  /**
   * Resolve all conflicts in the repository
   */
  async resolveAll(): Promise<ResolverReport> {
    const report: ResolverReport = {
      totalConflicts: 0,
      resolved: 0,
      failed: 0,
      resolutions: [],
      timestamp: new Date()
    };

    this.emitProgress({ phase: 'detecting', message: 'Scanning for merge conflicts...' });

    // Find all conflicted files
    const conflictedFiles = await this.findConflictedFiles();
    
    if (conflictedFiles.length === 0) {
      this.emitProgress({ 
        phase: 'complete', 
        message: 'No conflicts found!',
        conflictsFound: 0 
      });
      return report;
    }

    this.emitProgress({ 
      phase: 'detecting', 
      message: `Found ${conflictedFiles.length} files with conflicts`,
      conflictsFound: conflictedFiles.length
    });

    // Process each file
    for (const filePath of conflictedFiles) {
      const conflicts = await this.parseConflictsInFile(filePath);
      report.totalConflicts += conflicts.length;

      for (const conflict of conflicts) {
        try {
          this.emitProgress({
            phase: 'analyzing',
            file: filePath,
            message: `Analyzing conflict at line ${conflict.startLine}...`,
            conflictsFound: report.totalConflicts,
            conflictsResolved: report.resolved
          });

          // Get git history context for both sides
          const historyContext = await this.getHistoryContext(conflict);

          // Use Gemini to resolve the conflict
          const resolution = await this.resolveConflict(conflict, historyContext);
          report.resolutions.push(resolution);

          if (resolution.confidence >= 70 && this.config.autoApply) {
            this.emitProgress({
              phase: 'applying',
              file: filePath,
              message: `Applying resolution (${resolution.confidence}% confidence)...`
            });

            await this.applyResolution(filePath, conflict, resolution);
            resolution.appliedAt = new Date();
          }

          report.resolved++;
          this.config.onResolved?.(resolution);

        } catch (error) {
          console.error(`Failed to resolve conflict in ${filePath}:`, error);
          report.failed++;
        }
      }
    }

    this.emitProgress({
      phase: 'complete',
      message: `Resolved ${report.resolved}/${report.totalConflicts} conflicts`,
      conflictsFound: report.totalConflicts,
      conflictsResolved: report.resolved
    });

    return report;
  }

  /**
   * Resolve conflicts in a specific file
   */
  async resolveFile(filePath: string): Promise<ConflictResolution[]> {
    const conflicts = await this.parseConflictsInFile(filePath);
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const historyContext = await this.getHistoryContext(conflict);
      const resolution = await this.resolveConflict(conflict, historyContext);
      resolutions.push(resolution);

      if (this.config.autoApply && resolution.confidence >= 70) {
        await this.applyResolution(filePath, conflict, resolution);
        resolution.appliedAt = new Date();
      }
    }

    return resolutions;
  }

  /**
   * Find all files with merge conflicts
   */
  private async findConflictedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.conflicted;
    } catch {
      // Fallback: scan for conflict markers
      return this.scanForConflictMarkers();
    }
  }

  /**
   * Scan directory for files with conflict markers
   */
  private scanForConflictMarkers(): string[] {
    const conflicted: string[] = [];
    
    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scan(fullPath);
          }
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>')) {
              conflicted.push(path.relative(this.repoPath, fullPath));
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    scan(this.repoPath);
    return conflicted;
  }

  /**
   * Parse conflicts from a file
   */
  private async parseConflictsInFile(filePath: string): Promise<MergeConflict[]> {
    const fullPath = path.join(this.repoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const conflicts: MergeConflict[] = [];

    let inConflict = false;
    let conflictStart = 0;
    let oursLines: string[] = [];
    let theirsLines: string[] = [];
    let inOurs = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (CONFLICT_START.test(line)) {
        inConflict = true;
        inOurs = true;
        conflictStart = i + 1;
        oursLines = [];
        theirsLines = [];
      } else if (CONFLICT_MIDDLE.test(line) && inConflict) {
        inOurs = false;
      } else if (CONFLICT_END.test(line) && inConflict) {
        // Extract context (5 lines before/after)
        const contextBefore = lines.slice(Math.max(0, conflictStart - 6), conflictStart - 1).join('\n');
        const contextAfter = lines.slice(i + 1, i + 6).join('\n');

        conflicts.push({
          file: filePath,
          startLine: conflictStart,
          endLine: i + 1,
          oursContent: oursLines.join('\n'),
          theirsContent: theirsLines.join('\n'),
          context: {
            before: contextBefore,
            after: contextAfter
          }
        });

        inConflict = false;
      } else if (inConflict) {
        if (inOurs) {
          oursLines.push(line);
        } else {
          theirsLines.push(line);
        }
      }
    }

    return conflicts;
  }

  /**
   * Get git history context to understand intent of both sides
   */
  private async getHistoryContext(conflict: MergeConflict): Promise<string> {
    let context = '';

    try {
      // Get recent commits for this file on current branch
      const ourLog = await this.git.log({ file: conflict.file, maxCount: 3 });
      context += 'Recent changes on current branch:\n';
      for (const commit of ourLog.all) {
        context += `  - ${commit.hash.substring(0, 7)}: ${commit.message.split('\n')[0]}\n`;
      }

      // Try to get incoming branch info
      try {
        const mergeHead = await this.git.raw(['rev-parse', 'MERGE_HEAD']);
        if (mergeHead) {
          const theirLog = await this.git.log({ 
            from: 'HEAD', 
            to: mergeHead.trim(), 
            file: conflict.file,
            maxCount: 3 
          });
          context += '\nIncoming changes:\n';
          for (const commit of theirLog.all) {
            context += `  - ${commit.hash.substring(0, 7)}: ${commit.message.split('\n')[0]}\n`;
          }
        }
      } catch {
        // MERGE_HEAD might not exist
      }

      // Get file history context
      const blameOurs = conflict.oursContent.split('\n')[0];
      const blameTheirs = conflict.theirsContent.split('\n')[0];
      context += `\nFirst line of our changes: ${blameOurs}\n`;
      context += `First line of their changes: ${blameTheirs}\n`;

    } catch (error) {
      context = 'Unable to retrieve full git history context.';
    }

    return context;
  }

  /**
   * Use Gemini to resolve the conflict
   */
  private async resolveConflict(
    conflict: MergeConflict,
    historyContext: string
  ): Promise<ConflictResolution> {
    const prompt = `You are an expert at resolving git merge conflicts. Analyze this conflict and provide the best resolution.

## File: ${conflict.file} (lines ${conflict.startLine}-${conflict.endLine})

## Context Before Conflict:
\`\`\`
${conflict.context.before}
\`\`\`

## OUR VERSION (current branch / HEAD):
\`\`\`
${conflict.oursContent}
\`\`\`

## THEIR VERSION (incoming changes):
\`\`\`
${conflict.theirsContent}
\`\`\`

## Context After Conflict:
\`\`\`
${conflict.context.after}
\`\`\`

## Git History Context:
${historyContext}

## Your Task:
1. Analyze what EACH side was trying to accomplish
2. Determine if changes are:
   - Mutually exclusive (pick one)
   - Complementary (merge both)
   - Conflicting logic (needs rewrite)
3. Provide the RESOLVED code

Respond in this exact JSON format:
{
  "strategy": "ours" | "theirs" | "merge" | "rewrite",
  "resolution": "the actual resolved code here",
  "reasoning": "explanation of why this resolution is correct",
  "confidence": 0-100
}

IMPORTANT: The "resolution" must be ONLY the code that should replace the conflict markers. No markers, no explanation, just the code.`;

    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.2,
          thinkingConfig: {
            thinkingBudget: 8192
          }
        }
      });

      const text = response.text || '';
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          conflict,
          resolution: parsed.resolution,
          strategy: parsed.strategy,
          reasoning: parsed.reasoning,
          confidence: parsed.confidence
        };
      }
    } catch (error) {
      console.error('Gemini resolution failed:', error);
    }

    // Default fallback: keep ours
    return {
      conflict,
      resolution: conflict.oursContent,
      strategy: 'ours',
      reasoning: 'Failed to analyze, defaulting to current branch',
      confidence: 30
    };
  }

  /**
   * Apply a resolution to the file
   */
  private async applyResolution(
    filePath: string,
    conflict: MergeConflict,
    resolution: ConflictResolution
  ): Promise<void> {
    const fullPath = path.join(this.repoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Find and replace the conflict block
    const newLines: string[] = [];
    let skipUntilEnd = false;
    let conflictIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (CONFLICT_START.test(line)) {
        if (i + 1 === conflict.startLine) {
          // This is our target conflict
          skipUntilEnd = true;
          conflictIndex = conflict.startLine;
          // Add the resolution
          newLines.push(resolution.resolution);
        } else {
          newLines.push(line);
        }
      } else if (CONFLICT_END.test(line) && skipUntilEnd) {
        skipUntilEnd = false;
        // Skip the closing marker too
      } else if (!skipUntilEnd) {
        newLines.push(line);
      }
    }

    fs.writeFileSync(fullPath, newLines.join('\n'));
  }

  /**
   * Preview all resolutions without applying
   */
  async preview(): Promise<ResolverReport> {
    const originalAutoApply = this.config.autoApply;
    this.config.autoApply = false;
    
    const report = await this.resolveAll();
    
    this.config.autoApply = originalAutoApply;
    return report;
  }

  /**
   * Generate markdown report
   */
  generateReport(report: ResolverReport): string {
    let md = `# Conflict Resolution Report\n\n`;
    md += `**Date:** ${report.timestamp.toISOString()}\n`;
    md += `**Total Conflicts:** ${report.totalConflicts}\n`;
    md += `**Resolved:** ${report.resolved} ✅\n`;
    md += `**Failed:** ${report.failed} ❌\n\n`;

    md += `## Resolutions\n\n`;

    for (const res of report.resolutions) {
      const status = res.appliedAt ? '✅ Applied' : '⏸️ Pending';
      md += `### ${res.conflict.file}:${res.conflict.startLine}\n`;
      md += `**Strategy:** ${res.strategy} | **Confidence:** ${res.confidence}% | ${status}\n\n`;
      md += `**Reasoning:** ${res.reasoning}\n\n`;
      md += `**Resolution:**\n\`\`\`\n${res.resolution}\n\`\`\`\n\n`;
      md += `---\n\n`;
    }

    return md;
  }

  /**
   * Emit progress update
   */
  private emitProgress(update: ConflictProgress): void {
    this.config.onProgress?.(update);
  }
}

/**
 * CLI helper to resolve conflicts interactively
 */
export async function interactiveResolve(
  repoPath: string,
  geminiApiKey: string
): Promise<ResolverReport> {
  const resolver = new ConflictResolverAgent(repoPath, {
    geminiApiKey,
    autoApply: false,
    onProgress: (update) => {
      console.log(`[${update.phase.toUpperCase()}] ${update.message}`);
    }
  });

  // First, preview all resolutions
  const report = await resolver.preview();
  
  console.log('\n=== Resolution Preview ===\n');
  
  for (const res of report.resolutions) {
    console.log(`File: ${res.conflict.file}:${res.conflict.startLine}`);
    console.log(`Strategy: ${res.strategy} (${res.confidence}% confidence)`);
    console.log(`Reasoning: ${res.reasoning}`);
    console.log('---');
  }

  return report;
}
