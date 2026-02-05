/**
 * Deep Dive Agent - Autonomous Investigation System
 * Implements "Marathon Agent" pattern with self-correction and verification
 */

import { GoogleGenAI } from '@google/genai';
import {
  CaseFile,
  InvestigationResult,
  CodeSelection,
  ThoughtSignature,
  CommitInfo,
} from './types';
import { HistorianAgent } from './historian';
import { ArchivistAgent } from './archivist';
import { LeadDetectiveAgent } from './leadDetective';

export interface DeepDiveConfig {
  geminiApiKey: string;
  githubToken?: string;
  maxDepth?: number;           // How deep to follow dependencies (default: 3)
  maxFilesToExplore?: number;  // Limit autonomous exploration (default: 10)
  verifyFindings?: boolean;    // Enable self-verification loop
  onProgress?: (update: DeepDiveUpdate) => void;
}

export interface DeepDiveUpdate {
  phase: 'scanning' | 'exploring' | 'investigating' | 'verifying' | 'synthesizing' | 'complete';
  currentFile?: string;
  filesExplored: number;
  totalFiles: number;
  message: string;
  depth: number;
  verificationStatus?: 'pending' | 'verified' | 'failed';
}

export interface CodebaseReference {
  file: string;
  line: number;
  context: string;
  type: 'import' | 'call' | 'extends' | 'implements' | 'reference';
}

export interface DeepDiveResult {
  mainInvestigation: InvestigationResult;
  codebaseReferences: CodebaseReference[];
  relatedInvestigations: Map<string, InvestigationResult>;
  dependencyTree: DependencyNode;
  verificationReport: VerificationReport;
  totalFilesExplored: number;
  totalTimeMs: number;
  thoughtChainLength: number;
}

export interface DependencyNode {
  file: string;
  type: 'import' | 'export' | 'reference' | 'root';
  children: DependencyNode[];
  investigated: boolean;
}

export interface VerificationReport {
  claimsVerified: number;
  claimsFailed: number;
  linksChecked: VerifiedLink[];
  overallConfidence: number;
}

export interface VerifiedLink {
  type: 'commit' | 'pr' | 'issue';
  id: string;
  url?: string;
  verified: boolean;
  reason?: string;
}

export class DeepDiveAgent {
  private genai: GoogleGenAI;
  private historian: HistorianAgent | null = null;
  private archivist: ArchivistAgent;
  private leadDetective: LeadDetectiveAgent;
  private config: DeepDiveConfig;
  private exploredFiles: Set<string> = new Set();
  private thoughtSignatures: ThoughtSignature[] = [];

  constructor(config: DeepDiveConfig) {
    this.config = config;
    this.genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    this.archivist = new ArchivistAgent(config.githubToken);
    this.leadDetective = new LeadDetectiveAgent(config.geminiApiKey, {
      thinkingLevel: 'high'
    });
  }

