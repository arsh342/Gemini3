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

// ============================================
// MARATHON AGENT COMMANDS
// ============================================

program
  .command('deep-dive')
  .description('Autonomous deep dive - explores dependencies and builds complete case')
  .argument('<file>', 'Path to the file to start from')
  .option('-l, --line <number>', 'Line number to focus on', '1')
  .option('-d, --depth <number>', 'Max dependency depth to explore', '3')
  .option('-m, --max-files <number>', 'Max files to explore', '10')
  .option('--verify', 'Enable self-verification loop')
  .option('-o, --output <file>', 'Output markdown file')
  .action(async (file: string, options: any) => {
    const spinner = ora('Starting autonomous deep dive...').start();
    
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        spinner.fail('GEMINI_API_KEY not found');
        process.exit(1);
      }

      const { DeepDiveAgent } = await import('./agents/deepDive');
      
      const filePath = path.resolve(file);
      const repoPath = findRepoRoot(filePath);
      if (!repoPath) {
        spinner.fail('Not in a git repository');
        process.exit(1);
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      const startLine = parseInt(options.line, 10);

      const agent = new DeepDiveAgent({
        geminiApiKey,
        githubToken: process.env.GITHUB_TOKEN,
        maxDepth: parseInt(options.depth, 10),
        maxFilesToExplore: parseInt(options.maxFiles, 10),
        verifyFindings: options.verify,
        onProgress: (update) => {
          const status = update.verificationStatus 
            ? chalk.cyan(`[${update.verificationStatus.toUpperCase()}]`)
            : '';
          spinner.text = `${update.message} ${status} (${update.filesExplored}/${update.totalFiles} files)`;
        }
      });

      const result = await agent.deepDive(
        {
          text: lines.slice(startLine - 1, startLine + 10).join('\n'),
          filePath: path.relative(repoPath, filePath),
          lineStart: startLine,
          lineEnd: startLine + 10,
          repoPath
        },
        repoPath
      );

      spinner.succeed(`Deep dive complete! Explored ${result.totalFilesExplored} files in ${(result.totalTimeMs / 1000).toFixed(1)}s`);
      
      console.log('');
      console.log(chalk.bold.blue('═══════════════════════════════════════'));
      console.log(chalk.bold.blue('      AUTONOMOUS DEEP DIVE REPORT      '));
      console.log(chalk.bold.blue('═══════════════════════════════════════'));
      console.log('');
      
      console.log(chalk.bold('📊 Stats'));
      console.log(`  Files explored: ${result.totalFilesExplored}`);
      console.log(`  Time: ${(result.totalTimeMs / 1000).toFixed(1)}s`);
      console.log(`  Thought chain length: ${result.thoughtChainLength}`);
      console.log('');
      
      console.log(chalk.bold('🎯 Main Investigation'));
      console.log(`  Confidence: ${result.mainInvestigation.confidence}%`);
      console.log(`  Summary: ${result.mainInvestigation.summary}`);
      console.log('');

      if (result.verificationReport.linksChecked.length > 0) {
        console.log(chalk.bold('✅ Verification'));
        console.log(`  Claims verified: ${result.verificationReport.claimsVerified}`);
        console.log(`  Claims failed: ${result.verificationReport.claimsFailed}`);
        console.log(`  Adjusted confidence: ${result.verificationReport.overallConfidence}%`);
      }

      if (options.output) {
        let report = `# Deep Dive Report\n\n`;
        report += `**Files Explored:** ${result.totalFilesExplored}\n`;
        report += `**Time:** ${(result.totalTimeMs / 1000).toFixed(1)}s\n\n`;
        report += `## Main Investigation\n\n${result.mainInvestigation.narrative}\n\n`;
        
        if (result.relatedInvestigations.size > 0) {
          report += `## Related Files\n\n`;
          for (const [file, inv] of result.relatedInvestigations) {
            report += `### ${file}\n${inv.summary}\n\n`;
          }
        }
        
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`\n✓ Report saved to ${options.output}`));
      }

    } catch (error) {
      spinner.fail('Deep dive failed');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch mode - continuously monitor repository for new commits')
  .argument('[path]', 'Path to repository to watch', '.')
  .option('-i, --interval <ms>', 'Poll interval in milliseconds', '30000')
  .option('--investigate', 'Automatically investigate new commits')
  .option('--detect-suspicious', 'Detect suspicious patterns in changes')
  .action(async (repoPath: string, options: any) => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error(chalk.red('GEMINI_API_KEY not found'));
      process.exit(1);
    }

    const { WatchModeAgent } = await import('./agents/watchMode');
    
    const fullPath = path.resolve(repoPath);
    if (!fs.existsSync(path.join(fullPath, '.git'))) {
      console.error(chalk.red('Not a git repository'));
      process.exit(1);
    }

    console.log(chalk.bold.blue('\n🔍 THE REPO ARCHAEOLOGIST - WATCH MODE\n'));
    
    const agent = new WatchModeAgent(fullPath, {
      geminiApiKey,
      githubToken: process.env.GITHUB_TOKEN,
      pollIntervalMs: parseInt(options.interval, 10),
      investigateNewCommits: options.investigate,
      investigateSuspiciousPatterns: options.detectSuspicious,
      onNewCommit: (commit) => {
        console.log(chalk.green(`\n📝 New commit: ${commit.hash.substring(0, 7)}`));
        console.log(chalk.gray(`   ${commit.author}: ${commit.message.substring(0, 60)}`));
      },
      onSuspiciousChange: (alert) => {
        const colors = { low: chalk.yellow, medium: chalk.magenta, high: chalk.red };
        console.log(colors[alert.severity](`⚠️  ${alert.description}`));
        console.log(chalk.gray(`   ${alert.file}:${alert.line}`));
      },
      onInvestigationComplete: (result) => {
        console.log(chalk.cyan(`✅ Investigation: ${result.investigation.confidence}% confidence`));
        console.log(chalk.gray(`   ${result.investigation.summary.substring(0, 100)}...`));
      }
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nStopping watch mode...'));
      agent.stop();
      
      const history = agent.getHistory();
      if (history.length > 0) {
        console.log(chalk.bold('\n📊 Session Summary'));
        console.log(`  Investigations completed: ${history.length}`);
        
        const report = agent.generateReport();
        const reportPath = 'watch-report.md';
        fs.writeFileSync(reportPath, report);
        console.log(chalk.green(`  Report saved to: ${reportPath}`));
      }
      
      process.exit(0);
    });

    await agent.start();
    console.log(chalk.gray('\nPress Ctrl+C to stop watching\n'));
  });

