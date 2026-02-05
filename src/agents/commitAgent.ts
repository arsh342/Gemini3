/**
 * Commit Message Generator Agent
 * Uses Gemini to analyze staged changes and generate meaningful commit messages
 */

import { GoogleGenAI } from '@google/genai';
import simpleGit, { SimpleGit, DiffResult } from 'simple-git';

export interface CommitSuggestion {
  message: string;
  type: 'feat' | 'fix' | 'refactor' | 'docs' | 'style' | 'test' | 'chore';
  scope?: string;
  body?: string;
  confidence: number;
}

export interface StagedChanges {
  files: string[];
  additions: number;
  deletions: number;
  diff: string;
}

export class CommitAgent {
  private genai: GoogleGenAI;
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string, apiKey: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Get staged changes summary
   */
  async getStagedChanges(): Promise<StagedChanges> {
    const diff = await this.git.diff(['--staged']);
    const diffStat = await this.git.diff(['--staged', '--stat']);
    const stagedFiles = await this.git.diff(['--staged', '--name-only']);

    const files = stagedFiles.trim().split('\n').filter(f => f);
    
    // Parse stats
    const addMatch = diffStat.match(/(\d+) insertions?/);
    const delMatch = diffStat.match(/(\d+) deletions?/);

    return {
      files,
      additions: addMatch ? parseInt(addMatch[1], 10) : 0,
      deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
      diff: diff.substring(0, 8000) // Limit diff size for API
    };
  }

  /**
   * Generate commit message suggestions
   */
  async generateCommitMessage(changes?: StagedChanges): Promise<CommitSuggestion[]> {
    if (!changes) {
      changes = await this.getStagedChanges();
    }

    if (changes.files.length === 0) {
      throw new Error('No staged changes found');
    }

    const prompt = `You are an expert at writing clear, concise git commit messages following Conventional Commits format.

Analyze these staged changes and generate 3 commit message suggestions:

## Staged Files
${changes.files.join('\n')}

## Changes Summary
- ${changes.additions} additions
- ${changes.deletions} deletions

## Diff (truncated)
\`\`\`diff
${changes.diff.substring(0, 6000)}
\`\`\`

## Response Format (JSON)
Return exactly 3 suggestions as a JSON array:
[
  {
    "message": "feat(auth): add OAuth2 login support",
    "type": "feat",
    "scope": "auth",
    "body": "Optional longer description of the change",
    "confidence": 95
  }
]

## Commit Types
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- docs: Documentation
- style: Formatting, no code change
- test: Adding tests
- chore: Maintenance

## Rules
• Keep message under 72 characters
• Use imperative mood ("add" not "added")
• Be specific about what changed
• Scope should be component/module name
• Confidence is 0-100 based on how clear the intent is`;

    try {
      const response = await this.genai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.3,
          thinkingConfig: {
            thinkingBudget: 4096
          }
        }
      });

      const text = response.text || '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]) as CommitSuggestion[];
        return suggestions.slice(0, 3);
      }

      // Fallback suggestion
      return [{
        message: `chore: update ${changes.files.length} file(s)`,
        type: 'chore',
        confidence: 50
      }];

    } catch (error) {
      // Return basic suggestion on error
      const mainFile = changes.files[0] || 'files';
      return [{
        message: `chore: update ${mainFile}`,
        type: 'chore',
        confidence: 30
      }];
    }
  }

  /**
   * Generate a conventional commit message string
   */
  formatCommitMessage(suggestion: CommitSuggestion): string {
    let message = suggestion.message;
    if (suggestion.body) {
      message += '\n\n' + suggestion.body;
    }
    return message;
  }
}
