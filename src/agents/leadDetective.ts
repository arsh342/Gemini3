/**
 * Lead Detective Agent - Investigation Orchestrator
 * Uses Gemini 3 Pro with thinking_level="HIGH" for deep reasoning
 * Synthesizes evidence into narrative explanations
 */

import { GoogleGenAI } from '@google/genai';
import {
  CaseFile,
  InvestigationResult,
  ThoughtSignature,
  ThoughtChain,
  Source,
  Recommendation,
  TimelineEvent,
  BlameData,
  CommitInfo,
  PRData,
  IssueData,
} from './types';

// System prompt for the Lead Detective
const LEAD_DETECTIVE_SYSTEM_PROMPT = `You are the Lead Detective in a code archaeology investigation.

Your role is to analyze evidence from sub-agents (git blame, PR data, issues) and reason about WHY code exists, not just WHEN it was written.

Your responsibilities:
1. Analyze all provided evidence thoroughly
2. Connect dots across years of development history
3. Distinguish facts from inferences
4. Assign confidence scores with clear reasoning
5. Cite ALL sources (commit SHAs, PR numbers, issue IDs)
6. Provide actionable recommendations

When analyzing code, ask yourself:
- What problem was this code solving?
- What was the context at that time?
- Why was THIS approach chosen over alternatives?
- What alternatives were considered?
- Is this code still relevant today?

Format your response as a structured investigation report with:
- A concise summary (2-3 sentences)
- Detailed narrative (2-3 paragraphs explaining the WHY)
- Confidence score (0-100) with justification
- List of sources cited
- Recommendations (keep/refactor/document/remove)
- Any related code that warrants further investigation`;

export class LeadDetectiveAgent {
  private genai: GoogleGenAI;
  private model: string;
  private thinkingLevel: 'low' | 'medium' | 'high';
  private stepCounter: number = 0;
  private thoughtChain: ThoughtChain = { signatures: [], totalSteps: 0 };

  constructor(
    apiKey: string,
    options?: {
      model?: string;
      thinkingLevel?: 'low' | 'medium' | 'high';
    }
  ) {
    this.genai = new GoogleGenAI({ apiKey });
    this.model = options?.model || 'gemini-2.5-pro-preview-05-06';
    this.thinkingLevel = options?.thinkingLevel || 'high';
  }

