/**
 * The Repo Archaeologist - VS Code Extension
 * Main extension entry point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Investigator } from '../investigator';
import { StreamUpdate, InvestigationResult } from '../agents/types';

let investigationPanel: vscode.WebviewPanel | undefined;

// Sidebar Webview Provider
class RepoArchaeologistSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoArchaeologist.actions';
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
          vscode.commands.executeCommand('repoArchaeologist.investigate');
          break;
        case 'deepDive':
          vscode.commands.executeCommand('repoArchaeologist.deepDive');
          break;
        case 'resolveConflicts':
          vscode.commands.executeCommand('repoArchaeologist.resolveConflicts');
          break;
        case 'watchMode':
          vscode.commands.executeCommand('repoArchaeologist.watchMode');
          break;
        case 'blame':
          vscode.commands.executeCommand('repoArchaeologist.blame');
          break;
      }
    });
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
      <style>
        :root {
          --noir-bg: #0a0a0f;
          --noir-panel: #12121a;
          --noir-card: #1a1a24;
          --noir-border: #2a2a36;
          --noir-text: #e8e6e3;
          --noir-muted: #6a6a6a;
          --noir-red: #c9302c;
          --noir-red-glow: #ff4444;
          --noir-amber: #d4a017;
          --noir-amber-glow: #ffc107;
        }
        
        body {
          font-family: 'JetBrains Mono', monospace;
          background: var(--noir-bg);
          padding: 16px;
          color: var(--noir-text);
          margin: 0;
        }
        
        .header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--noir-border);
        }
        
        .logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--noir-red), var(--noir-amber));
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        
        .title {
          font-family: 'Playfair Display', serif;
          font-size: 15px;
          font-weight: 700;
          color: var(--noir-text);
          letter-spacing: 0.5px;
        }
        
        .subtitle {
          font-size: 10px;
          color: var(--noir-amber);
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-top: 2px;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .section-title {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--noir-muted);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--noir-border);
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          margin-bottom: 6px;
          background: var(--noir-card);
          color: var(--noir-text);
          border: 1px solid var(--noir-border);
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          transition: all 0.2s;
        }
        
        .btn:hover {
          border-color: var(--noir-amber);
          box-shadow: 0 0 12px rgba(212, 160, 23, 0.15);
        }
        
        .btn-primary {
          background: linear-gradient(135deg, var(--noir-red), #8b1a1a);
          border-color: var(--noir-red);
        }
        
        .btn-primary:hover {
          box-shadow: 0 0 16px rgba(201, 48, 44, 0.3);
          border-color: var(--noir-red-glow);
        }
        
        .btn-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        
        .btn-icon.red { color: var(--noir-red-glow); }
        .btn-icon.amber { color: var(--noir-amber); }
        
        .desc {
          font-size: 10px;
          color: var(--noir-muted);
          margin-top: -2px;
          margin-bottom: 10px;
          padding-left: 44px;
          font-style: italic;
        }
        
        .status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px 16px;
          background: var(--noir-panel);
          border-top: 1px solid var(--noir-border);
          font-size: 10px;
          color: var(--noir-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .pulse {
          width: 6px;
          height: 6px;
          background: var(--noir-amber);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        .codicon { font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">
          <i class="codicon codicon-law"></i>
        </div>
        <div>
          <div class="title">The Repo Archaeologist</div>
          <div class="subtitle">Code Detective</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Investigation</div>
        <button class="btn btn-primary" onclick="send('investigate')">
          <span class="btn-icon"><i class="codicon codicon-search"></i></span>
          Investigate Selection
        </button>
        <div class="desc">"Why does this code exist?"</div>
        
        <button class="btn" onclick="send('deepDive')">
          <span class="btn-icon amber"><i class="codicon codicon-telescope"></i></span>
          Deep Dive
        </button>
        <div class="desc">Follow the evidence trail</div>
      </div>
      
      <div class="section">
        <div class="section-title">Surveillance</div>
        <button class="btn" onclick="send('watchMode')">
          <span class="btn-icon amber"><i class="codicon codicon-eye"></i></span>
          Watch Mode
        </button>
        <div class="desc">Monitor for suspicious commits</div>
      </div>
      
      <div class="section">
        <div class="section-title">Git Operations</div>
        <button class="btn" onclick="send('resolveConflicts')">
          <span class="btn-icon red"><i class="codicon codicon-git-merge"></i></span>
          Resolve Conflicts
        </button>
        <div class="desc">AI-powered resolution</div>
        
        <button class="btn" onclick="send('blame')">
          <span class="btn-icon"><i class="codicon codicon-git-commit"></i></span>
          Quick Blame
        </button>
        <div class="desc">Who's responsible?</div>
      </div>

      <div class="status-bar">
        <span class="pulse"></span>
        Ready to investigate
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
  console.log('The Repo Archaeologist is now active!');

  // Register sidebar provider
  const sidebarProvider = new RepoArchaeologistSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RepoArchaeologistSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register the investigate command
  const investigateCommand = vscode.commands.registerCommand(
    'repoArchaeologist.investigate',
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
    'repoArchaeologist.deepDive',
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
      const config = vscode.workspace.getConfiguration('repoArchaeologist');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        const action = await vscode.window.showErrorMessage(
          'Gemini API key not configured',
          'Open Settings'
        );
        if (action === 'Open Settings') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'repoArchaeologist.geminiApiKey'
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
        'repoArchaeologistDeepDive',
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
    'repoArchaeologist.resolveConflicts',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const config = vscode.workspace.getConfiguration('repoArchaeologist');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        vscode.window.showErrorMessage('Gemini API key not configured');
        return;
      }

      // Create results panel
      const panel = vscode.window.createWebviewPanel(
        'repoArchaeologistConflicts',
        'Conflict Resolution',
        vscode.ViewColumn.One,
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
    'repoArchaeologist.watchMode',
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const config = vscode.workspace.getConfiguration('repoArchaeologist');
      const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;

      if (!geminiApiKey) {
        vscode.window.showErrorMessage('Gemini API key not configured');
        return;
      }

      const action = await vscode.window.showInformationMessage(
        'Start Watch Mode? The extension will monitor for new commits and investigate suspicious changes.',
        'Start Monitoring', 'Cancel'
      );

      if (action === 'Start Monitoring') {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = '$(eye) Watching...';
        statusBarItem.tooltip = 'Repo Archaeologist: Monitoring for commits';
        statusBarItem.show();

        vscode.window.showInformationMessage('Watch Mode active. Monitoring repository for new commits...');

        // In a full implementation, this would start the WatchModeAgent
        // For now, show a status bar indicator
        context.subscriptions.push(statusBarItem);
      }
    }
  );

  // Register quick blame command - FULL IMPLEMENTATION
  const blameCommand = vscode.commands.registerCommand(
    'repoArchaeologist.blame',
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
          vscode.commands.executeCommand('repoArchaeologist.investigate');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Blame failed: ${error}`);
      }
    }
  );

  context.subscriptions.push(
    investigateCommand,
    deepDiveCommand,
    resolveConflictsCommand,
    watchModeCommand,
    blameCommand
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
  const config = vscode.workspace.getConfiguration('repoArchaeologist');
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
        'repoArchaeologist.geminiApiKey'
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
      'repoArchaeologist',
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <title>Code Investigation</title>
  <style>
    :root {
      --noir-bg: #0a0a0f;
      --noir-panel: #12121a;
      --noir-card: #1a1a24;
      --noir-card-hover: #22222e;
      --noir-border: #2a2a36;
      --noir-text: #e8e6e3;
      --noir-text-secondary: #9a9a9a;
      --noir-muted: #5a5a5a;
      --noir-red: #c9302c;
      --noir-red-glow: #ff4444;
      --noir-amber: #d4a017;
      --noir-amber-glow: #ffc107;
      --noir-green: #2e7d32;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'JetBrains Mono', monospace;
      background: var(--noir-bg);
      color: var(--noir-text);
      padding: 24px;
      min-height: 100vh;
      line-height: 1.6;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--noir-border);
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .logo {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--noir-red), var(--noir-amber));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 20px rgba(212, 160, 23, 0.2);
    }
    
    .header h1 {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      font-weight: 700;
      color: var(--noir-text);
      letter-spacing: 0.5px;
    }
    
    .header-subtitle {
      font-size: 11px;
      color: var(--noir-amber);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .badge-thinking {
      background: var(--noir-red);
      color: white;
      animation: pulse 1.5s infinite;
      box-shadow: 0 0 20px rgba(201, 48, 44, 0.4);
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(201, 48, 44, 0.4); }
      50% { opacity: 0.8; box-shadow: 0 0 30px rgba(201, 48, 44, 0.6); }
    }
    
    .badge-confidence {
      background: var(--noir-green);
      color: white;
    }
    .badge-confidence.medium { background: var(--noir-amber); color: #000; }
    .badge-confidence.low { background: var(--noir-red); }
    
    .file-path {
      display: inline-block;
      background: var(--noir-card);
      border: 1px solid var(--noir-border);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--noir-amber);
      margin-bottom: 20px;
    }
    
    .code-block {
      background: var(--noir-panel);
      border: 1px solid var(--noir-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      overflow-x: auto;
      position: relative;
    }
    
    .code-block::before {
      content: 'EVIDENCE';
      position: absolute;
      top: -10px;
      left: 16px;
      background: var(--noir-bg);
      padding: 0 8px;
      font-size: 9px;
      letter-spacing: 2px;
      color: var(--noir-red);
    }
    
    .code-block pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--noir-text);
    }
    
    .progress-container { margin-bottom: 24px; }
    
    .progress-bar {
      height: 3px;
      background: var(--noir-border);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--noir-red), var(--noir-amber));
      transition: width 0.3s ease;
      box-shadow: 0 0 10px var(--noir-amber);
    }
    
    .status-text {
      font-size: 12px;
      color: var(--noir-text-secondary);
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-style: italic;
    }
    
    .section {
      background: var(--noir-card);
      border: 1px solid var(--noir-border);
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 20px;
      position: relative;
    }
    
    .section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 24px;
      right: 24px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--noir-amber), transparent);
      opacity: 0.3;
    }
    
    .section h2 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--noir-muted);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .section h2::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--noir-border);
    }
    
    .timeline {
      position: relative;
      padding-left: 30px;
    }
    
    .timeline::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, var(--noir-red), var(--noir-amber));
    }
    
    .timeline-item {
      position: relative;
      margin-bottom: 20px;
      padding-left: 20px;
    }
    
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -24px;
      top: 6px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--noir-red);
      border: 3px solid var(--noir-bg);
      box-shadow: 0 0 10px rgba(201, 48, 44, 0.5);
    }
    
    .timeline-item.fix::before { background: var(--noir-green); box-shadow: 0 0 10px rgba(46, 125, 50, 0.5); }
    .timeline-item.warning::before { background: var(--noir-amber); box-shadow: 0 0 10px rgba(212, 160, 23, 0.5); }
    
    .timeline-date {
      font-size: 10px;
      color: var(--noir-muted);
      letter-spacing: 1px;
    }
    
    .timeline-title {
      font-weight: 500;
      margin: 4px 0;
      font-size: 14px;
    }
    
    .timeline-author {
      font-size: 12px;
      color: var(--noir-amber);
    }
    
    .narrative {
      line-height: 1.8;
      white-space: pre-wrap;
      font-size: 14px;
    }
    
    .sources-list { list-style: none; }
    
    .sources-list li {
      padding: 14px 18px;
      background: var(--noir-panel);
      border: 1px solid var(--noir-border);
      border-left: 3px solid var(--noir-amber);
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 13px;
      transition: all 0.2s;
    }
    
    .sources-list li:hover {
      border-left-color: var(--noir-red);
      background: var(--noir-card-hover);
    }
    
    .sources-list a { color: var(--noir-amber); text-decoration: none; }
    .sources-list a:hover { text-decoration: underline; }
    
    .recommendation {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 18px;
      background: var(--noir-panel);
      border: 1px solid var(--noir-border);
      border-radius: 8px;
      margin-bottom: 12px;
    }
    
    .recommendation-action {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      padding: 6px 12px;
      border-radius: 4px;
      letter-spacing: 1px;
    }
    
    .recommendation-action.keep { background: var(--noir-green); color: white; }
    .recommendation-action.document { background: var(--noir-amber); color: #000; }
    .recommendation-action.refactor { background: var(--noir-amber); color: #000; }
    .recommendation-action.remove { background: var(--noir-red); color: white; }
    
    .export-btn {
      background: linear-gradient(135deg, var(--noir-red), #8b1a1a);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
    }
    
    .export-btn:hover {
      box-shadow: 0 0 20px rgba(201, 48, 44, 0.4);
      transform: translateY(-1px);
    }
    
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--noir-border);
      border-top-color: var(--noir-red);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .error-message {
      background: rgba(201, 48, 44, 0.15);
      border: 1px solid var(--noir-red);
      border-radius: 8px;
      padding: 16px;
      color: var(--vscode-editorError-foreground);
    }
    
    .thought-chain {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 6px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1>The Repo Archaeologist</h1>
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
