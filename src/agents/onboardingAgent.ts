/**
 * Onboarding Agent - "Explain Like I'm Onboarding"
 * Generates onboarding documentation for any folder or module
 */

import { GoogleGenAI } from '@google/genai';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export interface OnboardingDoc {
  title: string;
  overview: string;
  architecture: string;
  keyFiles: FileDoc[];
  gettingStarted: string[];
  commonPatterns: string[];
  gotchas: string[];
  relatedAreas: string[];
}

export interface FileDoc {
  path: string;
  purpose: string;
  importance: 'critical' | 'important' | 'supporting';
}

export class OnboardingAgent {
  private genai: GoogleGenAI;
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string, apiKey: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate onboarding docs for a directory
   */
  async generateDocs(targetPath: string): Promise<OnboardingDoc> {
    const fullPath = path.join(this.repoPath, targetPath);
    
    // Gather context
    const files = await this.getFiles(targetPath);
    const fileContents = await this.readKeyFiles(files.slice(0, 10));
    const history = await this.getHistory(targetPath);
    
    // Build prompt
    const prompt = `You are an expert developer writing onboarding documentation for a new team member.

Analyze this code module and generate comprehensive onboarding documentation.

## Directory: ${targetPath}

## Files in this module:
${files.map(f => `- ${f}`).join('\n')}

## Key file contents:
${fileContents}

## Recent commit history:
${history}

## Generate documentation in this exact JSON format:
{
  "title": "Module name in human-readable form",
  "overview": "2-3 sentence overview of what this module does and why it exists",
  "architecture": "Explain how the pieces fit together. What are the main components?",
  "keyFiles": [
    {"path": "file.ts", "purpose": "What this file does", "importance": "critical|important|supporting"}
  ],
  "gettingStarted": [
    "Step 1: First thing to understand",
    "Step 2: How to make your first change"
  ],
  "commonPatterns": [
    "Pattern: Description of common pattern used in this code"
  ],
  "gotchas": [
    "Watch out for this common mistake"
  ],
  "relatedAreas": [
    "Other modules this connects to"
  ]
}

Be specific and practical. A new developer should be able to understand this module after reading your docs.`;

    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 8192 }
        }
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as OnboardingDoc;
      }
    } catch (e) {
      // Fallback
    }

    // Fallback doc
    return {
      title: path.basename(targetPath),
      overview: `This module contains ${files.length} files.`,
      architecture: 'Unable to analyze architecture. Manual review recommended.',
      keyFiles: files.slice(0, 5).map(f => ({
        path: f,
        purpose: 'File in module',
        importance: 'supporting' as const
      })),
      gettingStarted: ['Review the files in this directory'],
      commonPatterns: [],
      gotchas: [],
      relatedAreas: []
    };
  }

  /**
   * Get files in directory
   */
  private async getFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const fullPath = path.join(this.repoPath, dirPath);
    
    const walk = (dir: string, prefix: string = '') => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const entryPath = path.join(dir, entry);
          const relativePath = prefix ? `${prefix}/${entry}` : entry;
          
          if (fs.statSync(entryPath).isDirectory()) {
            if (!['node_modules', '.git', 'dist', '__pycache__'].includes(entry)) {
              walk(entryPath, relativePath);
            }
          } else if (/\.(ts|tsx|js|jsx|py|go|rs|java)$/.test(entry)) {
            files.push(relativePath);
          }
        }
      } catch (e) {}
    };
    
    walk(fullPath);
    return files;
  }

  /**
   * Read key files content
   */
  private async readKeyFiles(files: string[]): Promise<string> {
    let content = '';
    
    for (const file of files.slice(0, 5)) {
      try {
        const fullPath = path.join(this.repoPath, file);
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const lines = fileContent.split('\n').slice(0, 50).join('\n');
        content += `\n### ${file}\n\`\`\`\n${lines}\n\`\`\`\n`;
      } catch (e) {}
    }
    
    return content.substring(0, 8000);
  }

  /**
   * Get commit history for directory
   */
  private async getHistory(dirPath: string): Promise<string> {
    try {
      const log = await this.git.log({
        maxCount: 10,
        '--': null,
        [dirPath]: null
      } as any);

      return log.all
        .map(c => `- ${c.message.split('\n')[0]} (${c.author_name})`)
        .join('\n');
    } catch (e) {
      return 'No history available';
    }
  }

  /**
   * Generate HTML visualization
   */
  generateHTML(doc: OnboardingDoc): string {
    const importanceColors: Record<string, string> = {
      critical: '#f87171',
      important: '#facc15',
      supporting: '#4ade80'
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Onboarding: ${doc.title}</title>
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
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--text); padding: 24px; line-height: 1.6; }
    
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    p { margin-bottom: 16px; }
    
    .overview { font-size: 16px; color: var(--text2); margin-bottom: 24px; }
    
    .section { background: var(--bg2); padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    
    .files-grid { display: grid; gap: 12px; }
    .file { 
      padding: 12px; 
      background: var(--bg); 
      border-radius: 6px;
      border-left: 4px solid var(--accent);
    }
    .file-path { font-family: monospace; font-size: 13px; margin-bottom: 4px; }
    .file-purpose { font-size: 13px; color: var(--text2); }
    .file-importance { 
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 4px;
    }
    
    ul { margin-left: 20px; }
    li { margin: 8px 0; }
    
    .tag { 
      display: inline-block;
      padding: 4px 10px;
      background: rgba(55, 148, 255, 0.1);
      border-radius: 4px;
      font-size: 13px;
      margin: 4px;
    }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <p class="overview">${doc.overview}</p>
  
  <div class="section">
    <h2>Architecture</h2>
    <p>${doc.architecture}</p>
  </div>
  
  <h2>Key Files</h2>
  <div class="files-grid">
    ${doc.keyFiles.map(f => `
      <div class="file" style="border-left-color: ${importanceColors[f.importance] || '#808080'}">
        <div class="file-path">${f.path}</div>
        <div class="file-purpose">${f.purpose}</div>
        <span class="file-importance" style="background: ${importanceColors[f.importance]}20; color: ${importanceColors[f.importance]}">${f.importance}</span>
      </div>
    `).join('')}
  </div>
  
  <h2>Getting Started</h2>
  <div class="section">
    <ol>
      ${doc.gettingStarted.map(s => `<li>${s}</li>`).join('')}
    </ol>
  </div>
  
  ${doc.commonPatterns.length > 0 ? `
    <h2>Common Patterns</h2>
    <div class="section">
      <ul>
        ${doc.commonPatterns.map(p => `<li>${p}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
  
  ${doc.gotchas.length > 0 ? `
    <h2>Watch Out For</h2>
    <div class="section">
      <ul>
        ${doc.gotchas.map(g => `<li>${g}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
  
  ${doc.relatedAreas.length > 0 ? `
    <h2>Related Areas</h2>
    <div>
      ${doc.relatedAreas.map(a => `<span class="tag">${a}</span>`).join('')}
    </div>
  ` : ''}
</body>
</html>`;
  }

  /**
   * Export as Markdown
   */
  exportMarkdown(doc: OnboardingDoc): string {
    return `# ${doc.title}

${doc.overview}

## Architecture

${doc.architecture}

## Key Files

${doc.keyFiles.map(f => `- **${f.path}** (${f.importance}): ${f.purpose}`).join('\n')}

## Getting Started

${doc.gettingStarted.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${doc.commonPatterns.length > 0 ? `## Common Patterns\n\n${doc.commonPatterns.map(p => `- ${p}`).join('\n')}` : ''}

${doc.gotchas.length > 0 ? `## Watch Out For\n\n${doc.gotchas.map(g => `- ${g}`).join('\n')}` : ''}

${doc.relatedAreas.length > 0 ? `## Related Areas\n\n${doc.relatedAreas.join(', ')}` : ''}
`;
  }
}
