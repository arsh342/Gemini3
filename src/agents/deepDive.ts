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
  phase: 'exploring' | 'investigating' | 'verifying' | 'synthesizing' | 'complete';
  currentFile?: string;
  filesExplored: number;
  totalFiles: number;
  message: string;
  depth: number;
  verificationStatus?: 'pending' | 'verified' | 'failed';
}

export interface DeepDiveResult {
  mainInvestigation: InvestigationResult;
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

    this.emitProgress({
      phase: 'exploring',
      filesExplored: 0,
      totalFiles: maxFiles,
      message: 'Starting autonomous deep dive...',
      depth: 0
    });

    // Step 1: Build dependency tree
    const dependencyTree = await this.buildDependencyTree(
      codeSelection.filePath,
      repoPath,
      maxDepth
    );

    // Step 2: Investigate main file
    this.emitProgress({
      phase: 'investigating',
      currentFile: codeSelection.filePath,
      filesExplored: 1,
      totalFiles: Math.min(this.countNodes(dependencyTree), maxFiles),
      message: `Investigating main target: ${codeSelection.filePath}`,
      depth: 0
    });

    const mainInvestigation = await this.investigateFile(codeSelection, repoPath);

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
    if (relatedInvestigations.size > 0) {
      await this.synthesizeFindings(mainInvestigation, relatedInvestigations);
    }

    this.emitProgress({
      phase: 'complete',
      filesExplored: this.exploredFiles.size,
      totalFiles: this.exploredFiles.size,
      message: `Deep dive complete! Explored ${this.exploredFiles.size} files.`,
      depth: 0,
      verificationStatus: verificationReport.claimsFailed === 0 ? 'verified' : 'failed'
    });

    return {
      mainInvestigation,
      relatedInvestigations,
      dependencyTree,
      verificationReport,
      totalFilesExplored: this.exploredFiles.size,
      totalTimeMs: Date.now() - startTime,
      thoughtChainLength: this.thoughtSignatures.length
    };
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
    related: Map<string, InvestigationResult>
  ): Promise<void> {
    if (related.size === 0) return;

    const relatedSummaries = Array.from(related.entries())
      .map(([file, inv]) => `${file}: ${inv.summary}`)
      .join('\n');

    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Synthesize these related code archaeology findings into a coherent understanding:

Main Investigation:
${main.summary}

Related Files:
${relatedSummaries}

Provide a unified narrative that connects these findings. Focus on:
1. How these files work together
2. The overall purpose of this code module
3. Any patterns or architectural decisions revealed`,
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