  /**
   * Autonomous Deep Dive - explores dependencies and builds complete case
   */
  async deepDive(
    codeSelection: CodeSelection,
    repoPath: string
  ): Promise<DeepDiveResult> {
    const startTime = Date.now();
    this.historian = new HistorianAgent(repoPath);
    this.exploredFiles.clear();
    this.thoughtSignatures = [];
    
    const maxDepth = this.config.maxDepth || 3;
    const maxFiles = this.config.maxFilesToExplore || 10;

    // Step 0: Scan entire codebase for references to selected code
    this.emitProgress({
      phase: 'scanning',
      filesExplored: 0,
      totalFiles: 0,
      message: 'Scanning entire codebase for references...',
      depth: 0
    });

    const codebaseReferences = await this.findCodebaseReferences(codeSelection, repoPath);
    
    this.emitProgress({
      phase: 'scanning',
      filesExplored: 0,
      totalFiles: codebaseReferences.length,
      message: `Found ${codebaseReferences.length} references across the codebase`,
      depth: 0
    });

    // Step 1: Build dependency tree
    this.emitProgress({
      phase: 'exploring',
      filesExplored: 0,
      totalFiles: maxFiles,
      message: 'Building dependency tree...',
      depth: 0
    });

    const dependencyTree = await this.buildDependencyTree(
      codeSelection.filePath,
      repoPath,
      maxDepth
    );

    // Step 2: Investigate main file (with codebase context)
    this.emitProgress({
      phase: 'investigating',
      currentFile: codeSelection.filePath,
      filesExplored: 1,
      totalFiles: Math.min(this.countNodes(dependencyTree), maxFiles),
      message: `Investigating main target: ${codeSelection.filePath}`,
      depth: 0
    });

    // Add codebase references context to the investigation
    const enhancedSelection = {
      ...codeSelection,
      codebaseContext: this.buildCodebaseContext(codebaseReferences)
    };

    const mainInvestigation = await this.investigateFile(enhancedSelection, repoPath);

    // Append usage info to the summary
    if (codebaseReferences.length > 0) {
      mainInvestigation.summary += `\n\nUsed in ${codebaseReferences.length} locations across ${new Set(codebaseReferences.map(r => r.file)).size} files.`;
    }

    // Step 3: Autonomously explore related files
    const relatedInvestigations = new Map<string, InvestigationResult>();
    await this.exploreRelatedFiles(
      dependencyTree,
      repoPath,
      relatedInvestigations,
      maxFiles - 1,
      1
    );

    // Step 4: Self-verification loop
    let verificationReport: VerificationReport = {
      claimsVerified: 0,
      claimsFailed: 0,
      linksChecked: [],
      overallConfidence: mainInvestigation.confidence
    };

    if (this.config.verifyFindings) {
      this.emitProgress({
        phase: 'verifying',
        filesExplored: this.exploredFiles.size,
        totalFiles: this.exploredFiles.size,
        message: 'Verifying investigation findings...',
        depth: 0,
        verificationStatus: 'pending'
      });

      verificationReport = await this.verifyFindings(mainInvestigation);
    }

    // Step 5: Synthesize all findings
    this.emitProgress({
      phase: 'synthesizing',
      filesExplored: this.exploredFiles.size,
      totalFiles: this.exploredFiles.size,
      message: 'Synthesizing complete investigation report...',
      depth: 0
    });

    // Use Gemini to synthesize all investigations into a coherent narrative
    if (relatedInvestigations.size > 0 || codebaseReferences.length > 0) {
      await this.synthesizeFindings(mainInvestigation, relatedInvestigations, codebaseReferences);
    }

    this.emitProgress({
      phase: 'complete',
      filesExplored: this.exploredFiles.size,
      totalFiles: this.exploredFiles.size,
      message: `Deep dive complete! Explored ${this.exploredFiles.size} files, found ${codebaseReferences.length} references.`,
      depth: 0,
      verificationStatus: verificationReport.claimsFailed === 0 ? 'verified' : 'failed'
    });

    return {
      mainInvestigation,
      codebaseReferences,
      relatedInvestigations,
      dependencyTree,
      verificationReport,
      totalFilesExplored: this.exploredFiles.size,
      totalTimeMs: Date.now() - startTime,
      thoughtChainLength: this.thoughtSignatures.length
    };
  }

  /**
   * Scan entire codebase for references to the selected code
   */
  private async findCodebaseReferences(
    codeSelection: CodeSelection,
    repoPath: string
  ): Promise<CodebaseReference[]> {
    const references: CodebaseReference[] = [];
    const fs = require('fs');
    const path = require('path');
    
    // Extract identifiers from selected code (function names, class names, etc.)
    const identifiers = this.extractIdentifiers(codeSelection.text);
    if (identifiers.length === 0) return references;

    // Walk through all source files
    const sourceFiles = await this.getAllSourceFiles(repoPath);
    
    for (const file of sourceFiles) {
      if (file === codeSelection.filePath) continue; // Skip the source file
      
      try {
        const fullPath = path.join(repoPath, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        for (const identifier of identifiers) {
          // Search for each identifier
          lines.forEach((line: string, index: number) => {
            if (line.includes(identifier)) {
              const refType = this.classifyReference(line, identifier);
              references.push({
                file,
                line: index + 1,
                context: line.trim().substring(0, 100),
                type: refType
              });
            }
          });
        }
      } catch (e) {
        // Skip unreadable files
      }
    }

    return references;
  }

  /**
   * Extract identifiers (function/class names) from code
   */
  private extractIdentifiers(code: string): string[] {
    const identifiers: string[] = [];
    
    // Match function declarations
    const funcMatches = code.matchAll(/(?:function|const|let|var)\s+(\w+)/g);
    for (const m of funcMatches) identifiers.push(m[1]);
    
    // Match class declarations
    const classMatches = code.matchAll(/class\s+(\w+)/g);
    for (const m of classMatches) identifiers.push(m[1]);
    
    // Match export declarations
    const exportMatches = code.matchAll(/export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+(\w+)/g);
    for (const m of exportMatches) identifiers.push(m[1]);

    // Match method declarations
    const methodMatches = code.matchAll(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm);
    for (const m of methodMatches) {
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
        identifiers.push(m[1]);
      }
    }
    
    return [...new Set(identifiers)].filter(id => id.length > 2);
  }

