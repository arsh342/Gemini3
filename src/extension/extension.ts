/**
 * Code Detective - VS Code Extension
 * Main extension entry point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Investigator } from '../investigator';
import { StreamUpdate, InvestigationResult } from '../agents/types';

let investigationPanel: vscode.WebviewPanel | undefined;

// Investigation History Item
interface HistoryItem {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  summary: string;
  confidence: number;
  timestamp: Date;
  result?: InvestigationResult;
}

// Store investigations in memory (persists per session)
const investigationHistory: HistoryItem[] = [];

// Tree Item for history
class HistoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly item: HistoryItem
  ) {
    super(
      `${path.basename(item.filePath)}:${item.lineStart}`,
      vscode.TreeItemCollapsibleState.None
    );
    
    this.description = `${item.confidence}% • ${this.formatTime(item.timestamp)}`;
    this.tooltip = item.summary;
    this.iconPath = new vscode.ThemeIcon(
      item.confidence >= 90 ? 'pass' : item.confidence >= 70 ? 'warning' : 'error'
    );
    
    this.command = {
      command: 'codeDetective.showHistoryItem',
      title: 'Show Investigation',
      arguments: [item]
    };
  }
  
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }
}

// Investigation History Provider
class InvestigationHistoryProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HistoryTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HistoryTreeItem[] {
    return investigationHistory
      .slice()
      .reverse()
      .map(item => new HistoryTreeItem(item));
  }
}

// Export for use in other functions
let historyProvider: InvestigationHistoryProvider;

function addToHistory(result: InvestigationResult, filePath: string, lineStart: number, lineEnd: number) {
  const item: HistoryItem = {
    id: `${Date.now()}`,
    filePath,
    lineStart,
    lineEnd,
    summary: result.summary.substring(0, 100) + (result.summary.length > 100 ? '...' : ''),
    confidence: result.confidence,
    timestamp: new Date(),
    result
  };
  
  investigationHistory.push(item);
  
  // Keep only last 50 investigations
  if (investigationHistory.length > 50) {
    investigationHistory.shift();
  }
  
  historyProvider?.refresh();
}

// Sidebar Webview Provider
class RepoArchaeologistSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeDetective.actions';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlContent();

    // Handle messages from sidebar
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'investigate':
          vscode.commands.executeCommand('codeDetective.investigate');
          break;
        case 'deepDive':
          vscode.commands.executeCommand('codeDetective.deepDive');
          break;
        case 'resolveConflicts':
          vscode.commands.executeCommand('codeDetective.resolveConflicts');
          break;
        case 'watchMode':
          vscode.commands.executeCommand('codeDetective.watchMode');
          break;
        case 'blame':
          vscode.commands.executeCommand('codeDetective.blame');
          break;
        case 'timeline':
          vscode.commands.executeCommand('codeDetective.timeline');
          break;
        case 'techDebt':
          vscode.commands.executeCommand('codeDetective.techDebt');
          break;
        case 'generateCommit':
          vscode.commands.executeCommand('codeDetective.generateCommit');
          break;
        case 'whoKnowsWhat':
          vscode.commands.executeCommand('codeDetective.whoKnowsWhat');
          break;
        case 'onboarding':
          vscode.commands.executeCommand('codeDetective.onboarding');
          break;
        case 'exportMarkdown':
          vscode.commands.executeCommand('codeDetective.exportMarkdown');
          break;
      }
    });
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css">
      <style>
        body {
          font-family: var(--vscode-font-family);
          background: var(--vscode-sideBar-background);
          padding: 16px;
          color: var(--vscode-foreground);
          margin: 0;
        }
        
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
        }
        
        .title {
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-foreground);
        }
        
        .section {
          margin-bottom: 16px;
        }
        
        .section-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          margin-bottom: 4px;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          transition: background 0.15s;
        }
        
        .btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        .desc {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          margin-top: -2px;
          margin-bottom: 8px;
          padding-left: 24px;
        }
        
        .codicon { font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <i class="codicon codicon-book"></i>
        <span class="title">Code Detective</span>
      </div>
      
      <div class="section">
        <div class="section-title">Investigation</div>
        <button class="btn btn-primary" onclick="send('investigate')">
          <i class="codicon codicon-search"></i> Investigate Selection
        </button>
        <div class="desc">Understand WHY selected code exists</div>
        
        <button class="btn" onclick="send('deepDive')">
          <i class="codicon codicon-telescope"></i> Deep Dive
        </button>
        <div class="desc">Follow dependencies, build complete case</div>
      </div>
      
      <div class="section">
        <div class="section-title">Monitoring</div>
        <button class="btn" onclick="send('watchMode')">
          <i class="codicon codicon-eye"></i> Watch Mode
        </button>
        <div class="desc">Monitor commits for suspicious changes</div>
      </div>
      
      <div class="section">
        <div class="section-title">Git Tools</div>
        <button class="btn" onclick="send('resolveConflicts')">
          <i class="codicon codicon-git-merge"></i> Resolve Conflicts
        </button>
        <div class="desc">AI-powered conflict resolution</div>
        
        <button class="btn" onclick="send('blame')">
          <i class="codicon codicon-git-commit"></i> Quick Blame
        </button>
        <div class="desc">Git blame for current line</div>
        
        <button class="btn" onclick="send('generateCommit')">
          <i class="codicon codicon-edit"></i> Generate Commit
        </button>
        <div class="desc">AI writes commit message</div>
      </div>
      
      <div class="section">
        <div class="section-title">Analysis</div>
        <button class="btn" onclick="send('timeline')">
          <i class="codicon codicon-history"></i> Code Timeline
        </button>
        <div class="desc">Visual history of code evolution</div>
        
        <button class="btn" onclick="send('techDebt')">
          <i class="codicon codicon-warning"></i> Tech Debt Score
        </button>
        <div class="desc">Analyze technical debt</div>
        
        <button class="btn" onclick="send('whoKnowsWhat')">
          <i class="codicon codicon-organization"></i> Who Knows What
        </button>
        <div class="desc">Expertise map by contributor</div>
        
        <button class="btn" onclick="send('onboarding')">
          <i class="codicon codicon-book"></i> Onboarding Docs
        </button>
        <div class="desc">Generate docs for any folder</div>
      </div>
      
      <div class="section">
        <div class="section-title">Export</div>
        <button class="btn" onclick="send('exportMarkdown')">
          <i class="codicon codicon-markdown"></i> Export to Markdown
        </button>
        <div class="desc">Save last investigation</div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        function send(command) {
          vscode.postMessage({ command });
        }
      </script>
    </body>
    </html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Code Detective is now active!');

  // Register sidebar provider
  const sidebarProvider = new RepoArchaeologistSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RepoArchaeologistSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register Investigation History provider
  historyProvider = new InvestigationHistoryProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('codeDetective.history', historyProvider)
  );

  // Command to show a history item
  context.subscriptions.push(
    vscode.commands.registerCommand('codeDetective.showHistoryItem', async (item: HistoryItem) => {
      if (item.result) {
        // Try to open the file
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const fullPath = path.join(workspaceFolder.uri.fsPath, item.filePath);
            const doc = await vscode.workspace.openTextDocument(fullPath);
            const editor = await vscode.window.showTextDocument(doc);
            
            const startPos = new vscode.Position(item.lineStart - 1, 0);
            const endPos = new vscode.Position(item.lineEnd, 0);
            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
          }
        } catch (e) {
          // File may have been deleted
        }
        
        // Show summary in info message
        vscode.window.showInformationMessage(
          `${item.confidence}% confidence: ${item.summary}`
        );
      }
    })
  );

  // Register the investigate command
  const investigateCommand = vscode.commands.registerCommand(
    'codeDetective.investigate',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage('Please select some code to investigate');
        return;
      }

      await startInvestigation(context, editor, selection);
    }
  );

  // Register deep dive command
  const deepDiveCommand = vscode.commands.registerCommand(
    'codeDetective.deepDive',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage('Please select some code to deep dive into');
        return;
      }

      // Get configuration
      const config = vscode.workspace.getConfiguration('codeDetective');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        const action = await vscode.window.showErrorMessage(
          'Gemini API key not configured',
          'Open Settings'
        );
        if (action === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'codeDetective.geminiApiKey'
          );
        }
        return;
      }

      // Get workspace folder
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      // Create results panel
      const panel = vscode.window.createWebviewPanel(
        'codeDetectiveDeepDive',
        'Deep Dive Results',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );

      const selectedText = editor.document.getText(selection);
      const filePath = editor.document.fileName;
      const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

      // Show loading state
      panel.webview.html = getDeepDiveLoadingHtml(relativePath, selection.start.line + 1);

      try {
        // Run deep dive investigation
        const investigator = new Investigator({
          geminiApiKey,
          githubToken: config.get<string>('githubToken'),
          thinkingLevel: 'high',
          onUpdate: (update) => {
            panel.webview.postMessage({ type: 'progress', data: update });
          }
        });

        const result = await investigator.investigate({
          text: selectedText,
          filePath: relativePath,
          lineStart: selection.start.line + 1,
          lineEnd: selection.end.line + 1,
          repoPath: workspaceFolder.uri.fsPath
        });

        // Show results
        panel.webview.html = getDeepDiveResultsHtml(result, relativePath);

      } catch (error) {
        panel.webview.html = getDeepDiveErrorHtml(String(error));
      }
    }
  );

  // Register resolve conflicts command
  const resolveConflictsCommand = vscode.commands.registerCommand(
    'codeDetective.resolveConflicts',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeDetective');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        vscode.window.showErrorMessage('Gemini API key not configured');
        return;
      }

      // Create results panel
      const panel = vscode.window.createWebviewPanel(
        'codeDetectiveConflicts',
        'Conflict Resolution',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );

      panel.webview.html = getVSCodeThemedHtml('Scanning for Conflicts', `
        <div style="text-align: center; padding: 40px;">
          <div class="loader"></div>
          <p>Scanning repository for merge conflicts...</p>
        </div>
      `);

      try {
        const { ConflictResolverAgent } = await import('../agents/conflictResolver');
        
        const resolver = new ConflictResolverAgent(workspaceFolder.uri.fsPath, {
          geminiApiKey,
          autoApply: config.get<boolean>('autoApplyConflicts') || false,
          onProgress: (update) => {
            panel.webview.postMessage({ type: 'progress', data: update });
          }
        });

        const report = await resolver.preview();

        if (report.totalConflicts === 0) {
          panel.webview.html = getVSCodeThemedHtml('No Conflicts Found', `
            <div style="text-align: center; padding: 60px;">
              <span style="font-size: 48px;">✅</span>
              <h2>No Merge Conflicts</h2>
              <p style="color: var(--vscode-descriptionForeground);">Your repository is conflict-free!</p>
            </div>
          `);
        } else {
          const resolutionsHtml = report.resolutions.map(r => `
            <div class="card">
              <div class="card-header">
                <span class="file-path">${r.conflict.file}:${r.conflict.startLine}</span>
                <span class="badge ${r.confidence >= 70 ? 'success' : 'warning'}">${r.confidence}% confidence</span>
              </div>
              <div class="card-body">
                <strong>Strategy:</strong> ${r.strategy}<br>
                <strong>Reasoning:</strong> ${r.reasoning}
              </div>
              <pre class="code-block">${escapeHtml(r.resolution.substring(0, 500))}</pre>
            </div>
          `).join('');

          panel.webview.html = getVSCodeThemedHtml('Conflict Resolution', `
            <h2>${report.totalConflicts} Conflicts Found</h2>
            <p>Proposed resolutions:</p>
            ${resolutionsHtml}
            <button class="btn" onclick="applyAll()">Apply High-Confidence Resolutions</button>
          `);
        }
      } catch (error) {
        panel.webview.html = getVSCodeThemedHtml('Error', `
          <div class="error-box">
            <h3>Failed to scan for conflicts</h3>
            <p>${escapeHtml(String(error))}</p>
          </div>
        `);
      }
    }
  );

  // Register watch mode command
  const watchModeCommand = vscode.commands.registerCommand(
    'codeDetective.watchMode',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeDetective');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        vscode.window.showErrorMessage('Gemini API key not configured');
        return;
      }

      const action = await vscode.window.showInformationMessage(
        'Start Watch Mode? Monitor for new commits, check remote sync status, and detect potential merge conflicts.',
        'Start Monitoring', 'Cancel'
      );

      if (action === 'Start Monitoring') {
        const config = vscode.workspace.getConfiguration('codeDetective');
        const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          vscode.window.showErrorMessage('Gemini API key required. Set codeDetective.geminiApiKey in settings.');
          return;
        }

        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = '$(eye) Watching...';
        statusBarItem.tooltip = 'Code Detective: Monitoring for commits and remote changes';
        statusBarItem.show();

        try {
          const { WatchModeAgent } = await import('../agents/watchMode');
          
          const watchAgent = new WatchModeAgent(workspaceFolder.uri.fsPath, {
            geminiApiKey: apiKey,
            pollIntervalMs: 30000,
            investigateNewCommits: true,
            investigateSuspiciousPatterns: true,
            checkRemoteChanges: true,
            checkMergeConflicts: true,
            autoFetchInterval: 60000,
            onRemoteSync: (status) => {
              if (status.needsPull) {
                statusBarItem.text = `$(arrow-down) ${status.incomingCommits} incoming`;
                vscode.window.showInformationMessage(
                  `⬇️ ${status.incomingCommits} new commit(s) available from remote. Pull recommended.`,
                  'Pull Now'
                ).then(choice => {
                  if (choice === 'Pull Now') {
                    vscode.commands.executeCommand('git.pull');
                  }
                });
              }
              if (status.needsPush) {
                statusBarItem.text = `$(arrow-up) ${status.outgoingCommits} to push`;
                vscode.window.showInformationMessage(
                  `⬆️ ${status.outgoingCommits} local commit(s) ready to push.`,
                  'Push Now'
                ).then(choice => {
                  if (choice === 'Push Now') {
                    vscode.commands.executeCommand('git.push');
                  }
                });
              }
              if (!status.needsPull && !status.needsPush) {
                statusBarItem.text = '$(check) Synced';
              }
            },
            onMergeConflict: (conflict) => {
              if (conflict.type === 'potential_conflict') {
                vscode.window.showWarningMessage(
                  `⚠️ Potential merge conflict in ${conflict.conflictingFiles.length} file(s): ${conflict.conflictingFiles.slice(0, 2).join(', ')}`,
                  'View Files', 'Resolve with AI'
                ).then(choice => {
                  if (choice === 'Resolve with AI') {
                    vscode.commands.executeCommand('codeDetective.resolveConflicts');
                  } else if (choice === 'View Files') {
                    if (conflict.conflictingFiles[0]) {
                      vscode.workspace.openTextDocument(
                        path.join(workspaceFolder.uri.fsPath, conflict.conflictingFiles[0])
                      ).then(doc => vscode.window.showTextDocument(doc));
                    }
                  }
                });
              } else if (conflict.type === 'actual_conflict') {
                vscode.window.showErrorMessage(
                  `❌ Active merge conflict in ${conflict.conflictingFiles.length} file(s). Resolution required.`,
                  'Resolve with AI'
                ).then(choice => {
                  if (choice === 'Resolve with AI') {
                    vscode.commands.executeCommand('codeDetective.resolveConflicts');
                  }
                });
              }
            },
            onNewCommit: (commit) => {
              statusBarItem.text = `$(git-commit) Investigating...`;
            },
            onInvestigationComplete: (result) => {
              statusBarItem.text = '$(eye) Watching...';
              vscode.window.showInformationMessage(
                `🔍 Investigated ${result.commit.hash.substring(0, 7)}: ${result.investigation.summary.substring(0, 80)}...`
              );
            }
          });

          await watchAgent.start();

          // Store for cleanup
          context.subscriptions.push({
            dispose: () => {
              watchAgent.stop();
              statusBarItem.dispose();
            }
          });
          context.subscriptions.push(statusBarItem);

          vscode.window.showInformationMessage(
            '✅ Watch Mode active. Monitoring commits, remote sync, and merge conflicts.'
          );
        } catch (error) {
          statusBarItem.dispose();
          vscode.window.showErrorMessage(`Failed to start Watch Mode: ${error}`);
        }
      }
    }
  );

  // Register quick blame command - FULL IMPLEMENTATION
  const blameCommand = vscode.commands.registerCommand(
    'codeDetective.blame',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      const line = editor.selection.active.line + 1;
      const filePath = editor.document.fileName;
      const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

      try {
        const { HistorianAgent } = await import('../agents/historian');
        const historian = new HistorianAgent(workspaceFolder.uri.fsPath);
        
        const result = await historian.getBlame(relativePath, line);
        const blame = result.data;

        // Show inline decoration
        const decorationType = vscode.window.createTextEditorDecorationType({
          after: {
            contentText: `  ← ${blame.author} • ${formatDate(blame.timestamp)} • ${blame.commitHash.substring(0, 7)}`,
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            fontStyle: 'italic',
            margin: '0 0 0 20px'
          }
        });

        const range = new vscode.Range(line - 1, 0, line - 1, editor.document.lineAt(line - 1).text.length);
        editor.setDecorations(decorationType, [range]);

        // Clear after 10 seconds
        setTimeout(() => {
          decorationType.dispose();
        }, 10000);

        // Also show quick pick with more details
        const selected = await vscode.window.showQuickPick([
          { label: `$(git-commit) ${blame.commitHash.substring(0, 7)}`, description: 'Commit hash' },
          { label: `$(person) ${blame.author}`, description: 'Author' },
          { label: `$(calendar) ${formatDate(blame.timestamp)}`, description: 'Date' },
          { label: '$(search) Investigate this commit', description: 'Deep dive into why this code exists' }
        ], {
          placeHolder: `Blame for line ${line}`
        });

        if (selected?.label.includes('Investigate')) {
          // Trigger investigation for this line
          vscode.commands.executeCommand('codeDetective.investigate');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Blame failed: ${error}`);
      }
    }
  );

  // Register Code Timeline command
  const timelineCommand = vscode.commands.registerCommand(
    'codeDetective.timeline',
    async () => {
      const editor = vscode.window.activeTextEditor;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building Code Timeline...',
        cancellable: false
      }, async () => {
        try {
          const { TimelineAgent } = await import('../agents/timelineAgent');
          const timeline = new TimelineAgent(workspaceFolder.uri.fsPath);
          
          let data;
          let title;
          
          if (editor) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.fileName);
            data = await timeline.getFileTimeline(relativePath);
            title = `Timeline: ${path.basename(editor.document.fileName)}`;
          } else {
            data = await timeline.getRepoTimeline(100);
            title = 'Repository Timeline';
          }
          
          const html = timeline.generateTimelineHTML(data, editor ? editor.document.fileName : undefined);
          
          // Show in webview
          const panel = vscode.window.createWebviewPanel(
            'codeTimeline',
            title,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
          );
          panel.webview.html = html;
          
        } catch (error) {
          vscode.window.showErrorMessage(`Timeline failed: ${error}`);
        }
      });
    }
  );

  // Register Tech Debt command
  const techDebtCommand = vscode.commands.registerCommand(
    'codeDetective.techDebt',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeDetective');
      const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        vscode.window.showErrorMessage('Gemini API key required');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing Tech Debt...',
        cancellable: false
      }, async () => {
        try {
          const { TechDebtAgent } = await import('../agents/techDebtAgent');
          const agent = new TechDebtAgent(workspaceFolder.uri.fsPath, apiKey);
          const result = await agent.analyzeProject();
          
          // Show result in webview
          const panel = vscode.window.createWebviewPanel(
            'techDebt',
            `Tech Debt: Grade ${result.grade}`,
            vscode.ViewColumn.Beside,
            {}
          );
          
          const gradeColor = result.grade === 'A' ? '#4ade80' : 
                            result.grade === 'B' ? '#a3e635' : 
                            result.grade === 'C' ? '#facc15' : 
                            result.grade === 'D' ? '#fb923c' : '#f87171';
          
          panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --text: var(--vscode-editor-foreground, #d4d4d4);
      --border: var(--vscode-input-border, #3c3c3c);
    }
    body { font-family: var(--vscode-font-family); background: var(--bg); color: var(--text); padding: 24px; }
    .header { display: flex; align-items: center; gap: 24px; margin-bottom: 24px; }
    .grade { font-size: 72px; font-weight: 700; color: ${gradeColor}; }
    .score { font-size: 18px; color: var(--text); }
    .summary { margin-bottom: 24px; padding: 16px; background: var(--vscode-textCodeBlock-background); border-radius: 8px; }
    .factors { display: grid; gap: 16px; }
    .factor { padding: 16px; background: var(--vscode-sideBar-background); border-radius: 8px; }
    .factor-name { font-weight: 600; margin-bottom: 8px; }
    .factor-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .factor-fill { height: 100%; background: ${gradeColor}; transition: width 0.3s; }
    .suggestions { margin-top: 24px; }
    .suggestion { padding: 8px 0; border-bottom: 1px solid var(--border); }
  </style>
</head>
<body>
  <div class="header">
    <div class="grade">${result.grade}</div>
    <div>
      <div class="score">Tech Debt Score: ${result.overallScore}/100</div>
      <div style="color: var(--vscode-descriptionForeground);">Lower is better</div>
    </div>
  </div>
  
  <div class="summary">${result.summary}</div>
  
  <h3>Factors</h3>
  <div class="factors">
    ${result.factors.map(f => `
      <div class="factor">
        <div class="factor-name">${f.name}</div>
        <div class="factor-bar"><div class="factor-fill" style="width: ${f.score}%"></div></div>
        <div style="font-size: 12px; margin-top: 4px; color: var(--vscode-descriptionForeground);">${f.description}</div>
      </div>
    `).join('')}
  </div>
  
  <div class="suggestions">
    <h3>Suggestions</h3>
    ${result.suggestions.map(s => `<div class="suggestion">${s}</div>`).join('')}
  </div>
</body>
</html>`;
          
        } catch (error) {
          vscode.window.showErrorMessage(`Tech debt analysis failed: ${error}`);
        }
      });
    }
  );

  // Register Generate Commit command
  const generateCommitCommand = vscode.commands.registerCommand(
    'codeDetective.generateCommit',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeDetective');
      const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        vscode.window.showErrorMessage('Gemini API key required');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing staged changes...',
        cancellable: false
      }, async (progress) => {
        try {
          const { CommitAgent } = await import('../agents/commitAgent');
          const agent = new CommitAgent(workspaceFolder.uri.fsPath, apiKey);
          
          const changes = await agent.getStagedChanges();
          
          if (changes.files.length === 0) {
            vscode.window.showWarningMessage('No staged changes found. Stage some changes first.');
            return;
          }

          progress.report({ message: 'Generating commit messages...' });
          const suggestions = await agent.generateCommitMessage(changes);
          
          // Show quick pick with suggestions
          const items = suggestions.map(s => ({
            label: `$(${s.type === 'feat' ? 'add' : s.type === 'fix' ? 'wrench' : 'edit'}) ${s.message}`,
            description: `${s.confidence}% confidence`,
            detail: s.body || undefined,
            suggestion: s
          }));
          
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Select a commit message (${changes.files.length} files, +${changes.additions} -${changes.deletions})`,
            matchOnDescription: true,
            matchOnDetail: true
          });
          
          if (selected) {
            // Copy to clipboard
            const message = agent.formatCommitMessage(selected.suggestion);
            await vscode.env.clipboard.writeText(message);
            
            const action = await vscode.window.showInformationMessage(
              `Commit message copied! "${selected.suggestion.message}"`,
              'Open Source Control',
              'Commit Now'
            );
            
            if (action === 'Open Source Control') {
              vscode.commands.executeCommand('workbench.view.scm');
            } else if (action === 'Commit Now') {
              // Use VS Code's git extension to commit
              vscode.commands.executeCommand('git.commit');
            }
          }
          
        } catch (error) {
          vscode.window.showErrorMessage(`Commit generation failed: ${error}`);
        }
      });
    }
  );

  // Register Who Knows What command
  const whoKnowsWhatCommand = vscode.commands.registerCommand(
    'codeDetective.whoKnowsWhat',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building Expertise Map...',
        cancellable: false
      }, async () => {
        try {
          const { ExpertMapAgent } = await import('../agents/expertMapAgent');
          const agent = new ExpertMapAgent(workspaceFolder.uri.fsPath);
          const data = await agent.buildExpertiseMap();
          const html = agent.generateHTML(data);
          
          const panel = vscode.window.createWebviewPanel(
            'whoKnowsWhat',
            'Who Knows What',
            vscode.ViewColumn.Beside,
            {}
          );
          panel.webview.html = html;
          
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to build expertise map: ${error}`);
        }
      });
    }
  );

  // Register Onboarding Docs command
  const onboardingCommand = vscode.commands.registerCommand(
    'codeDetective.onboarding',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeDetective');
      const apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        vscode.window.showErrorMessage('Gemini API key required');
        return;
      }

      // Let user pick a folder
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        defaultUri: workspaceFolder.uri,
        openLabel: 'Generate Onboarding Docs'
      });

      if (!folders || folders.length === 0) {
        return;
      }

      const targetPath = path.relative(workspaceFolder.uri.fsPath, folders[0].fsPath);

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating Onboarding Docs...',
        cancellable: false
      }, async () => {
        try {
          const { OnboardingAgent } = await import('../agents/onboardingAgent');
          const agent = new OnboardingAgent(workspaceFolder.uri.fsPath, apiKey);
          const docs = await agent.generateDocs(targetPath || '.');
          const html = agent.generateHTML(docs);
          
          const panel = vscode.window.createWebviewPanel(
            'onboarding',
            `Onboarding: ${docs.title}`,
            vscode.ViewColumn.Beside,
            {}
          );
          panel.webview.html = html;
          
          // Offer to export
          const action = await vscode.window.showInformationMessage(
            'Onboarding docs generated!',
            'Export to Markdown'
          );
          
          if (action === 'Export to Markdown') {
            const markdown = agent.exportMarkdown(docs);
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'ONBOARDING.md')),
              filters: { 'Markdown': ['md'] }
            });
            if (uri) {
              fs.writeFileSync(uri.fsPath, markdown);
              vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
            }
          }
          
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to generate docs: ${error}`);
        }
      });
    }
  );

  // Register Export to Markdown command
  const exportMarkdownCommand = vscode.commands.registerCommand(
    'codeDetective.exportMarkdown',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Not in a workspace');
        return;
      }

      // Check if there's a last investigation result stored
      const lastInvestigation = (global as any).lastInvestigationResult;
      
      if (!lastInvestigation) {
        vscode.window.showWarningMessage('No investigation to export. Run an investigation first.');
        return;
      }

      const markdown = `# Code Investigation Report

## File
\`${lastInvestigation.file || 'Unknown'}\`

## Date
${new Date().toLocaleDateString()}

## Selected Code
\`\`\`
${lastInvestigation.code || 'N/A'}
\`\`\`

## Why Does This Code Exist?
${lastInvestigation.explanation || lastInvestigation.content || 'No explanation available'}

${lastInvestigation.commits ? `## Related Commits\n${lastInvestigation.commits.map((c: any) => `- ${c.hash?.substring(0, 7)} ${c.message}`).join('\n')}` : ''}

${lastInvestigation.confidence ? `## Confidence: ${lastInvestigation.confidence}%` : ''}

---
*Generated by Code Detective*
`;

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'investigation-report.md')),
        filters: { 'Markdown': ['md'] }
      });

      if (uri) {
        fs.writeFileSync(uri.fsPath, markdown);
        vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
        
        // Open the file
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    }
  );

  context.subscriptions.push(
    investigateCommand,
    deepDiveCommand,
    resolveConflictsCommand,
    watchModeCommand,
    blameCommand,
    timelineCommand,
    techDebtCommand,
    generateCommitCommand,
    whoKnowsWhatCommand,
    onboardingCommand,
    exportMarkdownCommand
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

async function startInvestigation(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  selection: vscode.Selection
): Promise<void> {
  // Get configuration
  const config = vscode.workspace.getConfiguration('codeDetective');
  const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;
  const githubToken = config.get<string>('githubToken') || process.env.GITHUB_TOKEN;
  const thinkingLevel = config.get<string>('thinkingLevel') || 'high';

  if (!geminiApiKey) {
    const action = await vscode.window.showErrorMessage(
      'Gemini API key not configured',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'codeDetective.geminiApiKey'
      );
    }
    return;
  }

  // Get workspace folder
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Not in a workspace');
    return;
  }

  // Create or show webview panel
  if (investigationPanel) {
    investigationPanel.reveal(vscode.ViewColumn.Beside);
  } else {
    investigationPanel = vscode.window.createWebviewPanel(
      'codeDetective',
      'Code Investigation',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
        ]
      }
    );

    investigationPanel.onDidDispose(() => {
      investigationPanel = undefined;
    });
  }

  // Get selected code
  const selectedText = editor.document.getText(selection);
  const filePath = editor.document.fileName;
  const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

  // Set initial loading state
  investigationPanel.webview.html = getWebviewContent(
    context,
    investigationPanel.webview,
    {
      status: 'loading',
      code: selectedText,
      file: relativePath,
      lineStart: selection.start.line + 1,
      lineEnd: selection.end.line + 1
    }
  );

  // Create investigator
  const investigator = new Investigator({
    geminiApiKey,
    githubToken,
    thinkingLevel: thinkingLevel as 'low' | 'medium' | 'high',
    onUpdate: (update: StreamUpdate) => {
      if (investigationPanel) {
        investigationPanel.webview.postMessage({
          type: 'update',
          data: update
        });
      }
    }
  });

  try {
    // Run investigation
    const result = await investigator.investigate({
      text: selectedText,
      filePath: relativePath,
      lineStart: selection.start.line + 1,
      lineEnd: selection.end.line + 1,
      repoPath: workspaceFolder.uri.fsPath
    });

    // Send results to webview
    if (investigationPanel) {
      investigationPanel.webview.postMessage({
        type: 'result',
        data: result
      });
    }

    // Add to history
    addToHistory(result, relativePath, selection.start.line + 1, selection.end.line + 1);

    // Handle export requests from webview
    investigationPanel?.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'export') {
        const markdown = investigator.generateMarkdownExport(result);
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(markdown.filename),
          filters: { 'Markdown': ['md'] }
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(markdown.content)
          );
          vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
        }
      }
    });

  } catch (error) {
    if (investigationPanel) {
      investigationPanel.webview.postMessage({
        type: 'error',
        data: { message: String(error) }
      });
    }
    vscode.window.showErrorMessage(`Investigation failed: ${error}`);
  }
}

function getWebviewContent(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  initialData: any
): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Code Investigation</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      padding: 20px;
      min-height: 100vh;
      line-height: 1.5;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .badge-thinking {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .badge-confidence {
      background: var(--vscode-testing-iconPassed);
      color: #000;
    }
    .badge-confidence.medium { background: var(--vscode-editorWarning-foreground); }
    .badge-confidence.low { background: var(--vscode-editorError-foreground); color: white; }
    
    .file-path {
      display: inline-block;
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 16px;
    }
    
    .code-block {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
      overflow-x: auto;
    }
    
    .code-block pre {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      line-height: 1.5;
      color: var(--vscode-foreground);
    }
    
    .progress-container { margin-bottom: 20px; }
    
    .progress-bar {
      height: 4px;
      background: var(--vscode-progressBar-background);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--vscode-button-background);
      transition: width 0.3s ease;
    }
    
    .status-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .section h2 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    
    .timeline {
      position: relative;
      padding-left: 24px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--vscode-button-background);
    }
    
    .timeline-item {
      position: relative;
      margin-bottom: 16px;
      padding-left: 16px;
    }
    
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -20px;
      top: 6px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      border: 2px solid var(--vscode-editor-background);
    }
    
    .timeline-date {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    .timeline-title {
      font-weight: 500;
      margin: 4px 0;
    }
    
    .timeline-author {
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
    }
    
    .narrative {
      line-height: 1.7;
      white-space: pre-wrap;
    }
    
    .sources-list { list-style: none; }
    
    .sources-list li {
      padding: 10px 14px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .sources-list a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .sources-list a:hover { text-decoration: underline; }
    
    .recommendation {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
    }
    
    .recommendation-action {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .recommendation-action.keep { background: var(--vscode-testing-iconPassed); color: #000; }
    .recommendation-action.document { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .recommendation-action.refactor { background: var(--vscode-editorWarning-foreground); color: #000; }
    .recommendation-action.remove { background: var(--vscode-editorError-foreground); color: white; }
    
    .export-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    
    .export-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--vscode-panel-border);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .error-message {
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid var(--vscode-editorError-foreground);
      border-radius: 6px;
      padding: 12px;
      color: var(--vscode-editorError-foreground);
    }
    
    .thought-chain {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1>Code Detective</h1>
      <span class="badge badge-thinking" id="thinking-badge" style="display: none;">
        Thinking: HIGH
      </span>
    </div>
    
    <div class="file-path" id="file-info"></div>
    
    <div class="code-block">
      <pre id="code-snippet"></pre>
    </div>
    
    <div class="progress-container" id="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
      </div>
      <div class="status-text">
        <div class="loading-spinner"></div>
        <span id="status-text">Initializing investigation...</span>
      </div>
    </div>
    
    <div id="results" style="display: none;">
      <div class="section">
        <h2>Summary</h2>
        <div class="badge badge-confidence" id="confidence-badge"></div>
        <p id="summary" style="margin-top: 12px;"></p>
      </div>
      
      <div class="section">
        <h2>Investigation Findings</h2>
        <div class="narrative" id="narrative"></div>
      </div>
      
      <div class="section" id="timeline-section">
        <h2>Evidence Timeline</h2>
        <div class="timeline" id="timeline"></div>
      </div>
      
      <div class="section" id="sources-section">
        <h2>Sources</h2>
        <ul class="sources-list" id="sources"></ul>
      </div>
      
      <div class="section" id="recommendations-section">
        <h2>Recommendations</h2>
        <div id="recommendations"></div>
      </div>
      
      <div class="section" id="thought-chain-section" style="display: none;">
        <h2>Thought Signature Chain (Debug)</h2>
        <div class="thought-chain" id="thought-chain"></div>
      </div>
      
      <button class="export-btn" id="export-btn">Export as Markdown</button>
    </div>
    
    <div class="error-message" id="error" style="display: none;"></div>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initialData = ${JSON.stringify(initialData)};
    
    // Initialize with code snippet
    document.getElementById('file-info').textContent = 
      initialData.file + ' (lines ' + initialData.lineStart + '-' + initialData.lineEnd + ')';
    document.getElementById('code-snippet').textContent = initialData.code;
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.type === 'update') {
        updateProgress(message.data);
      } else if (message.type === 'result') {
        showResults(message.data);
      } else if (message.type === 'error') {
        showError(message.data.message);
      }
    });
    
    function updateProgress(update) {
      document.getElementById('progress-fill').style.width = update.progress + '%';
      document.getElementById('status-text').textContent = update.message;
      
      const badge = document.getElementById('thinking-badge');
      if (update.thinkingBadge) {
        badge.textContent = 'Thinking: ' + update.thinkingBadge;
        badge.style.display = 'inline-flex';
      }
    }
    
    function showResults(result) {
      document.getElementById('progress-container').style.display = 'none';
      document.getElementById('thinking-badge').style.display = 'none';
      document.getElementById('results').style.display = 'block';
      
      // Confidence
      const confBadge = document.getElementById('confidence-badge');
      confBadge.textContent = 'Confidence: ' + result.confidence + '%';
      if (result.confidence < 40) confBadge.classList.add('low');
      else if (result.confidence < 70) confBadge.classList.add('medium');
      
      // Summary & Narrative
      document.getElementById('summary').textContent = result.summary;
      document.getElementById('narrative').textContent = result.narrative;
      
      // Timeline
      const timeline = document.getElementById('timeline');
      timeline.innerHTML = result.timeline.slice(0, 10).map(e => 
        '<div class="timeline-item">' +
        '<div class="timeline-date">' + new Date(e.date).toLocaleDateString() + '</div>' +
        '<div class="timeline-title">' + escapeHtml(e.title.substring(0, 60)) + '</div>' +
        '<div class="timeline-author">by ' + escapeHtml(e.author) + '</div>' +
        '</div>'
      ).join('');
      
      // Sources
      const sources = document.getElementById('sources');
      sources.innerHTML = result.sources.map(s => 
        '<li><strong>' + s.type.toUpperCase() + '</strong> ' +
        (s.url ? '<a href="' + s.url + '">' + escapeHtml(s.id) + '</a>' : escapeHtml(s.id)) +
        ': ' + escapeHtml(s.description) + '</li>'
      ).join('');
      
      // Recommendations
      const recs = document.getElementById('recommendations');
      recs.innerHTML = result.recommendations.map(r => 
        '<div class="recommendation">' +
        '<span class="recommendation-action ' + r.action + '">' + r.action + '</span>' +
        '<span>' + escapeHtml(r.reason) + '</span>' +
        '</div>'
      ).join('');
      
      // Thought chain (debug)
      if (result.thoughtChain && result.thoughtChain.signatures.length > 0) {
        document.getElementById('thought-chain-section').style.display = 'block';
        document.getElementById('thought-chain').textContent = 
          result.thoughtChain.signatures.map((s, i) => 
            (i + 1) + '. [' + s.agentId + '] ' + s.signature
          ).join('\\n');
      }
    }
    
    function showError(message) {
      document.getElementById('progress-container').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = 'Error: ' + message;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'export' });
    });
  </script>
</body>
</html>`;
}

// Helper function for VS Code themed HTML panels
function getVSCodeThemedHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 {
      color: var(--vscode-editor-foreground);
      font-weight: 500;
    }
    h1 { font-size: 24px; margin-bottom: 20px; }
    h2 { font-size: 18px; margin: 20px 0 10px; }
    p { color: var(--vscode-descriptionForeground); }
    .loader {
      width: 40px;
      height: 40px;
      border: 3px solid var(--vscode-input-border);
      border-top-color: var(--vscode-textLink-foreground);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .card {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px;
      margin: 15px 0;
      overflow: hidden;
    }
    .card-header {
      background: var(--vscode-sideBar-background);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--vscode-input-border);
    }
    .card-body {
      padding: 16px;
    }
    .file-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      color: var(--vscode-textLink-foreground);
    }
    .badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.success {
      background: var(--vscode-testing-iconPassed);
      color: #000;
    }
    .badge.warning {
      background: var(--vscode-editorWarning-foreground);
      color: #000;
    }
    .code-block {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      margin: 12px 0 0;
    }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 15px;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .error-box {
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid var(--vscode-editorError-foreground);
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .error-box h3 {
      color: var(--vscode-editorError-foreground);
      margin-top: 0;
    }
    .section {
      background: var(--vscode-input-background);
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .section h2 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 10px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${content}
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getDeepDiveLoadingHtml(filePath: string, startLine: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: var(--vscode-font-family); 
      background: var(--vscode-editor-background); 
      color: var(--vscode-editor-foreground); 
      padding: 40px; 
      text-align: center;
    }
    .loader { 
      width: 50px; 
      height: 50px; 
      border: 4px solid var(--vscode-input-border); 
      border-top-color: var(--vscode-textLink-foreground); 
      border-radius: 50%; 
      animation: spin 1s linear infinite; 
      margin: 40px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { color: var(--vscode-textLink-foreground); font-size: 24px; }
    .file { color: var(--vscode-descriptionForeground); font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Deep Dive in Progress</h1>
  <div class="loader"></div>
  <p>Analyzing dependencies and building investigation case...</p>
  <p class="file">${filePath}:${startLine}</p>
</body>
</html>`;
}


function getDeepDiveResultsHtml(result: InvestigationResult, filePath: string): string {
  const confidenceClass = result.confidence >= 70 ? 'high' : result.confidence >= 40 ? 'medium' : 'low';
  
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: var(--vscode-font-family); 
      background: var(--vscode-editor-background); 
      color: var(--vscode-editor-foreground); 
      padding: 30px;
      line-height: 1.6;
    }
    h1 { color: var(--vscode-textLink-foreground); font-size: 22px; margin-bottom: 5px; }
    .file { color: var(--vscode-descriptionForeground); font-size: 13px; margin-bottom: 25px; }
    .confidence {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 13px;
    }
    .confidence.high { background: var(--vscode-testing-iconPassed); color: #000; }
    .confidence.medium { background: var(--vscode-editorWarning-foreground); color: #000; }
    .confidence.low { background: var(--vscode-editorError-foreground); }
    .section { 
      background: var(--vscode-input-background); 
      border: 1px solid var(--vscode-input-border);
      border-radius: 8px; 
      padding: 20px; 
      margin: 15px 0;
    }
    .section h2 { 
      font-size: 11px; 
      text-transform: uppercase; 
      letter-spacing: 1px;
      color: var(--vscode-descriptionForeground); 
      margin: 0 0 12px;
    }
    .summary { font-size: 16px; font-weight: 500; }
    .narrative { white-space: pre-wrap; font-size: 14px; }
    .sources { list-style: none; padding: 0; margin: 0; }
    .sources li { 
      background: var(--vscode-sideBar-background); 
      border: 1px solid var(--vscode-input-border);
      padding: 10px 15px; 
      border-radius: 6px; 
      margin: 8px 0 0;
      font-size: 13px;
    }
    .sources a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .timeline-item { 
      padding: 8px 0 8px 20px;
      border-left: 2px solid var(--vscode-textLink-foreground);
      margin-left: 10px;
    }
    .timeline-date { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .timeline-title { font-weight: 500; }
    .timeline-author { color: var(--vscode-textLink-foreground); font-size: 12px; }
  </style>
</head>
<body>
  <h1>Deep Dive Complete</h1>
  <p class="file">${filePath}</p>
  
  <div class="section">
    <h2>Confidence</h2>
    <span class="confidence ${confidenceClass}">${result.confidence}%</span>
  </div>
  
  <div class="section">
    <h2>Summary</h2>
    <p class="summary">${escapeHtml(result.summary)}</p>
  </div>
  
  <div class="section">
    <h2>Investigation Findings</h2>
    <div class="narrative">${escapeHtml(result.narrative)}</div>
  </div>
  
  ${result.sources.length > 0 ? `
  <div class="section">
    <h2>Sources</h2>
    <ul class="sources">
      ${result.sources.map(s => `
        <li>
          <strong>${s.type.toUpperCase()}</strong> ${s.id}: ${escapeHtml(s.description)}
          ${s.url ? `<a href="${s.url}" target="_blank">View →</a>` : ''}
        </li>
      `).join('')}
    </ul>
  </div>
  ` : ''}
  
  ${result.timeline.length > 0 ? `
  <div class="section">
    <h2>Timeline</h2>
    ${result.timeline.slice(0, 10).map(t => `
      <div class="timeline-item">
        <div class="timeline-date">${new Date(t.date).toLocaleDateString()}</div>
        <div class="timeline-title">${escapeHtml(t.title.substring(0, 60))}</div>
        <div class="timeline-author">by ${escapeHtml(t.author)}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>`;
}

function getDeepDiveErrorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: var(--vscode-font-family); 
      background: var(--vscode-editor-background); 
      color: var(--vscode-editor-foreground); 
      padding: 40px;
      text-align: center;
    }
    .error {
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid var(--vscode-editorError-foreground);
      border-radius: 10px;
      padding: 30px;
      margin: 30px auto;
      max-width: 500px;
    }
    h1 { color: var(--vscode-editorError-foreground); }
    .hint { color: var(--vscode-descriptionForeground); margin-top: 20px; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Investigation Failed</h1>
    <p>${escapeHtml(error)}</p>
    <p class="hint">Please check your API key and try again.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function deactivate() {
  if (investigationPanel) {
    investigationPanel.dispose();
  }
}
