/**
 * Code Timeline Agent
 * Creates interactive visualization of code history
 */

import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import * as path from 'path';

export interface TimelineEvent {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
  additions: number;
  deletions: number;
  type: 'commit' | 'merge' | 'tag' | 'branch';
}

export interface TimelineData {
  events: TimelineEvent[];
  branches: string[];
  authors: AuthorStats[];
  dateRange: { start: Date; end: Date };
  totalCommits: number;
}

export interface AuthorStats {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: Date;
  lastCommit: Date;
}

export class TimelineAgent {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get timeline data for a file
   */
  async getFileTimeline(filePath: string, maxCommits: number = 50): Promise<TimelineData> {
    const log = await this.git.log({
      file: filePath,
      maxCount: maxCommits,
      '--stat': null
    });

    return this.processLog(log);
  }

  /**
   * Get timeline data for entire repository
   */
  async getRepoTimeline(maxCommits: number = 100): Promise<TimelineData> {
    const log = await this.git.log({
      maxCount: maxCommits,
      '--stat': null
    });

    return this.processLog(log);
  }

  /**
   * Process git log into timeline data
   */
  private async processLog(log: LogResult): Promise<TimelineData> {
    const events: TimelineEvent[] = [];
    const authorMap = new Map<string, AuthorStats>();

    for (const entry of log.all) {
      // Parse stats from diff
      let additions = 0;
      let deletions = 0;
      const files: string[] = [];

      if (entry.diff) {
        additions = entry.diff.insertions || 0;
        deletions = entry.diff.deletions || 0;
        files.push(...(entry.diff.files?.map(f => f.file) || []));
      }

      // Determine commit type
      const isMerge = entry.message.toLowerCase().startsWith('merge');
      
      const event: TimelineEvent = {
        hash: entry.hash,
        shortHash: entry.hash.substring(0, 7),
        author: entry.author_name,
        email: entry.author_email,
        date: new Date(entry.date),
        message: entry.message.split('\n')[0], // First line only
        files,
        additions,
        deletions,
        type: isMerge ? 'merge' : 'commit'
      };

      events.push(event);

      // Update author stats
      const authorKey = entry.author_email;
      if (!authorMap.has(authorKey)) {
        authorMap.set(authorKey, {
          name: entry.author_name,
          email: entry.author_email,
          commits: 0,
          additions: 0,
          deletions: 0,
          firstCommit: new Date(entry.date),
          lastCommit: new Date(entry.date)
        });
      }

      const author = authorMap.get(authorKey)!;
      author.commits++;
      author.additions += additions;
      author.deletions += deletions;
      if (new Date(entry.date) < author.firstCommit) {
        author.firstCommit = new Date(entry.date);
      }
      if (new Date(entry.date) > author.lastCommit) {
        author.lastCommit = new Date(entry.date);
      }
    }

    // Get branches
    const branchInfo = await this.git.branch();
    const branches = branchInfo.all;

    // Sort authors by commits
    const authors = Array.from(authorMap.values())
      .sort((a, b) => b.commits - a.commits);

    // Date range
    const dates = events.map(e => e.date.getTime());
    const dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates))
    };

    return {
      events,
      branches,
      authors,
      dateRange,
      totalCommits: events.length
    };
  }

  /**
   * Generate HTML for timeline visualization
   */
  generateTimelineHTML(data: TimelineData, filePath?: string): string {
    const title = filePath ? `Timeline: ${path.basename(filePath)}` : 'Repository Timeline';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background, #1e1e1e);
      --bg-secondary: var(--vscode-sideBar-background, #252526);
      --text-primary: var(--vscode-editor-foreground, #d4d4d4);
      --text-secondary: var(--vscode-descriptionForeground, #808080);
      --accent: var(--vscode-textLink-foreground, #3794ff);
      --success: #4ade80;
      --danger: #f87171;
      --border: var(--vscode-input-border, #3c3c3c);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 20px;
      line-height: 1.6;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }
    
    .stats {
      display: flex;
      gap: 24px;
    }
    
    .stat {
      text-align: center;
    }
    
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--accent);
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .timeline {
      position: relative;
      padding-left: 40px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border);
    }
    
    .event {
      position: relative;
      margin-bottom: 20px;
      padding: 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
      border-left: 3px solid var(--accent);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .event:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .event::before {
      content: '';
      position: absolute;
      left: -29px;
      top: 20px;
      width: 12px;
      height: 12px;
      background: var(--accent);
      border-radius: 50%;
      border: 3px solid var(--bg-primary);
    }
    
    .event.merge::before { background: #a78bfa; }
    .event.merge { border-left-color: #a78bfa; }
    
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .event-hash {
      font-family: monospace;
      font-size: 13px;
      color: var(--accent);
      background: rgba(55, 148, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .event-date {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .event-message {
      font-size: 15px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    
    .event-author {
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .event-stats {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 12px;
    }
    
    .additions { color: var(--success); }
    .deletions { color: var(--danger); }
    
    .event-files {
      margin-top: 8px;
      padding: 8px;
      background: rgba(0,0,0,0.2);
      border-radius: 4px;
      font-size: 12px;
    }
    
    .event-files summary {
      cursor: pointer;
      color: var(--text-secondary);
    }
    
    .event-files ul {
      margin: 8px 0 0 16px;
      padding: 0;
    }
    
    .event-files li {
      margin: 2px 0;
      font-family: monospace;
      color: var(--text-secondary);
    }
    
    .authors-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    
    .authors-section h2 {
      font-size: 18px;
      margin-bottom: 16px;
    }
    
    .author-card {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin-right: 12px;
      margin-bottom: 12px;
    }
    
    .author-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
    }
    
    .author-info h3 {
      font-size: 14px;
      font-weight: 600;
    }
    
    .author-commits {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .filter-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .filter-bar input, .filter-bar select {
      padding: 8px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }
    
    .filter-bar input:focus, .filter-bar select:focus {
      outline: none;
      border-color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${data.totalCommits}</div>
        <div class="stat-label">Commits</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.authors.length}</div>
        <div class="stat-label">Contributors</div>
      </div>
      <div class="stat">
        <div class="stat-value">${this.formatDateRange(data.dateRange)}</div>
        <div class="stat-label">Time Span</div>
      </div>
    </div>
  </div>
  
  <div class="filter-bar">
    <input type="text" id="search" placeholder="Search commits..." onkeyup="filterEvents()">
    <select id="authorFilter" onchange="filterEvents()">
      <option value="">All Authors</option>
      ${data.authors.map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
    </select>
  </div>
  
  <div class="timeline" id="timeline">
    ${data.events.map(e => this.renderEvent(e)).join('')}
  </div>
  
  <div class="authors-section">
    <h2>Top Contributors</h2>
    ${data.authors.slice(0, 5).map(a => this.renderAuthor(a)).join('')}
  </div>
  
  <script>
    function filterEvents() {
      const search = document.getElementById('search').value.toLowerCase();
      const author = document.getElementById('authorFilter').value;
      const events = document.querySelectorAll('.event');
      
      events.forEach(event => {
        const message = event.querySelector('.event-message').textContent.toLowerCase();
        const eventAuthor = event.dataset.author;
        
        const matchesSearch = !search || message.includes(search);
        const matchesAuthor = !author || eventAuthor === author;
        
        event.style.display = matchesSearch && matchesAuthor ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;
  }

  private renderEvent(event: TimelineEvent): string {
    const filesList = event.files.length > 0 
      ? `<div class="event-files">
          <details>
            <summary>${event.files.length} file(s) changed</summary>
            <ul>
              ${event.files.slice(0, 10).map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
              ${event.files.length > 10 ? `<li>... and ${event.files.length - 10} more</li>` : ''}
            </ul>
          </details>
        </div>`
      : '';
    
    return `
      <div class="event ${event.type}" data-author="${event.author}">
        <div class="event-header">
          <span class="event-hash">${event.shortHash}</span>
          <span class="event-date">${this.formatDate(event.date)}</span>
        </div>
        <div class="event-message">${this.escapeHtml(event.message)}</div>
        <div class="event-author">by ${event.author}</div>
        <div class="event-stats">
          <span class="additions">+${event.additions}</span>
          <span class="deletions">-${event.deletions}</span>
        </div>
        ${filesList}
      </div>
    `;
  }

  private renderAuthor(author: AuthorStats): string {
    const initials = author.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    return `
      <div class="author-card">
        <div class="author-avatar">${initials}</div>
        <div class="author-info">
          <h3>${author.name}</h3>
          <div class="author-commits">${author.commits} commits • +${author.additions} -${author.deletions}</div>
        </div>
      </div>
    `;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  }

  private formatDateRange(range: { start: Date; end: Date }): string {
    const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.ceil(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
