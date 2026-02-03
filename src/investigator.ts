/**
 * The Repo Archaeologist - Investigation Orchestrator
 * Coordinates multi-agent investigation workflow
 */

import { randomUUID } from 'crypto';
import {
  LeadDetectiveAgent,
  HistorianAgent,
  ArchivistAgent,
  CaseFile,
  CodeSelection,
  Evidence,
  InvestigationResult,
  StreamUpdate,
  StreamCallback,
  MarkdownExport,
  ADRExport,
} from './agents';

export interface InvestigatorConfig {
  geminiApiKey: string;
  githubToken?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  onUpdate?: StreamCallback;
}

export class Investigator {
  private leadDetective: LeadDetectiveAgent;
  private historian: HistorianAgent | null = null;
  private archivist: ArchivistAgent;
  private onUpdate: StreamCallback | null;
  private currentCaseFile: CaseFile | null = null;

  constructor(config: InvestigatorConfig) {
    this.leadDetective = new LeadDetectiveAgent(config.geminiApiKey, {
      thinkingLevel: config.thinkingLevel || 'high'
    });
    this.archivist = new ArchivistAgent(config.githubToken);
    this.onUpdate = config.onUpdate || null;
  }

  /**
   * Main investigation entry point
   */
  async investigate(codeSelection: CodeSelection): Promise<InvestigationResult> {
    // Initialize historian with repo path
    this.historian = new HistorianAgent(codeSelection.repoPath);

    // Reset lead detective's thought chain for new investigation
    this.leadDetective.resetThoughtChain();

    // Initialize case file
    this.currentCaseFile = {
      id: randomUUID(),
      codeSelection,
      evidence: [],
      thoughtChain: { signatures: [], totalSteps: 0 },
      status: 'investigating',
      startedAt: new Date(),
      completedAt: null,
      confidence: 0
    };

    try {
      this.emitUpdate('initializing', 'Starting investigation...', 0);

      // Step 1: Git Blame
      await this.gatherBlameData(codeSelection);

      // Step 2: Commit Info
      await this.gatherCommitInfo();

      // Step 3: PR Search
      await this.gatherPRData(codeSelection);

      // Step 4: Issue Data
      await this.gatherIssueData();

      // Step 5: File History (for context)
      await this.gatherFileHistory(codeSelection);

      // Step 6: Synthesize with Lead Detective
      this.emitUpdate('synthesizing', 'Lead Detective analyzing evidence...', 80, 'HIGH');
      
      const result = await this.leadDetective.investigate(this.currentCaseFile);

      this.currentCaseFile.status = 'completed';
      this.currentCaseFile.completedAt = new Date();
      this.currentCaseFile.confidence = result.confidence;
      this.currentCaseFile.thoughtChain = result.thoughtChain;

      this.emitUpdate('completed', 'Investigation complete!', 100, 'HIGH', result);

      return result;
    } catch (error) {
      this.currentCaseFile.status = 'failed';
      this.emitUpdate('failed', `Investigation failed: ${error}`, 0);
      throw error;
    }
  }

  /**
   * Gather git blame data for the selected lines
   */
  private async gatherBlameData(codeSelection: CodeSelection): Promise<void> {
    if (!this.historian || !this.currentCaseFile) return;

    this.emitUpdate('analyzing_blame', 'Analyzing git blame...', 10);

    try {
      // Get blame for the middle line of selection
      const targetLine = Math.floor((codeSelection.lineStart + codeSelection.lineEnd) / 2);
      const blameResponse = await this.historian.getBlame(codeSelection.filePath, targetLine);

      this.currentCaseFile.evidence.push({
        type: 'blame',
        data: blameResponse.data,
        timestamp: new Date(),
        source: 'git blame'
      });

      if (blameResponse.thoughtSignature) {
        this.currentCaseFile.thoughtChain.signatures.push(blameResponse.thoughtSignature);
      }
    } catch (error) {
      console.warn('Git blame failed:', error);
      // Continue investigation without blame data
    }
  }

  /**
   * Gather commit information from blame data
   */
  private async gatherCommitInfo(): Promise<void> {
    if (!this.historian || !this.currentCaseFile) return;

    this.emitUpdate('fetching_commits', 'Retrieving commit details...', 25);

    const blameEvidence = this.currentCaseFile.evidence.find(e => e.type === 'blame');
    if (!blameEvidence) return;

    try {
      const blame = blameEvidence.data as any;
      const commitResponse = await this.historian.getCommitInfo(blame.commitHash);

      this.currentCaseFile.evidence.push({
        type: 'commit',
        data: commitResponse.data,
        timestamp: new Date(),
        source: 'git log'
      });

      if (commitResponse.thoughtSignature) {
        this.currentCaseFile.thoughtChain.signatures.push(commitResponse.thoughtSignature);
      }
    } catch (error) {
      console.warn('Commit info failed:', error);
    }
  }

