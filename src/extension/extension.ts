/**
 * The Repo Archaeologist - VS Code Extension
 * Main extension entry point
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Investigator } from '../investigator';
import { StreamUpdate, InvestigationResult } from '../agents/types';

let investigationPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('The Repo Archaeologist is now active!');

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

  // Register quick blame command
  const blameCommand = vscode.commands.registerCommand(
    'repoArchaeologist.quickBlame',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const line = editor.selection.active.line + 1;
      vscode.window.showInformationMessage(
        `Quick blame for line ${line}... (full feature coming soon)`
      );
    }
  );

  context.subscriptions.push(investigateCommand, blameCommand);
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Code Investigation</title>
  <style>
    :root {
      --bg-primary: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-card: #0f3460;
      --accent: #e94560;
      --accent-light: #ff6b6b;
      --text-primary: #eee;
      --text-secondary: #aaa;
      --success: #4ade80;
      --warning: #fbbf24;
      --string-red: #e94560;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 20px;
      min-height: 100vh;
    }
    
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--bg-card);
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      background: linear-gradient(135deg, var(--accent), var(--accent-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge-thinking {
      background: var(--accent);
      color: white;
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .badge-confidence {
      background: var(--success);
      color: #000;
    }
    
    .badge-confidence.medium {
      background: var(--warning);
    }
    
    .badge-confidence.low {
      background: var(--accent);
      color: white;
    }
    
    .code-block {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      overflow-x: auto;
    }
    
    .code-block pre {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    
    .file-path {
      color: var(--text-secondary);
      font-size: 12px;
      margin-bottom: 8px;
    }
    
    .progress-container {
      margin-bottom: 24px;
    }
    
    .progress-bar {
      height: 4px;
      background: var(--bg-card);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-light));
      transition: width 0.3s ease;
    }
    
    .status-text {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .section h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
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
      background: var(--string-red);
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
      background: var(--string-red);
      border: 2px solid var(--bg-primary);
    }
    
    .timeline-date {
      font-size: 11px;
      color: var(--text-secondary);
    }
    
    .timeline-title {
      font-weight: 500;
      margin: 4px 0;
    }
    
    .timeline-author {
      font-size: 12px;
      color: var(--accent-light);
    }
    
    .narrative {
      line-height: 1.7;
      white-space: pre-wrap;
    }
    
    .sources-list {
      list-style: none;
    }
    
    .sources-list li {
      padding: 8px 12px;
      background: var(--bg-card);
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .sources-list a {
      color: var(--accent-light);
      text-decoration: none;
    }
    
    .sources-list a:hover {
      text-decoration: underline;
    }
    
    .recommendation {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: var(--bg-card);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .recommendation-action {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--accent);
    }
    
    .recommendation-action.keep { background: var(--success); color: #000; }
    .recommendation-action.document { background: #60a5fa; }
    .recommendation-action.refactor { background: var(--warning); color: #000; }
    .recommendation-action.remove { background: var(--accent); }
    
    .export-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .export-btn:hover {
      background: var(--accent-light);
    }
    
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--bg-card);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .error-message {
      background: rgba(233, 69, 96, 0.2);
      border: 1px solid var(--accent);
      border-radius: 8px;
      padding: 16px;
      color: var(--accent-light);
    }
    
    .thought-chain {
      font-family: monospace;
      font-size: 11px;
      color: var(--text-secondary);
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1>🔍 The Repo Archaeologist</h1>
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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {
  if (investigationPanel) {
    investigationPanel.dispose();
  }
}
