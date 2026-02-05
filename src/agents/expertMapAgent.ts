/**
 * Expert Map Agent - "Who Knows What"
 * Visualizes which developers are experts on which parts of the codebase
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export interface ExpertiseMap {
  directories: DirectoryExpertise[];
  topExperts: Expert[];
  totalFiles: number;
  totalCommits: number;
}

export interface DirectoryExpertise {
  path: string;
  experts: Expert[];
  files: number;
  commits: number;
}

export interface Expert {
  name: string;
  email: string;
  commits: number;
  filesOwned: number;
  percentage: number;
  areas: string[];
}

export class ExpertMapAgent {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Analyze repository and build expertise map
   */
  async buildExpertiseMap(): Promise<ExpertiseMap> {
    const directories = await this.getTopDirectories();
    const directoryExpertise: DirectoryExpertise[] = [];
    const expertMap = new Map<string, Expert>();
    let totalCommits = 0;
    let totalFiles = 0;

    for (const dir of directories) {
      const expertise = await this.analyzeDirectory(dir);
      directoryExpertise.push(expertise);
      totalCommits += expertise.commits;
      totalFiles += expertise.files;

      // Aggregate experts
      for (const expert of expertise.experts) {
        if (!expertMap.has(expert.email)) {
          expertMap.set(expert.email, {
            ...expert,
            areas: [dir]
          });
        } else {
          const existing = expertMap.get(expert.email)!;
          existing.commits += expert.commits;
          existing.filesOwned += expert.filesOwned;
          existing.areas.push(dir);
        }
      }
    }

    // Calculate percentages
    const topExperts = Array.from(expertMap.values())
      .map(e => ({
        ...e,
        percentage: Math.round((e.commits / Math.max(totalCommits, 1)) * 100)
      }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);

    return {
      directories: directoryExpertise,
      topExperts,
      totalFiles,
      totalCommits
    };
  }

  /**
   * Get top-level directories to analyze
   */
  private async getTopDirectories(): Promise<string[]> {
    const dirs: string[] = [];
    const entries = fs.readdirSync(this.repoPath);

    for (const entry of entries) {
      const fullPath = path.join(this.repoPath, entry);
      if (fs.statSync(fullPath).isDirectory() && !entry.startsWith('.') && 
          !['node_modules', 'dist', 'build', 'coverage', '__pycache__'].includes(entry)) {
        dirs.push(entry);
      }
    }

    // If no directories, analyze root
    if (dirs.length === 0) {
      dirs.push('.');
    }

    return dirs.slice(0, 10); // Limit for performance
  }

  /**
   * Analyze a single directory for expertise
   */
  private async analyzeDirectory(dirPath: string): Promise<DirectoryExpertise> {
    const expertMap = new Map<string, { commits: number; files: Set<string> }>();
    let totalCommits = 0;
    let totalFiles = 0;

    try {
      // Get all commits touching this directory
      const log = await this.git.log({
        maxCount: 200,
        '--': null,
        [dirPath]: null
      } as any);

      for (const commit of log.all) {
        totalCommits++;
        const key = commit.author_email;
        
        if (!expertMap.has(key)) {
          expertMap.set(key, { commits: 0, files: new Set() });
        }
        
        const expert = expertMap.get(key)!;
        expert.commits++;
      }

      // Count files
      const countFiles = (dir: string): number => {
        let count = 0;
        try {
          const entries = fs.readdirSync(path.join(this.repoPath, dir));
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(path.join(this.repoPath, fullPath));
            if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
              count += countFiles(fullPath);
            } else if (stat.isFile()) {
              count++;
            }
          }
        } catch (e) {}
        return count;
      };

      totalFiles = countFiles(dirPath);

    } catch (e) {
      // Directory might not have history
    }

    // Convert to experts array
    const experts: Expert[] = Array.from(expertMap.entries())
      .map(([email, data]) => {
        // Get author name from email
        const name = email.split('@')[0].replace(/[._]/g, ' ');
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          email,
          commits: data.commits,
          filesOwned: data.files.size,
          percentage: Math.round((data.commits / Math.max(totalCommits, 1)) * 100),
          areas: [dirPath]
        };
      })
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);

    return {
      path: dirPath,
      experts,
      files: totalFiles,
      commits: totalCommits
    };
  }

  /**
   * Generate HTML visualization
   */
  generateHTML(data: ExpertiseMap): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Who Knows What - Expertise Map</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --bg2: var(--vscode-sideBar-background, #252526);
      --text: var(--vscode-editor-foreground, #d4d4d4);
      --text2: var(--vscode-descriptionForeground, #808080);
      --accent: var(--vscode-textLink-foreground, #3794ff);
      --border: var(--vscode-input-border, #3c3c3c);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--text); padding: 24px; }
    
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header p { color: var(--text2); }
    
    .stats { display: flex; gap: 32px; margin-bottom: 32px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: 700; color: var(--accent); }
    .stat-label { font-size: 12px; color: var(--text2); text-transform: uppercase; }
    
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; margin-bottom: 16px; }
    
    .experts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .expert-card { 
      padding: 16px; 
      background: var(--bg2); 
      border-radius: 8px;
      border-left: 4px solid var(--accent);
    }
    .expert-name { font-weight: 600; margin-bottom: 4px; }
    .expert-commits { color: var(--text2); font-size: 13px; margin-bottom: 8px; }
    .expert-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .expert-fill { height: 100%; background: var(--accent); }
    .expert-areas { margin-top: 8px; font-size: 12px; color: var(--text2); }
    
    .directory { padding: 16px; background: var(--bg2); border-radius: 8px; margin-bottom: 12px; }
    .directory-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .directory-name { font-weight: 600; font-family: monospace; }
    .directory-stats { font-size: 12px; color: var(--text2); }
    .directory-experts { display: flex; gap: 8px; flex-wrap: wrap; }
    .mini-expert { 
      padding: 4px 10px; 
      background: rgba(55, 148, 255, 0.1); 
      border-radius: 4px; 
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Who Knows What</h1>
    <p>Expertise map showing which developers know which parts of the codebase</p>
  </div>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${data.topExperts.length}</div>
      <div class="stat-label">Contributors</div>
    </div>
    <div class="stat">
      <div class="stat-value">${data.directories.length}</div>
      <div class="stat-label">Areas</div>
    </div>
    <div class="stat">
      <div class="stat-value">${data.totalCommits}</div>
      <div class="stat-label">Commits</div>
    </div>
  </div>
  
  <div class="section">
    <h2>Top Experts</h2>
    <div class="experts-grid">
      ${data.topExperts.map(e => `
        <div class="expert-card">
          <div class="expert-name">${e.name}</div>
          <div class="expert-commits">${e.commits} commits (${e.percentage}%)</div>
          <div class="expert-bar"><div class="expert-fill" style="width: ${e.percentage}%"></div></div>
          <div class="expert-areas">Areas: ${e.areas.join(', ')}</div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>By Area</h2>
    ${data.directories.map(d => `
      <div class="directory">
        <div class="directory-header">
          <span class="directory-name">/${d.path}</span>
          <span class="directory-stats">${d.files} files, ${d.commits} commits</span>
        </div>
        <div class="directory-experts">
          ${d.experts.slice(0, 3).map(e => `
            <span class="mini-expert">${e.name} (${e.percentage}%)</span>
          `).join('')}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
  }
}
