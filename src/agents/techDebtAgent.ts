/**
 * Tech Debt Score Agent
 * Analyzes code and calculates technical debt score using AI
 */

import { GoogleGenAI } from '@google/genai';
import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

export interface TechDebtScore {
  overallScore: number;  // 0-100, higher = more debt
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: TechDebtFactor[];
  suggestions: string[];
  summary: string;
}

export interface TechDebtFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  icon: string;
}

export interface FileDebtAnalysis {
  filePath: string;
  debtScore: number;
  issues: string[];
  lastModified: Date;
  authors: string[];
  complexity: 'low' | 'medium' | 'high';
}

export class TechDebtAgent {
  private genai: GoogleGenAI;
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string, apiKey: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.genai = new GoogleGenAI({ apiKey });
  }

  /**
   * Calculate tech debt score for a file
   */
  async analyzeFile(filePath: string): Promise<FileDebtAnalysis> {
    const fullPath = path.join(this.repoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Get git history for the file
    const log = await this.git.log({ file: filePath, maxCount: 10 });
    const authors = [...new Set(log.all.map(c => c.author_name))];
    const lastModified = log.latest ? new Date(log.latest.date) : new Date();

    // Calculate metrics
    const issues: string[] = [];
    let debtScore = 0;

    // Long file penalty
    if (lines.length > 500) {
      issues.push(`Large file: ${lines.length} lines`);
      debtScore += 15;
    }

    // TODO/FIXME markers
    const todoCount = (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
    if (todoCount > 0) {
      issues.push(`${todoCount} TODO/FIXME markers`);
      debtScore += todoCount * 3;
    }

    // Commented code detection
    const commentedCode = (content.match(/\/\/.*[;{}()]/g) || []).length;
    if (commentedCode > 5) {
      issues.push(`${commentedCode} lines of commented code`);
      debtScore += 10;
    }

    // Magic numbers
    const magicNumbers = (content.match(/[^a-zA-Z0-9_](\d{3,})[^a-zA-Z0-9_]/g) || []).length;
    if (magicNumbers > 3) {
      issues.push(`${magicNumbers} magic numbers`);
      debtScore += magicNumbers * 2;
    }

    // Age penalty (files not touched in 1+ year)
    const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 365) {
      issues.push(`Not modified in ${Math.floor(daysSinceModified / 30)} months`);
      debtScore += 10;
    }

    // Many authors = potential inconsistency
    if (authors.length > 5) {
      issues.push(`${authors.length} different authors`);
      debtScore += 5;
    }

    // Determine complexity
    const complexity = debtScore > 40 ? 'high' : debtScore > 20 ? 'medium' : 'low';

    return {
      filePath,
      debtScore: Math.min(debtScore, 100),
      issues,
      lastModified,
      authors,
      complexity
    };
  }

  /**
   * Calculate overall project tech debt score
   */
  async analyzeProject(): Promise<TechDebtScore> {
    // Get source files
    const files = await this.getSourceFiles();
    const fileAnalyses: FileDebtAnalysis[] = [];

    // Analyze up to 20 files for performance
    for (const file of files.slice(0, 20)) {
      try {
        const analysis = await this.analyzeFile(file);
        fileAnalyses.push(analysis);
      } catch (e) {
        // Skip unreadable files
      }
    }

    // Calculate factors
    const factors: TechDebtFactor[] = [
      {
        name: 'Code Freshness',
        score: this.calculateFreshnessScore(fileAnalyses),
        weight: 25,
        description: 'How recently files have been updated',
        icon: ''
      },
      {
        name: 'Code Clarity',
        score: this.calculateClarityScore(fileAnalyses),
        weight: 30,
        description: 'TODOs, magic numbers, commented code',
        icon: ''
      },
      {
        name: 'File Complexity',
        score: this.calculateComplexityScore(fileAnalyses),
        weight: 25,
        description: 'File sizes and nesting depth',
        icon: ''
      },
      {
        name: 'Team Consistency',
        score: this.calculateConsistencyScore(fileAnalyses),
        weight: 20,
        description: 'Number of contributors per file',
        icon: ''
      }
    ];

    // Overall score (weighted average)
    const overallScore = Math.round(
      factors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0)
    );

    // Generate AI suggestions
    const suggestions = await this.generateSuggestions(fileAnalyses, factors);

    // Grade
    const grade = overallScore <= 20 ? 'A' : 
                  overallScore <= 40 ? 'B' :
                  overallScore <= 60 ? 'C' :
                  overallScore <= 80 ? 'D' : 'F';

    // Summary
    const summary = this.generateSummary(overallScore, grade, factors);

    return {
      overallScore,
      grade,
      factors,
      suggestions,
      summary
    };
  }

  private calculateFreshnessScore(analyses: FileDebtAnalysis[]): number {
    if (analyses.length === 0) return 50;
    const avgAge = analyses.reduce((sum, a) => {
      const days = (Date.now() - a.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.min(days / 365 * 50, 50);
    }, 0) / analyses.length;
    return Math.round(avgAge);
  }

  private calculateClarityScore(analyses: FileDebtAnalysis[]): number {
    if (analyses.length === 0) return 50;
    return Math.round(
      analyses.reduce((sum, a) => sum + a.debtScore, 0) / analyses.length
    );
  }

  private calculateComplexityScore(analyses: FileDebtAnalysis[]): number {
    if (analyses.length === 0) return 50;
    const complexCount = analyses.filter(a => a.complexity === 'high').length;
    return Math.round((complexCount / analyses.length) * 100);
  }

  private calculateConsistencyScore(analyses: FileDebtAnalysis[]): number {
    if (analyses.length === 0) return 50;
    const avgAuthors = analyses.reduce((sum, a) => sum + a.authors.length, 0) / analyses.length;
    return Math.min(Math.round(avgAuthors * 10), 100);
  }

  private async generateSuggestions(
    analyses: FileDebtAnalysis[],
    factors: TechDebtFactor[]
  ): Promise<string[]> {
    // Find worst files
    const worstFiles = analyses
      .sort((a, b) => b.debtScore - a.debtScore)
      .slice(0, 3);

    const suggestions: string[] = [];

    for (const file of worstFiles) {
      if (file.issues.length > 0) {
        suggestions.push(`• **${file.filePath}**: ${file.issues[0]}`);
      }
    }

    // Add factor-based suggestions
    const worstFactor = factors.reduce((worst, f) => f.score > worst.score ? f : worst, factors[0]);
    if (worstFactor.score > 50) {
      suggestions.push(`• Focus on improving **${worstFactor.name}** (currently ${worstFactor.score}% debt)`);
    }

    return suggestions;
  }

  private generateSummary(score: number, grade: string, factors: TechDebtFactor[]): string {
    if (grade === 'A') {
      return 'Excellent! Your codebase is well-maintained with minimal technical debt.';
    } else if (grade === 'B') {
      return 'Good shape! Minor tech debt that should be addressed during regular maintenance.';
    } else if (grade === 'C') {
      return 'Moderate tech debt. Consider dedicating time to address the highlighted issues.';
    } else if (grade === 'D') {
      return 'Significant tech debt detected. Prioritize refactoring to prevent issues.';
    } else {
      return 'Critical tech debt! The codebase needs immediate attention to remain maintainable.';
    }
  }

  private async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(path.join(this.repoPath, dir));
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(path.join(this.repoPath, fullPath));
          
          if (stat.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry)) {
              walkDir(fullPath);
            }
          } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
            files.push(fullPath);
          }
        }
      } catch (e) {
        // Skip unreadable
      }
    };

    walkDir('');
    return files;
  }
}