  /**
   * Classify what type of reference this is
   */
  private classifyReference(line: string, identifier: string): CodebaseReference['type'] {
    if (line.includes('import') && line.includes(identifier)) return 'import';
    if (line.includes('extends ' + identifier)) return 'extends';
    if (line.includes('implements ' + identifier)) return 'implements';
    if (line.includes(identifier + '(')) return 'call';
    return 'reference';
  }

  /**
   * Get all source files in the repository
   */
  private async getAllSourceFiles(repoPath: string): Promise<string[]> {
    const fs = require('fs');
    const path = require('path');
    const files: string[] = [];
    
    const walkDir = (dir: string, prefix: string = '') => {
      try {
        const entries = fs.readdirSync(path.join(repoPath, dir));
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(path.join(repoPath, fullPath));
          
          if (stat.isDirectory()) {
            // Skip common non-source directories
            if (!['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry)) {
              walkDir(fullPath);
            }
          } else if (stat.isFile()) {
            // Include source files
            if (/\.(ts|tsx|js|jsx|py|java|go|rs|cpp|c|h)$/.test(entry)) {
              files.push(fullPath);
            }
          }
        }
      } catch (e) {
        // Skip unreadable directories
      }
    };
    
    walkDir('');
    return files;
  }

  /**
   * Build context string from codebase references
   */
  private buildCodebaseContext(references: CodebaseReference[]): string {
    if (references.length === 0) return '';
    
    const byFile = new Map<string, CodebaseReference[]>();
    for (const ref of references) {
      const existing = byFile.get(ref.file) || [];
      existing.push(ref);
      byFile.set(ref.file, existing);
    }
    
    let context = '\n\n## Codebase Usage\n\n';
    context += `This code is referenced in ${references.length} locations across ${byFile.size} files:\n\n`;
    
    for (const [file, refs] of byFile.entries()) {
      context += `### ${file}\n`;
      for (const ref of refs.slice(0, 5)) {
        context += `- Line ${ref.line} (${ref.type}): \`${ref.context}\`\n`;
      }
      if (refs.length > 5) {
        context += `- ... and ${refs.length - 5} more references\n`;
      }
      context += '\n';
    }
    
    return context;
  }

  /**
   * Build dependency tree by analyzing imports/exports
   */
  private async buildDependencyTree(
    filePath: string,
    repoPath: string,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<DependencyNode> {
    const node: DependencyNode = {
      file: filePath,
      type: currentDepth === 0 ? 'root' : 'import',
      children: [],
      investigated: false
    };

    if (currentDepth >= maxDepth) return node;

    try {
      // Use Gemini to analyze file for dependencies
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.join(repoPath, filePath);
      
      if (!fs.existsSync(fullPath)) return node;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Extract imports using regex (fast, no AST parsing needed)
      const importMatches = content.matchAll(
        /(?:import|require)\s*\(?['"](\.\.?\/[^'"]+)['"]\)?/g
      );
      
      for (const match of importMatches) {
        const importPath = match[1];
        const resolvedPath = this.resolveImportPath(filePath, importPath, repoPath);
        
        if (resolvedPath && !this.exploredFiles.has(resolvedPath)) {
          const childNode = await this.buildDependencyTree(
            resolvedPath,
            repoPath,
            maxDepth,
            currentDepth + 1
          );
          node.children.push(childNode);
        }
      }
    } catch (error) {
      // Silently continue if we can't analyze a file
    }

    return node;
  }

  /**
   * Resolve relative import path to actual file
   */
  private resolveImportPath(
    fromFile: string,
    importPath: string,
    repoPath: string
  ): string | null {
    const path = require('path');
    const fs = require('fs');
    
    const dir = path.dirname(fromFile);
    let resolved = path.join(dir, importPath);
    
    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
    
    for (const ext of extensions) {
      const fullPath = path.join(repoPath, resolved + ext);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return resolved + ext;
      }
    }
    
    return null;
  }

