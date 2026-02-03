#!/usr/bin/env node
/**
 * The Repo Archaeologist - CLI Interface
 * Command-line tool for code investigation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { Investigator } from './investigator';
import { StreamUpdate, InvestigationResult } from './agents/types';

// Load environment variables
dotenvConfig();

const program = new Command();

program
  .name('repo-archaeologist')
  .description('Git blame tells you WHO. We tell you WHY.')
  .version('0.1.0');

program
  .command('investigate')
  .description('Investigate a code snippet to understand WHY it exists')
  .argument('<file>', 'Path to the file to investigate')
  .option('-l, --line <number>', 'Line number to focus on', '1')
  .option('-s, --start <number>', 'Start line of selection')
  .option('-e, --end <number>', 'End line of selection')
  .option('--thinking <level>', 'Thinking level (low, medium, high)', 'high')
  .option('--debug', 'Show debug information including thought signatures')
  .option('-o, --output <file>', 'Output markdown file')
  .action(async (file: string, options: any) => {
    const spinner = ora('Initializing investigation...').start();

    try {
      // Validate API key
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        spinner.fail('GEMINI_API_KEY not found in environment');
        console.log(chalk.yellow('\nSet your API key:'));
        console.log(chalk.gray('  export GEMINI_API_KEY=your_key_here'));
        console.log(chalk.gray('  # or add to .env file'));
        process.exit(1);
      }

      // Resolve file path
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        spinner.fail(`File not found: ${filePath}`);
        process.exit(1);
      }

      // Read file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      // Determine line range
      const startLine = parseInt(options.start || options.line, 10);
      const endLine = parseInt(options.end || options.line, 10);

      if (startLine < 1 || endLine > lines.length) {
        spinner.fail(`Invalid line range: ${startLine}-${endLine} (file has ${lines.length} lines)`);
        process.exit(1);
      }

      // Extract code snippet
      const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');

      // Find repo root
      const repoPath = findRepoRoot(filePath);
      if (!repoPath) {
        spinner.fail('Not in a git repository');
        process.exit(1);
      }

      spinner.text = 'Gathering evidence...';

      // Create investigator with streaming updates
      const investigator = new Investigator({
        geminiApiKey,
        githubToken: process.env.GITHUB_TOKEN,
        thinkingLevel: options.thinking as 'low' | 'medium' | 'high',
        onUpdate: (update: StreamUpdate) => {
          const badge = update.thinkingBadge 
            ? chalk.magenta(`[THINKING: ${update.thinkingBadge}]`) 
            : '';
          spinner.text = `${update.message} ${badge} (${update.progress}%)`;
        }
      });

      // Run investigation
      const result = await investigator.investigate({
        text: codeSnippet,
        filePath: path.relative(repoPath, filePath),
        lineStart: startLine,
        lineEnd: endLine,
        repoPath
      });

      spinner.succeed('Investigation complete!');
      console.log('');

      // Display results
      displayResults(result, options.debug);

      // Output to file if requested
      if (options.output) {
        const markdown = investigator.generateMarkdownExport(result);
        fs.writeFileSync(options.output, markdown.content);
        console.log(chalk.green(`\n✓ Report saved to ${options.output}`));
      }

      // Show thought chain in debug mode
      if (options.debug && result.thoughtChain.signatures.length > 0) {
        console.log(chalk.gray('\n--- Thought Signature Chain ---'));
        result.thoughtChain.signatures.forEach((sig, i) => {
          console.log(chalk.gray(`  ${i + 1}. [${sig.agentId}] ${sig.signature}`));
        });
      }

    } catch (error) {
      spinner.fail('Investigation failed');
      console.error(chalk.red(`\nError: ${error}`));
      if (options.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program
  .command('blame')
  .description('Quick blame lookup for a specific line')
  .argument('<file>', 'Path to the file')
  .argument('<line>', 'Line number')
  .action(async (file: string, line: string) => {
    const { HistorianAgent } = await import('./agents/historian');
    
    const filePath = path.resolve(file);
    const repoPath = findRepoRoot(filePath);
    
    if (!repoPath) {
      console.error(chalk.red('Not in a git repository'));
      process.exit(1);
    }

    try {
      const historian = new HistorianAgent(repoPath);
      const result = await historian.getBlame(path.relative(repoPath, filePath), parseInt(line, 10));
      
      console.log(chalk.bold('\nBlame Result:'));
      console.log(chalk.gray('  Commit:'), result.data.commitHash.substring(0, 7));
      console.log(chalk.gray('  Author:'), result.data.author);
      console.log(chalk.gray('  Date:'), result.data.timestamp.toISOString().split('T')[0]);
      console.log(chalk.gray('  Line:'), result.data.lineContent);
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program.parse();

// ============================================
// Helper Functions
// ============================================

function findRepoRoot(startPath: string): string | null {
  let current = path.dirname(startPath);
  
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }
  
  return null;
}

function displayResults(result: InvestigationResult, debug: boolean): void {
  // Header
  console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║       THE REPO ARCHAEOLOGIST - INVESTIGATION         ║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════╝'));
  console.log('');

  // Confidence
  const confidenceColor = result.confidence >= 70 
    ? chalk.green 
    : result.confidence >= 40 
      ? chalk.yellow 
      : chalk.red;
  console.log(chalk.bold('Confidence:'), confidenceColor(`${result.confidence}%`));
  console.log('');

  // Summary
  console.log(chalk.bold.underline('Summary'));
  console.log(result.summary);
  console.log('');

  // Narrative (truncated for CLI)
  console.log(chalk.bold.underline('Investigation Findings'));
  const narrative = result.narrative.length > 2000 
    ? result.narrative.substring(0, 2000) + '...\n(truncated - use --output to see full report)'
    : result.narrative;
  console.log(narrative);
  console.log('');

  // Sources
  if (result.sources.length > 0) {
    console.log(chalk.bold.underline('Sources'));
    result.sources.forEach(s => {
      const link = s.url ? chalk.cyan.underline(s.url) : '';
      console.log(`  • ${chalk.bold(s.type.toUpperCase())} ${s.id}: ${s.description} ${link}`);
    });
    console.log('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log(chalk.bold.underline('Recommendations'));
    result.recommendations.forEach(r => {
      const actionColor = {
        keep: chalk.green,
        refactor: chalk.yellow,
        document: chalk.blue,
        remove: chalk.red,
        investigate: chalk.magenta
      }[r.action];
      console.log(`  • ${actionColor(r.action.toUpperCase())} (${r.priority}): ${r.reason}`);
    });
    console.log('');
  }

  // Timeline (brief)
  if (result.timeline.length > 0) {
    console.log(chalk.bold.underline('Timeline'));
    result.timeline.slice(0, 5).forEach(e => {
      const date = e.date.toISOString().split('T')[0];
      console.log(`  ${chalk.gray(date)} ${e.title.substring(0, 50)} ${chalk.gray(`by ${e.author}`)}`);
    });
    if (result.timeline.length > 5) {
      console.log(chalk.gray(`  ... and ${result.timeline.length - 5} more events`));
    }
  }
}