  /**
   * Main investigation method - synthesizes all evidence into a narrative
   */
  async investigate(caseFile: CaseFile): Promise<InvestigationResult> {
    const prompt = this.buildInvestigationPrompt(caseFile);
    
    try {
      const response = await this.genai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: this.getThinkingBudget()
          },
          temperature: 0.3, // Lower for factual investigation
        }
      });

      // Extract thought signature if available
      const thoughtSignature = this.extractThoughtSignature(response);
      if (thoughtSignature) {
        this.thoughtChain.signatures.push(thoughtSignature);
        this.thoughtChain.totalSteps++;
      }

      const text = response.text || '';
      return this.parseInvestigationResponse(text, caseFile);
    } catch (error) {
      console.error('Lead Detective investigation failed:', error);
      throw new Error(`Investigation failed: ${error}`);
    }
  }

  /**
   * Quick analysis for a single piece of evidence
   */
  async analyzeEvidence(
    evidence: BlameData | CommitInfo | PRData,
    context: string
  ): Promise<string> {
    const prompt = `Analyze this evidence in the context of code archaeology:

Context: ${context}

Evidence:
${JSON.stringify(evidence, null, 2)}

Provide a brief analysis (2-3 sentences) of what this evidence tells us about WHY the code exists.`;

    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 1024 // Lower budget for quick analysis
        },
        temperature: 0.3,
      }
    });

    return response.text || '';
  }

  /**
   * Build the investigation prompt with all evidence
   */
  private buildInvestigationPrompt(caseFile: CaseFile): string {
    const { codeSelection, evidence } = caseFile;

    let prompt = `${LEAD_DETECTIVE_SYSTEM_PROMPT}

## The Code Under Investigation

File: ${codeSelection.filePath}
Lines: ${codeSelection.lineStart}-${codeSelection.lineEnd}

\`\`\`
${codeSelection.text}
\`\`\`

## Evidence Collected

`;

    // Add blame data
    const blameEvidence = evidence.find(e => e.type === 'blame');
    if (blameEvidence) {
      const blame = blameEvidence.data as BlameData;
      prompt += `### Git Blame
- Commit: ${blame.commitHash}
- Author: ${blame.author} <${blame.authorEmail}>
- Date: ${blame.timestamp.toISOString()}
- Line Content: ${blame.lineContent}

`;
    }

    // Add commit info
    const commitEvidence = evidence.find(e => e.type === 'commit');
    if (commitEvidence) {
      const commit = commitEvidence.data as CommitInfo;
      prompt += `### Commit Details
- Hash: ${commit.hash}
- Author: ${commit.author}
- Date: ${commit.date.toISOString()}
- Message:
${commit.message}

- Changed Files: ${commit.changedFiles.join(', ')}

- Diff (relevant portion):
\`\`\`diff
${commit.diff.substring(0, 3000)}${commit.diff.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

`;
    }

    // Add PR data
    const prEvidence = evidence.find(e => e.type === 'pr');
    if (prEvidence) {
      const pr = prEvidence.data as PRData;
      prompt += `### Pull Request #${pr.number}
- Title: ${pr.title}
- Author: ${pr.author}
- State: ${pr.state}
- Created: ${pr.createdAt.toISOString()}
- URL: ${pr.url}

#### Description:
${pr.body || '(No description provided)'}

#### Discussion (${pr.comments.length} comments):
${pr.comments.slice(0, 10).map(c => 
  `- **${c.author}** (${c.createdAt.toISOString()}): ${c.body.substring(0, 500)}${c.body.length > 500 ? '...' : ''}`
).join('\n')}

#### Reviews:
${pr.reviews.map(r => 
  `- **${r.author}**: ${r.state} - ${r.body.substring(0, 300)}${r.body.length > 300 ? '...' : ''}`
).join('\n')}

`;
    }

    // Add issue data
    const issueEvidence = evidence.filter(e => e.type === 'issue');
    if (issueEvidence.length > 0) {
      prompt += `### Related Issues\n`;
      for (const ie of issueEvidence) {
        const issue = ie.data as IssueData;
        prompt += `
#### Issue #${issue.number}: ${issue.title}
- Author: ${issue.author}
- State: ${issue.state}
- Labels: ${issue.labels.join(', ') || 'none'}
- Created: ${issue.createdAt.toISOString()}
- URL: ${issue.url}

${issue.body.substring(0, 1000)}${issue.body.length > 1000 ? '...' : ''}

Comments (${issue.comments.length}):
${issue.comments.slice(0, 5).map(c => 
  `- **${c.author}**: ${c.body.substring(0, 300)}${c.body.length > 300 ? '...' : ''}`
).join('\n')}

`;
      }
    }

    // Add file history if available
    const historyEvidence = evidence.find(e => e.type === 'file_history');
    if (historyEvidence) {
      const commits = historyEvidence.data as CommitInfo[];
      prompt += `### File History (${commits.length} commits)
${commits.slice(0, 15).map(c => 
  `- ${c.hash.substring(0, 7)} - ${c.date.toISOString().split('T')[0]} - ${c.author}: ${c.message.split('\n')[0]}`
).join('\n')}
${commits.length > 15 ? `\n... and ${commits.length - 15} more commits` : ''}

`;
    }

    // Add thought chain context for multi-turn reasoning
    if (this.thoughtChain.signatures.length > 0) {
      prompt += `### Previous Investigation Steps
This investigation has ${this.thoughtChain.totalSteps} previous reasoning steps.
Thought chain signatures: ${this.thoughtChain.signatures.map(s => s.signature).join(' → ')}

`;
    }

    prompt += `## Your Investigation

Based on all evidence above, provide your investigation findings following the format specified in your instructions. Be thorough but precise. Cite specific evidence for all claims.`;

    return prompt;
  }

  /**
   * Parse the investigation response into structured format
   */
  private parseInvestigationResponse(
    response: string,
    caseFile: CaseFile
  ): InvestigationResult {
    // Extract summary (first paragraph or summary section)
    const summaryMatch = response.match(/(?:summary|overview)[:\s]*([^\n]+(?:\n[^\n#]+)*)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim() 
      : response.split('\n\n')[0].substring(0, 300);

    // Extract confidence score
    const confidenceMatch = response.match(/confidence[:\s]*(\d+)/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50;

    // Extract sources from the response
    const sources = this.extractSources(response, caseFile);

    // Extract recommendations
    const recommendations = this.extractRecommendations(response);

    // Build timeline from evidence
    const timeline = this.buildTimeline(caseFile);

    return {
      narrative: response,
      summary,
      confidence: Math.min(100, Math.max(0, confidence)),
      sources,
      recommendations,
      timeline,
      thoughtChain: { ...this.thoughtChain }
    };
  }

  /**
   * Extract source citations from the response
   */
  private extractSources(response: string, caseFile: CaseFile): Source[] {
    const sources: Source[] = [];

    // Extract commit references
    const commitMatches = response.matchAll(/\b([a-f0-9]{7,40})\b/gi);
    for (const match of commitMatches) {
      const hash = match[1];
      // Verify it's a commit we have
      const hasCommit = caseFile.evidence.some(e => {
        if (e.type === 'commit') {
          const c = e.data as CommitInfo;
          return c.hash.startsWith(hash);
        }
        if (e.type === 'blame') {
          const b = e.data as BlameData;
          return b.commitHash.startsWith(hash);
        }
        return false;
      });
      if (hasCommit && !sources.find(s => s.id === hash)) {
        sources.push({
          type: 'commit',
          id: hash,
          description: `Commit ${hash.substring(0, 7)}`
        });
      }
    }

    // Extract PR references
    const prMatches = response.matchAll(/(?:PR|pull request)\s*#?(\d+)/gi);
    for (const match of prMatches) {
      const num = match[1];
      const prEvidence = caseFile.evidence.find(e => e.type === 'pr');
      if (prEvidence) {
        const pr = prEvidence.data as PRData;
        if (pr.number.toString() === num && !sources.find(s => s.id === `PR#${num}`)) {
          sources.push({
            type: 'pr',
            id: `PR#${num}`,
            url: pr.url,
            description: pr.title
          });
        }
      }
    }

    // Extract issue references
    const issueMatches = response.matchAll(/(?:issue)\s*#?(\d+)/gi);
    for (const match of issueMatches) {
      const num = match[1];
      const issueEvidence = caseFile.evidence.find(e => {
        if (e.type === 'issue') {
          return (e.data as IssueData).number.toString() === num;
        }
        return false;
      });
      if (issueEvidence) {
        const issue = issueEvidence.data as IssueData;
        sources.push({
          type: 'issue',
          id: `Issue#${num}`,
          url: issue.url,
          description: issue.title
        });
      }
    }

    return sources;
  }

  /**
   * Extract recommendations from the response
   */
  private extractRecommendations(response: string): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const lowerResponse = response.toLowerCase();

    const actions: Array<{ keyword: string; action: Recommendation['action'] }> = [
      { keyword: 'should be kept', action: 'keep' },
      { keyword: 'recommend keeping', action: 'keep' },
      { keyword: 'still necessary', action: 'keep' },
      { keyword: 'should be refactored', action: 'refactor' },
      { keyword: 'recommend refactoring', action: 'refactor' },
      { keyword: 'needs documentation', action: 'document' },
      { keyword: 'should be documented', action: 'document' },
      { keyword: 'can be removed', action: 'remove' },
      { keyword: 'should be removed', action: 'remove' },
      { keyword: 'dead code', action: 'remove' },
      { keyword: 'warrants further investigation', action: 'investigate' },
      { keyword: 'needs more analysis', action: 'investigate' },
    ];

    for (const { keyword, action } of actions) {
      if (lowerResponse.includes(keyword)) {
        // Find the sentence containing this keyword
        const sentenceMatch = response.match(
          new RegExp(`[^.]*${keyword.replace(/\s+/g, '\\s+')}[^.]*\\.`, 'i')
        );
        recommendations.push({
          action,
          reason: sentenceMatch ? sentenceMatch[0].trim() : keyword,
          priority: action === 'remove' || action === 'refactor' ? 'high' : 'medium'
        });
      }
    }

    // Deduplicate by action
    return recommendations.filter((r, i, arr) => 
      arr.findIndex(x => x.action === r.action) === i
    );
  }

  /**
   * Build timeline from case file evidence
   */
  private buildTimeline(caseFile: CaseFile): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const e of caseFile.evidence) {
      switch (e.type) {
        case 'blame': {
          const blame = e.data as BlameData;
          events.push({
            date: blame.timestamp,
            type: 'blame',
            title: 'Code Authored',
            description: `Line ${blame.lineNumber} written`,
            author: blame.author,
            sourceId: blame.commitHash.substring(0, 7)
          });
          break;
        }
        case 'commit': {
          const commit = e.data as CommitInfo;
          events.push({
            date: commit.date,
            type: 'commit',
            title: commit.message.split('\n')[0].substring(0, 60),
            description: commit.message,
            author: commit.author,
            sourceId: commit.hash.substring(0, 7)
          });
          break;
        }
        case 'pr': {
          const pr = e.data as PRData;
          events.push({
            date: pr.createdAt,
            type: 'pr',
            title: `PR #${pr.number}: ${pr.title}`,
            description: pr.body.substring(0, 200),
            author: pr.author,
            sourceId: `PR#${pr.number}`,
            sourceUrl: pr.url
          });
          if (pr.mergedAt) {
            events.push({
              date: pr.mergedAt,
              type: 'pr',
              title: `PR #${pr.number} Merged`,
              description: `Pull request merged`,
              author: pr.author,
              sourceId: `PR#${pr.number}`,
              sourceUrl: pr.url
            });
          }
          break;
        }
        case 'issue': {
          const issue = e.data as IssueData;
          events.push({
            date: issue.createdAt,
            type: 'issue',
            title: `Issue #${issue.number}: ${issue.title}`,
            description: issue.body.substring(0, 200),
            author: issue.author,
            sourceId: `Issue#${issue.number}`,
            sourceUrl: issue.url
          });
          break;
        }
      }
    }

    // Sort by date
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get thinking budget based on level
   */
  private getThinkingBudget(): number {
    switch (this.thinkingLevel) {
      case 'low': return 1024;
      case 'medium': return 8192;
      case 'high': return 24576;
      default: return 24576;
    }
  }

  /**
   * Extract thought signature from response metadata
   */
  private extractThoughtSignature(response: any): ThoughtSignature | null {
    this.stepCounter++;
    
    // Create thought signature from response metadata if available
    // The actual signature would come from Gemini 3's response metadata
    const signature = response?.candidates?.[0]?.thoughtSignature 
      || `lead-detective-${Date.now()}-${this.stepCounter}`;

    return {
      signature: typeof signature === 'string' ? signature : JSON.stringify(signature),
      timestamp: new Date(),
      agentId: 'lead-detective',
      step: this.stepCounter
    };
  }

  /**
   * Get current thought chain (for debugging/demo)
   */
  getThoughtChain(): ThoughtChain {
    return { ...this.thoughtChain };
  }

  /**
   * Reset thought chain (for new investigation)
   */
  resetThoughtChain(): void {
    this.thoughtChain = { signatures: [], totalSteps: 0 };
    this.stepCounter = 0;
  }
}