// ============================================
// CONFLICT RESOLVER COMMAND
// ============================================

program
  .command('resolve-conflicts')
  .description('Auto-resolve git merge conflicts using AI analysis')
  .argument('[path]', 'Path to repository', '.')
  .option('--apply', 'Automatically apply high-confidence resolutions')
  .option('--preview', 'Preview resolutions without applying')
  .option('-o, --output <file>', 'Save resolution report to file')
  .action(async (repoPath: string, options: any) => {
    const spinner = ora('Scanning for merge conflicts...').start();
    
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        spinner.fail('GEMINI_API_KEY not found');
        process.exit(1);
      }

      const { ConflictResolverAgent } = await import('./agents/conflictResolver');
      
      const fullPath = path.resolve(repoPath);
      if (!fs.existsSync(path.join(fullPath, '.git'))) {
        spinner.fail('Not a git repository');
        process.exit(1);
      }

      const resolver = new ConflictResolverAgent(fullPath, {
        geminiApiKey,
        autoApply: options.apply && !options.preview,
        onProgress: (update) => {
          const stats = update.conflictsFound 
            ? `(${update.conflictsResolved || 0}/${update.conflictsFound})`
            : '';
          spinner.text = `${update.message} ${stats}`;
        },
        onResolved: (result) => {
          const statusIcon = result.confidence >= 70 ? '✅' : '⚠️';
          console.log(`\n${statusIcon} ${result.conflict.file}:${result.conflict.startLine}`);
          console.log(chalk.gray(`   Strategy: ${result.strategy} | Confidence: ${result.confidence}%`));
          console.log(chalk.gray(`   ${result.reasoning.substring(0, 80)}...`));
        }
      });

      const report = options.preview 
        ? await resolver.preview()
        : await resolver.resolveAll();

      spinner.succeed(`Processed ${report.totalConflicts} conflicts`);

      console.log('');
      console.log(chalk.bold.blue('═══════════════════════════════════════'));
      console.log(chalk.bold.blue('     CONFLICT RESOLUTION REPORT        '));
      console.log(chalk.bold.blue('═══════════════════════════════════════'));
      console.log('');
      
      console.log(chalk.bold('📊 Summary'));
      console.log(`  Total conflicts: ${report.totalConflicts}`);
      console.log(`  Resolved: ${chalk.green(report.resolved.toString())}`);
      console.log(`  Failed: ${chalk.red(report.failed.toString())}`);
      console.log('');

      if (report.resolutions.length > 0) {
        console.log(chalk.bold('📝 Resolutions'));
        for (const res of report.resolutions) {
          const applied = res.appliedAt ? chalk.green('APPLIED') : chalk.yellow('PENDING');
          const confColor = res.confidence >= 70 ? chalk.green : res.confidence >= 40 ? chalk.yellow : chalk.red;
          console.log(`  ${res.conflict.file}:${res.conflict.startLine}`);
          console.log(`    Strategy: ${res.strategy} | Confidence: ${confColor(res.confidence + '%')} | ${applied}`);
        }
      }

      if (options.output) {
        const reportMd = resolver.generateReport(report);
        fs.writeFileSync(options.output, reportMd);
        console.log(chalk.green(`\n✓ Report saved to ${options.output}`));
      }

      if (!options.apply && report.resolutions.some(r => !r.appliedAt)) {
        console.log(chalk.yellow('\n💡 Run with --apply to automatically apply high-confidence resolutions'));
      }

    } catch (error) {
      spinner.fail('Conflict resolution failed');
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