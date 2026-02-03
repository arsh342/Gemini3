/**
 * Historian Agent - Git Operations Specialist
 * Handles all git-related evidence gathering: blame, log, diff
 */

import simpleGit, { SimpleGit } from 'simple-git';
import {
  BlameData,
  CommitInfo,
  AgentResponse,
  ThoughtSignature,
} from './types';

export class HistorianAgent {
  private git: SimpleGit;
  private repoPath: string;
  private stepCounter: number = 0;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get blame data for a specific line in a file
   */
  async getBlame(
    filePath: string,
    lineNumber: number
  ): Promise<AgentResponse<BlameData>> {
    const startTime = Date.now();
    
    try {
      // Use porcelain format for machine-readable output
      const blameOutput = await this.git.raw([
        'blame',
        '-L', `${lineNumber},${lineNumber}`,
        '--porcelain',
        filePath
      ]);

      const blameData = this.parseBlameOutput(blameOutput, lineNumber);
      
      return {
        data: blameData,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0, // Git operations don't use tokens
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to get blame for ${filePath}:${lineNumber}: ${error}`);
    }
  }

  /**
   * Get detailed commit information
   */
  async getCommitInfo(commitHash: string): Promise<AgentResponse<CommitInfo>> {
    const startTime = Date.now();
    
    try {
      // Get commit message and metadata
      const showOutput = await this.git.raw([
        'show',
        '--format=%H%n%an%n%ae%n%ad%n%s%n%b',
        '--no-patch',
        commitHash
      ]);

      // Get diff
      const diffOutput = await this.git.raw([
        'show',
        '--format=',
        commitHash
      ]);

      // Get changed files
      const filesOutput = await this.git.raw([
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        commitHash
      ]);

      const commitInfo = this.parseCommitInfo(showOutput, diffOutput, filesOutput);
      
      return {
        data: commitInfo,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to get commit info for ${commitHash}: ${error}`);
    }
  }

  /**
   * Get full file history (for 1M token context window usage)
   */
  async getFileHistory(
    filePath: string,
    maxCommits: number = 100
  ): Promise<AgentResponse<CommitInfo[]>> {
    const startTime = Date.now();
    
    try {
      // Get commit log for the file
      const logOutput = await this.git.raw([
        'log',
        '--follow',
        `--max-count=${maxCommits}`,
        '--format=%H',
        '--',
        filePath
      ]);

      const commitHashes = logOutput.trim().split('\n').filter(h => h);
      
      // Fetch details for each commit
      const commits: CommitInfo[] = [];
      for (const hash of commitHashes) {
        const response = await this.getCommitInfo(hash);
        commits.push(response.data);
      }

      return {
        data: commits,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to get file history for ${filePath}: ${error}`);
    }
  }

  /**
   * Get commits related to a line range
   */
  async getLineHistory(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<AgentResponse<CommitInfo[]>> {
    const startTime = Date.now();
    
    try {
      const logOutput = await this.git.raw([
        'log',
        '-L', `${startLine},${endLine}:${filePath}`,
        '--format=%H',
        '--no-patch'
      ]);

      const commitHashes = [...new Set(logOutput.trim().split('\n').filter(h => h))];
      
      const commits: CommitInfo[] = [];
      for (const hash of commitHashes.slice(0, 20)) { // Limit to 20 commits
        const response = await this.getCommitInfo(hash);
        commits.push(response.data);
      }

      return {
        data: commits,
        thoughtSignature: this.generateThoughtSignature(),
        tokensUsed: 0,
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to get line history: ${error}`);
    }
  }

  /**
   * Get repository remote info (owner/repo for GitHub)
   */
  async getRemoteInfo(): Promise<{ owner: string; repo: string } | null> {
    try {
      const remoteOutput = await this.git.raw(['remote', 'get-url', 'origin']);
      return this.parseRemoteUrl(remoteOutput.trim());
    } catch {
      return null;
    }
  }

  // ============================================
  // Private Parsing Methods
  // ============================================

  private parseBlameOutput(output: string, lineNumber: number): BlameData {
    const lines = output.split('\n');
    let commitHash = '';
    let author = '';
    let authorEmail = '';
    let timestamp = new Date();
    let lineContent = '';

    for (const line of lines) {
      if (line.match(/^[a-f0-9]{40}/)) {
        commitHash = line.substring(0, 40);
      } else if (line.startsWith('author ')) {
        author = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        authorEmail = line.substring(12).replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ')) {
        timestamp = new Date(parseInt(line.substring(12)) * 1000);
      } else if (line.startsWith('\t')) {
        lineContent = line.substring(1);
      }
    }

    return {
      commitHash,
      author,
      authorEmail,
      timestamp,
      lineNumber,
      lineContent
    };
  }

  private parseCommitInfo(
    showOutput: string,
    diffOutput: string,
    filesOutput: string
  ): CommitInfo {
    const lines = showOutput.trim().split('\n');
    
    return {
      hash: lines[0] || '',
      author: lines[1] || '',
      authorEmail: lines[2] || '',
      date: new Date(lines[3] || ''),
      message: lines.slice(4).join('\n').trim(),
      diff: diffOutput,
      changedFiles: filesOutput.trim().split('\n').filter(f => f)
    };
  }

  private parseRemoteUrl(url: string): { owner: string; repo: string } | null {
    // Handle HTTPS URLs: https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // Handle SSH URLs: git@github.com:owner/repo.git
    const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    return null;
  }

  private generateThoughtSignature(): ThoughtSignature {
    this.stepCounter++;
    return {
      signature: `historian-${Date.now()}-${this.stepCounter}`,
      timestamp: new Date(),
      agentId: 'historian',
      step: this.stepCounter
    };
  }
}