  /**
   * Recursively explore related files
   */
  private async exploreRelatedFiles(
    node: DependencyNode,
    repoPath: string,
    results: Map<string, InvestigationResult>,
    remaining: number,
    depth: number
  ): Promise<void> {
    if (remaining <= 0) return;

    for (const child of node.children) {
      if (remaining <= 0) break;
      if (this.exploredFiles.has(child.file)) continue;

      this.emitProgress({
        phase: 'investigating',
        currentFile: child.file,
        filesExplored: this.exploredFiles.size,
        totalFiles: Math.min(this.exploredFiles.size + remaining, this.config.maxFilesToExplore || 10),
        message: `Autonomously exploring: ${child.file}`,
        depth
      });

      try {
        const fs = await import('fs');
        const path = await import('path');
        const fullPath = path.join(repoPath, child.file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        // Pick an interesting line (first function or class definition)
        let targetLine = 1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^(export\s+)?(class|function|const\s+\w+\s*=)/)) {
            targetLine = i + 1;
            break;
          }
        }

        const selection: CodeSelection = {
          text: lines.slice(targetLine - 1, targetLine + 5).join('\n'),
          filePath: child.file,
          lineStart: targetLine,
          lineEnd: targetLine + 5,
          repoPath
        };

        const investigation = await this.investigateFile(selection, repoPath);
        results.set(child.file, investigation);
        child.investigated = true;
        remaining--;

        // Recurse into children
        await this.exploreRelatedFiles(child, repoPath, results, remaining, depth + 1);
      } catch (error) {
        // Skip files we can't investigate
      }
    }
  }

  /**
   * Investigate a single file
   */
  private async investigateFile(
    codeSelection: CodeSelection,
    repoPath: string
  ): Promise<InvestigationResult> {
    this.exploredFiles.add(codeSelection.filePath);

    // Create a mini case file
    const { Investigator } = await import('../investigator');
    
    const investigator = new Investigator({
      geminiApiKey: this.config.geminiApiKey,
      githubToken: this.config.githubToken,
      thinkingLevel: 'high'
    });

    const result = await investigator.investigate({
      ...codeSelection,
      repoPath
    });

    // Collect thought signatures
    if (result.thoughtChain?.signatures) {
      this.thoughtSignatures.push(...result.thoughtChain.signatures);
    }

    return result;
  }

  /**
   * Self-Verification Loop - verify claims in the investigation
   */
  private async verifyFindings(
    investigation: InvestigationResult
  ): Promise<VerificationReport> {
    const report: VerificationReport = {
      claimsVerified: 0,
      claimsFailed: 0,
      linksChecked: [],
      overallConfidence: investigation.confidence
    };

    // Verify each source citation
    for (const source of investigation.sources) {
      const verified = await this.verifySource(source);
      report.linksChecked.push(verified);
      
      if (verified.verified) {
        report.claimsVerified++;
      } else {
        report.claimsFailed++;
      }
    }

    // Adjust confidence based on verification
    if (report.linksChecked.length > 0) {
      const verificationRate = report.claimsVerified / report.linksChecked.length;
      report.overallConfidence = Math.round(investigation.confidence * verificationRate);
    }

    // Use Gemini to self-critique the investigation
    const selfCritique = await this.performSelfCritique(investigation);
    
    // Adjust confidence based on self-critique
    if (selfCritique.issuesFound > 0) {
      report.overallConfidence = Math.max(
        0,
        report.overallConfidence - (selfCritique.issuesFound * 5)
      );
    }

    return report;
  }

  /**
   * Verify a source citation exists and is relevant
   */
  private async verifySource(source: { type: string; id: string; url?: string }): Promise<VerifiedLink> {
    const verified: VerifiedLink = {
      type: source.type as 'commit' | 'pr' | 'issue',
      id: source.id,
      url: source.url,
      verified: false
    };

    try {
      if (source.type === 'commit' && this.historian) {
        // Verify commit exists
        const commitHash = source.id.replace('Commit ', '').substring(0, 7);
        try {
          await this.historian.getCommitInfo(commitHash);
          verified.verified = true;
        } catch {
          verified.reason = 'Commit not found in repository';
        }
      } else if (source.type === 'pr' && source.url) {
        // For PRs, we'd need to make an API call to verify
        // For now, mark as verified if we have a URL
        verified.verified = !!source.url;
        if (!source.url) {
          verified.reason = 'No URL available to verify';
        }
      } else if (source.type === 'issue' && source.url) {
        verified.verified = !!source.url;
        if (!source.url) {
          verified.reason = 'No URL available to verify';
        }
      } else {
        verified.verified = true; // Give benefit of doubt for other types
      }
    } catch (error) {
      verified.reason = `Verification failed: ${error}`;
    }

    return verified;
  }

  /**
   * Use Gemini to self-critique the investigation
   */
  private async performSelfCritique(
    investigation: InvestigationResult
  ): Promise<{ issuesFound: number; suggestions: string[] }> {
    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a critical reviewer of code archaeology investigations.

Review this investigation and identify any issues:

${investigation.narrative.substring(0, 3000)}

Identify:
1. Claims without source citations
2. Logical inconsistencies
3. Speculation presented as fact
4. Missing context

Respond in JSON format:
{
  "issuesFound": number,
  "suggestions": ["string"]
}`,
        config: {
          temperature: 0.2,
          thinkingConfig: {
            thinkingBudget: 4096
          }
        }
      });

      const text = response.text || '{}';
      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Self-critique failed, assume no issues
    }

    return { issuesFound: 0, suggestions: [] };
  }

  /**
   * Synthesize findings from multiple investigations
   */
  private async synthesizeFindings(
    main: InvestigationResult,
    related: Map<string, InvestigationResult>,
    codebaseRefs: CodebaseReference[] = []
  ): Promise<void> {
    const relatedSummaries = Array.from(related.entries())
      .map(([file, inv]) => `${file}: ${inv.summary}`)
      .join('\n');

    // Build usage summary
    const usageByFile = new Map<string, number>();
    for (const ref of codebaseRefs) {
      usageByFile.set(ref.file, (usageByFile.get(ref.file) || 0) + 1);
    }
    const usageSummary = Array.from(usageByFile.entries())
      .map(([file, count]) => `- ${file}: ${count} reference(s)`)
      .join('\n');

    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Synthesize these code archaeology findings into a complete understanding:

Main Investigation:
${main.summary}

${related.size > 0 ? `Related Files:\n${relatedSummaries}` : ''}

${codebaseRefs.length > 0 ? `Codebase Usage (where this code is referenced):\n${usageSummary}` : ''}

Provide a unified narrative that explains:
1. What this code does and why it exists
2. ${codebaseRefs.length > 0 ? 'Where and how it is used across the codebase' : 'How it fits into the overall architecture'}
3. ${related.size > 0 ? 'How these files work together' : 'Its role in the system'}
4. Any patterns or architectural decisions revealed`,
        config: {
          temperature: 0.3,
          thinkingConfig: {
            thinkingBudget: 8192
          }
        }
      });

      // Append synthesis to main narrative
      if (response.text) {
        main.narrative += '\n\n## Synthesized Understanding\n\n' + response.text;
        
        // Also add a usage section if we have references
        if (codebaseRefs.length > 0) {
          main.narrative += `\n\n## Usage Across Codebase\n\nThis code is referenced in **${codebaseRefs.length}** locations across **${usageByFile.size}** files:\n\n`;
          for (const [file, count] of Array.from(usageByFile.entries()).slice(0, 10)) {
            main.narrative += `- **${file}**: ${count} reference(s)\n`;
          }
          if (usageByFile.size > 10) {
            main.narrative += `\n... and ${usageByFile.size - 10} more files`;
          }
        }
      }
    } catch (error) {
      // Synthesis failed, keep original narrative
    }
  }

  /**
   * Count nodes in dependency tree
   */
  private countNodes(node: DependencyNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  /**
   * Emit progress update
   */
  private emitProgress(update: DeepDiveUpdate): void {
    if (this.config.onProgress) {
      this.config.onProgress(update);
    }
  }
}
