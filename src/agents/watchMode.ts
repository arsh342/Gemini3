/**
 * Watch Mode Agent - Continuous Monitoring System
 * Monitors repository for new commits and automatically investigates
 * Implements long-running autonomous agent pattern
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { Investigator } from '../investigator';
import { InvestigationResult, CodeSelection } from './types';

export interface WatchConfig {
  geminiApiKey: string;
  githubToken?: string;
  pollIntervalMs?: number;      // How often to check for new commits (default: 30000)
  investigateNewCommits?: boolean;
  investigateSuspiciousPatterns?: boolean;
  maxInvestigationsPerPoll?: number;
  onNewCommit?: (commit: WatchedCommit) => void;
  onInvestigationComplete?: (result: WatchInvestigationResult) => void;
  onSuspiciousChange?: (alert: SuspiciousChangeAlert) => void;
}

export interface WatchedCommit {
  hash: string;
  author: string;
  message: string;
  timestamp: Date;
  files: string[];
}

export interface WatchInvestigationResult {
  commit: WatchedCommit;
  investigation: InvestigationResult;
  triggeredBy: 'new_commit' | 'suspicious_pattern';
  timestamp: Date;
}

export interface SuspiciousChangeAlert {
  type: 'magic_number' | 'hardcoded_value' | 'large_change' | 'deleted_code' | 'commented_code';
  file: string;
  line: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Patterns that might indicate suspicious or important changes
const SUSPICIOUS_PATTERNS = [
  { regex: /=\s*\d{3,}(?!\d)/g, type: 'magic_number' as const, desc: 'Magic number detected' },
  { regex: /(?:password|secret|key|token)\s*[:=]/i, type: 'hardcoded_value' as const, desc: 'Potential hardcoded secret' },
  { regex: /\/\/\s*TODO|FIXME|HACK|XXX/i, type: 'commented_code' as const, desc: 'TODO/FIXME marker' },
  { regex: /^\+.*\/\/.*$/gm, type: 'commented_code' as const, desc: 'Added comment' },
];

export class WatchModeAgent extends EventEmitter {
  private git: SimpleGit;
  private config: WatchConfig;
  private repoPath: string;
  private lastKnownCommit: string | null = null;
  private isWatching: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private investigator: Investigator;
  private investigationHistory: WatchInvestigationResult[] = [];

  constructor(repoPath: string, config: WatchConfig) {
    super();
    this.repoPath = repoPath;
    this.config = config;
    this.git = simpleGit(repoPath);
    this.investigator = new Investigator({
      geminiApiKey: config.geminiApiKey,
      githubToken: config.githubToken,
      thinkingLevel: 'high'
    });
  }

  /**
   * Start watching the repository
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log('Watch mode already active');
      return;
    }

    // Get initial commit hash
    this.lastKnownCommit = await this.getLatestCommitHash();
    this.isWatching = true;

    console.log(`🔍 Watch Mode activated for: ${this.repoPath}`);
    console.log(`📍 Starting from commit: ${this.lastKnownCommit?.substring(0, 7)}`);
    console.log(`⏱️  Poll interval: ${(this.config.pollIntervalMs || 30000) / 1000}s`);

    this.emit('started', {
      repoPath: this.repoPath,
      startCommit: this.lastKnownCommit
    });

    // Start polling
    this.poll();
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.isWatching = false;
    
    console.log('🛑 Watch Mode stopped');
    this.emit('stopped', {
      totalInvestigations: this.investigationHistory.length
    });
  }

  /**
   * Poll for new commits
   */
  private async poll(): Promise<void> {
    if (!this.isWatching) return;

    try {
      const latestCommit = await this.getLatestCommitHash();

      if (latestCommit !== this.lastKnownCommit) {
        // New commits detected!
        const newCommits = await this.getCommitsSince(this.lastKnownCommit!);
        
        for (const commit of newCommits.slice(0, this.config.maxInvestigationsPerPoll || 3)) {
          await this.processNewCommit(commit);
        }

        this.lastKnownCommit = latestCommit;
      }
    } catch (error) {
      this.emit('error', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(
      () => this.poll(),
      this.config.pollIntervalMs || 30000
    );
  }

  /**
   * Process a new commit
   */
  private async processNewCommit(commit: WatchedCommit): Promise<void> {
    console.log(`\n📝 New commit detected: ${commit.hash.substring(0, 7)} - ${commit.message.substring(0, 50)}`);
    
    this.config.onNewCommit?.(commit);
    this.emit('newCommit', commit);

    // Check for suspicious patterns
    if (this.config.investigateSuspiciousPatterns) {
      const alerts = await this.detectSuspiciousPatterns(commit);
      
      for (const alert of alerts) {
        console.log(`⚠️  Suspicious: ${alert.description} in ${alert.file}:${alert.line}`);
        this.config.onSuspiciousChange?.(alert);
        this.emit('suspiciousChange', alert);
      }
    }

    // Investigate the commit
    if (this.config.investigateNewCommits) {
      await this.investigateCommit(commit);
    }
  }

  /**
   * Detect suspicious patterns in commit diff
   */
  private async detectSuspiciousPatterns(commit: WatchedCommit): Promise<SuspiciousChangeAlert[]> {
    const alerts: SuspiciousChangeAlert[] = [];

    try {
      const diff = await this.git.raw(['show', '--format=', commit.hash]);
      const lines = diff.split('\n');
      let currentFile = '';
      let lineNumber = 0;

      for (const line of lines) {
        // Track current file
        const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
        if (fileMatch) {
          currentFile = fileMatch[1];
          lineNumber = 0;
          continue;
        }

        // Track line number
        const lineMatch = line.match(/^@@ -\d+,?\d* \+(\d+)/);
        if (lineMatch) {
          lineNumber = parseInt(lineMatch[1], 10);
          continue;
        }

        // Only check added lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
          for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.regex.test(line)) {
              alerts.push({
                type: pattern.type,
                file: currentFile,
                line: lineNumber,
                description: pattern.desc,
                severity: pattern.type === 'hardcoded_value' ? 'high' : 'medium'
              });
            }
            // Reset regex lastIndex
            pattern.regex.lastIndex = 0;
          }
          lineNumber++;
        } else if (!line.startsWith('-')) {
          lineNumber++;
        }
      }

      // Check for large changes
      const stats = await this.git.raw(['show', '--stat', commit.hash]);
      const insertions = stats.match(/(\d+) insertions?/);
      const deletions = stats.match(/(\d+) deletions?/);
      
      const totalChanges = 
        (insertions ? parseInt(insertions[1], 10) : 0) +
        (deletions ? parseInt(deletions[1], 10) : 0);

      if (totalChanges > 500) {
        alerts.push({
          type: 'large_change',
          file: 'multiple',
          line: 0,
          description: `Large change: ${totalChanges} lines modified`,
          severity: 'medium'
        });
      }

      if (deletions && parseInt(deletions[1], 10) > 200) {
        alerts.push({
          type: 'deleted_code',
          file: 'multiple',
          line: 0,
          description: `Significant deletion: ${deletions[1]} lines removed`,
          severity: 'medium'
        });
      }
    } catch (error) {
      // Silently continue if pattern detection fails
    }

    return alerts;
  }

  /**
   * Investigate a commit
   */
  private async investigateCommit(commit: WatchedCommit): Promise<void> {
    // Pick the first meaningful file to investigate
    const targetFile = commit.files.find(f => 
      f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx')
    );

    if (!targetFile) {
      console.log('⏭️  No source files to investigate in this commit');
      return;
    }

    console.log(`🔬 Investigating: ${targetFile}`);

    try {
      const fullPath = path.join(this.repoPath, targetFile);
      
      if (!fs.existsSync(fullPath)) {
        console.log('⏭️  File was deleted, skipping investigation');
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Find first function/class definition
      let targetLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^(export\s+)?(class|function|const\s+\w+\s*=)/)) {
          targetLine = i + 1;
          break;
        }
      }

      const selection: CodeSelection = {
        text: lines.slice(targetLine - 1, targetLine + 10).join('\n'),
        filePath: targetFile,
        lineStart: targetLine,
        lineEnd: Math.min(targetLine + 10, lines.length),
        repoPath: this.repoPath,
      };

      const investigation = await this.investigator.investigate(selection);

      const result: WatchInvestigationResult = {
        commit,
        investigation,
        triggeredBy: 'new_commit',
        timestamp: new Date()
      };

      this.investigationHistory.push(result);
      this.config.onInvestigationComplete?.(result);
      this.emit('investigationComplete', result);

      console.log(`✅ Investigation complete. Confidence: ${investigation.confidence}%`);
    } catch (error) {
      console.error(`❌ Investigation failed: ${error}`);
      this.emit('investigationFailed', { commit, error });
    }
  }

  /**
   * Get latest commit hash
   */
  private async getLatestCommitHash(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 });
    return log.latest?.hash || '';
  }

  /**
   * Get commits since a given hash
   */
  private async getCommitsSince(sinceHash: string): Promise<WatchedCommit[]> {
    const log = await this.git.log({ from: sinceHash, to: 'HEAD' });
    const commits: WatchedCommit[] = [];

    for (const entry of log.all) {
      const files = await this.git.raw([
        'diff-tree', '--no-commit-id', '--name-only', '-r', entry.hash
      ]);

      commits.push({
        hash: entry.hash,
        author: entry.author_name,
        message: entry.message,
        timestamp: new Date(entry.date),
        files: files.trim().split('\n').filter(f => f)
      });
    }

    return commits;
  }

  /**
   * Get investigation history
   */
  getHistory(): WatchInvestigationResult[] {
    return [...this.investigationHistory];
  }

  /**
   * Generate summary report
   */
  generateReport(): string {
    let report = `# Watch Mode Report\n\n`;
    report += `**Repository:** ${this.repoPath}\n`;
    report += `**Investigations:** ${this.investigationHistory.length}\n\n`;

    for (const result of this.investigationHistory) {
      report += `## ${result.commit.hash.substring(0, 7)} - ${result.commit.message}\n`;
      report += `**Author:** ${result.commit.author}\n`;
      report += `**Confidence:** ${result.investigation.confidence}%\n`;
      report += `**Summary:** ${result.investigation.summary}\n\n`;
    }

    return report;
  }
}