  /**
   * Search for related PR
   */
  private async gatherPRData(codeSelection: CodeSelection): Promise<void> {
    if (!this.currentCaseFile) return;

    const blameEvidence = this.currentCaseFile.evidence.find(e => e.type === 'blame');
    if (!blameEvidence) return;

    // Need repo owner/name for GitHub API
    let owner = codeSelection.repoOwner;
    let repo = codeSelection.repoName;

    if (!owner || !repo) {
      // Try to get from git remote
      const remoteInfo = await this.historian?.getRemoteInfo();
      if (remoteInfo) {
        owner = remoteInfo.owner;
        repo = remoteInfo.repo;
      }
    }

    if (!owner || !repo) {
      console.warn('Could not determine GitHub repo info, skipping PR lookup');
      return;
    }

    this.emitUpdate('searching_prs', `Searching for PRs in ${owner}/${repo}...`, 45);

    try {
      const blame = blameEvidence.data as any;
      const prResponse = await this.archivist.findPRByCommit(owner, repo, blame.commitHash);

      if (prResponse.data) {
        this.currentCaseFile.evidence.push({
          type: 'pr',
          data: prResponse.data,
          timestamp: new Date(),
          source: 'GitHub API'
        });
      }

      if (prResponse.thoughtSignature) {
        this.currentCaseFile.thoughtChain.signatures.push(prResponse.thoughtSignature);
      }
    } catch (error) {
      console.warn('PR lookup failed:', error);
    }
  }

  /**
   * Gather linked issue data from PR
   */
  private async gatherIssueData(): Promise<void> {
    if (!this.currentCaseFile) return;

    const prEvidence = this.currentCaseFile.evidence.find(e => e.type === 'pr');
    if (!prEvidence) return;

    const pr = prEvidence.data as any;
    if (!pr.linkedIssues || pr.linkedIssues.length === 0) return;

    this.emitUpdate('reading_issues', `Found ${pr.linkedIssues.length} linked issues...`, 60);

    // Get repo info from PR URL
    const urlMatch = pr.url?.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) return;

    const [, owner, repo] = urlMatch;

    try {
      for (const issueNum of pr.linkedIssues.slice(0, 5)) { // Limit to 5 issues
        const issueResponse = await this.archivist.getIssue(owner, repo, issueNum);
        
        if (issueResponse.data) {
          this.currentCaseFile.evidence.push({
            type: 'issue',
            data: issueResponse.data,
            timestamp: new Date(),
            source: 'GitHub API'
          });
        }
      }
    } catch (error) {
      console.warn('Issue lookup failed:', error);
    }
  }

  /**
   * Gather file history for additional context
   */
  private async gatherFileHistory(codeSelection: CodeSelection): Promise<void> {
    if (!this.historian || !this.currentCaseFile) return;

    this.emitUpdate('fetching_commits', 'Loading file history...', 70);

    try {
      const historyResponse = await this.historian.getFileHistory(
        codeSelection.filePath,
        25 // Last 25 commits
      );

      this.currentCaseFile.evidence.push({
        type: 'file_history',
        data: historyResponse.data,
        timestamp: new Date(),
        source: 'git log --follow'
      });
    } catch (error) {
      console.warn('File history failed:', error);
    }
  }

  /**
   * Emit update to stream callback
   */
  private emitUpdate(
    phase: StreamUpdate['phase'],
    message: string,
    progress: number,
    thinkingBadge?: 'LOW' | 'MEDIUM' | 'HIGH',
    partialResult?: Partial<InvestigationResult>
  ): void {
    if (this.onUpdate) {
      this.onUpdate({
        phase,
        message,
        progress,
        thinkingBadge,
        partialResult
      });
    }
  }

  /**
   * Get current case file (for debugging)
   */
  getCaseFile(): CaseFile | null {
    return this.currentCaseFile;
  }

  /**
   * Generate Markdown export from investigation result
   */
  generateMarkdownExport(result: InvestigationResult): MarkdownExport {
    const content = `# Code Archaeology Investigation Report

**Generated:** ${new Date().toISOString()}
**Confidence:** ${result.confidence}%

## Summary

${result.summary}

## Investigation Narrative

${result.narrative}

## Timeline

| Date | Event | Author | Source |
|------|-------|--------|--------|
${result.timeline.map(e => 
  `| ${e.date.toISOString().split('T')[0]} | ${e.title.substring(0, 40)} | ${e.author} | ${e.sourceUrl ? `[${e.sourceId}](${e.sourceUrl})` : e.sourceId} |`
).join('\n')}

## Sources

${result.sources.map(s => 
  `- **${s.type.toUpperCase()}** ${s.url ? `[${s.id}](${s.url})` : s.id}: ${s.description}`
).join('\n')}

## Recommendations

${result.recommendations.map(r => 
  `- **${r.action.toUpperCase()}** (${r.priority} priority): ${r.reason}`
).join('\n')}

---

*Generated by The Repo Archaeologist*
`;

    return {
      content,
      filename: `investigation-${Date.now()}.md`
    };
  }

  /**
   * Generate ADR (Architecture Decision Record) export
   */
  generateADRExport(result: InvestigationResult, title: string): ADRExport {
    const keepRec = result.recommendations.find(r => r.action === 'keep');
    const status = keepRec ? 'accepted' : 'proposed';

    return {
      title,
      status,
      context: result.summary,
      decision: result.narrative.substring(0, 1000),
      consequences: result.recommendations.map(r => 
        `- ${r.action}: ${r.reason}`
      ).join('\n')
    };
  }
}

export default Investigator;
