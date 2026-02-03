/**
 * Archivist Agent - GitHub API Specialist
 * Handles PR, Issue, and Discussion retrieval from GitHub
 */

import { Octokit } from '@octokit/rest';
import {
  PRData,
  PRComment,
  PRReview,
  IssueData,
  IssueComment,
  AgentResponse,
  ThoughtSignature,
} from './types';

export class ArchivistAgent {
  private octokit: Octokit;
  private stepCounter: number = 0;

  constructor(githubToken?: string) {
    this.octokit = new Octokit({
      auth: githubToken
    });
  }

  /**
   * Find PR associated with a commit
   */
  async findPRByCommit(
    owner: string,
    repo: string,
    commitHash: string
  ): Promise<AgentResponse<PRData | null>> {
    const startTime = Date.now();
    
    try {
      // Search for PRs containing this commit
      const searchResult = await this.octokit.search.issuesAndPullRequests({
        q: `${commitHash} repo:${owner}/${repo} is:pr`,
        per_page: 5
      });

      if (searchResult.data.items.length === 0) {
        // Try alternative: list PRs that contain commit
        const prList = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: commitHash
        });

        if (prList.data.length === 0) {
          return {
            data: null,
            thoughtSignature: this.generateThoughtSignature(),
            tokensUsed: 0,
            latencyMs: Date.now() - startTime
          };
        }

        const pr = prList.data[0];
        const prData = await this.getPRDetails(owner, repo, pr.number);
        
        return {
          data: prData,
          thoughtSignature: this.generateThoughtSignature(),
          tokensUsed: 0,
          latencyMs: Date.now() - startTime
        };
      }

      // Get first matching PR
      const prNumber = searchResult.data.items[0].number;
      const prData = await this.getPRDetails(owner, repo, prNumber);

      return {
        data: prData,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Failed to find PR for commit ${commitHash}:`, error);
      return {
        data: null,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get detailed PR information
   */
  async getPRDetails(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRData> {
    const [pr, comments, reviews] = await Promise.all([
      this.octokit.pulls.get({ owner, repo, pull_number: prNumber }),
      this.getPRComments(owner, repo, prNumber),
      this.getPRReviews(owner, repo, prNumber)
    ]);

    const linkedIssues = this.extractLinkedIssues(pr.data.body || '');

    return {
      number: pr.data.number,
      title: pr.data.title,
      body: pr.data.body || '',
      author: pr.data.user?.login || 'unknown',
      state: pr.data.merged ? 'merged' : pr.data.state as 'open' | 'closed',
      url: pr.data.html_url,
      createdAt: new Date(pr.data.created_at),
      mergedAt: pr.data.merged_at ? new Date(pr.data.merged_at) : null,
      comments,
      reviews,
      linkedIssues
    };
  }

  /**
   * Get PR comments (both issue comments and review comments)
   */
  private async getPRComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRComment[]> {
    const [issueComments, reviewComments] = await Promise.all([
      this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100
      }),
      this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100
      })
    ]);

    const comments: PRComment[] = [
      ...issueComments.data.map(c => ({
        id: c.id,
        author: c.user?.login || 'unknown',
        body: c.body || '',
        createdAt: new Date(c.created_at)
      })),
      ...reviewComments.data.map(c => ({
        id: c.id,
        author: c.user?.login || 'unknown',
        body: c.body || '',
        createdAt: new Date(c.created_at)
      }))
    ];

    // Sort by date
    return comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get PR reviews
   */
  private async getPRReviews(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRReview[]> {
    const reviews = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100
    });

    return reviews.data.map(r => ({
      id: r.id,
      author: r.user?.login || 'unknown',
      state: r.state.toLowerCase() as 'approved' | 'changes_requested' | 'commented',
      body: r.body || '',
      createdAt: new Date(r.submitted_at || '')
    }));
  }

  /**
   * Get issue details
   */
  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<AgentResponse<IssueData | null>> {
    const startTime = Date.now();
    
    try {
      const [issue, comments] = await Promise.all([
        this.octokit.issues.get({ owner, repo, issue_number: issueNumber }),
        this.getIssueComments(owner, repo, issueNumber)
      ]);

      const issueData: IssueData = {
        number: issue.data.number,
        title: issue.data.title,
        body: issue.data.body || '',
        author: issue.data.user?.login || 'unknown',
        state: issue.data.state as 'open' | 'closed',
        url: issue.data.html_url,
        createdAt: new Date(issue.data.created_at),
        closedAt: issue.data.closed_at ? new Date(issue.data.closed_at) : null,
        labels: issue.data.labels.map(l => 
          typeof l === 'string' ? l : l.name || ''
        ),
        comments
      };

      return {
        data: issueData,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Failed to get issue #${issueNumber}:`, error);
      return {
        data: null,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get issue comments
   */
  private async getIssueComments(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<IssueComment[]> {
    const comments = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100
    });

    return comments.data.map(c => ({
      id: c.id,
      author: c.user?.login || 'unknown',
      body: c.body || '',
      createdAt: new Date(c.created_at)
    }));
  }

  /**
   * Get multiple issues
   */
  async getIssues(
    owner: string,
    repo: string,
    issueNumbers: number[]
  ): Promise<IssueData[]> {
    const issues: IssueData[] = [];
    
    for (const num of issueNumbers) {
      const response = await this.getIssue(owner, repo, num);
      if (response.data) {
        issues.push(response.data);
      }
    }

    return issues;
  }

  /**
   * Extract issue references from PR body
   * Matches: Fixes #123, Closes #456, Resolves #789, etc.
   */
  private extractLinkedIssues(body: string): number[] {
    const regex = /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s*#(\d+)/gi;
    const matches: number[] = [];
    let match;

    while ((match = regex.exec(body)) !== null) {
      matches.push(parseInt(match[1], 10));
    }

    // Also extract plain issue references
    const plainRefs = body.match(/#(\d+)/g);
    if (plainRefs) {
      for (const ref of plainRefs) {
        const num = parseInt(ref.slice(1), 10);
        if (!matches.includes(num)) {
          matches.push(num);
        }
      }
    }

    return [...new Set(matches)];
  }

  private generateThoughtSignature(): ThoughtSignature {
    this.stepCounter++;
    return {
      signature: `archivist-${Date.now()}-${this.stepCounter}`,
      timestamp: new Date(),
      agentId: 'archivist',
      step: this.stepCounter
    };
  }
}
