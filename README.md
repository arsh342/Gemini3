# Code Detective 🕵️‍♂️

> **Git blame tells you WHO. Code Detective tells you WHY.**

An AI-powered code archaeology tool powered by **Gemini 3**. Uncover the hidden history, context, and expertise behind every line of code.

<p align="center">
  <img src="images/icon.png" width="128" height="128" alt="Code Detective Logo">
</p>

---

## ✨ Features

### 🔍 AI Investigation
- **Contextual Analysis**: Understand *why* code exists, not just who wrote it.
- **Deep Dive**: Autonomous agents trace dependencies and cross-reference issues/PRs.
- **Thinking Process**: Watch Gemini 3 reason through complex code history in real-time.

### 📜 Time Travel Timeline
- **Interactive History**: Visualize the evolution of any file or the entire repo.
- **Diff Analysis**: See exactly which files changed in every commit.
- **Searchable**: Instant search across commit messages and authors.

### 📊 Tech Debt Score
- **AI Grading**: Get an A-F grade for your project or files.
- **Factor Analysis**: Breaks down debt by Freshness, Clarity, Complexity, and Consistency.
- **Actionable Advice**: AI suggests specific refactoring steps.

### 👥 Who Knows What?
- **Expertise Map**: Visualizes which developers own which parts of the codebase.
- **Bus Factor**: Identify single points of failure in team knowledge.

### 📘 Instant Onboarding
- **Auto-Documentation**: Generate comprehensive onboarding docs for any folder.
- **Architecture Overview**: AI explains how modules fit together.
- **Key Files**: Identifies the most critical files to read first.

### ⚡ Smart Utils
- **Commit Message Generator**: Write conventional commits automatically based on staged changes.
- **Watch Mode**: Auto-detects remote changes and potential merge conflicts.

---

## 🚀 Quick Start

1. **Install** the extension.
2. **Open a Git Repository** in VS Code.
3. **Set your API Key**:
   - Get a Gemini API Key from Google AI Studio.
   - Run command: `Code Detective: Set API Key` (or set `GEMINI_API_KEY` env var).

### Usage

- **Investigate**: Right-click any code selection → "Investigate Code".
- **Timeline**: Click "Code Timeline" in the sidebar for a visual history.
- **Tech Debt**: Click "Tech Debt Score" to analyze your project's health.
- **Expertise**: Click "Who Knows What" to see team knowledge distribution.
- **Onboarding**: Click "Onboarding Docs" to generate a guide for any folder.

---

## 🧠 Powered by Gemini 3

Code Detective utilizes the advanced reasoning capabilities of Gemini 3:

- **Thinking Level HIGH**: Enables deep, multi-step reasoning for investigations.
- **1M Token Context**: Analyzes vast amounts of git history and file context.
- **Agentic Workflow**: Orchestrates multiple specialized agents (Historian, Archivist, TechDebt, etc.).

---

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `codeDetective.investigate` | Investigate selected code |
| `codeDetective.deepDive` | thorough autonomous investigation |
| `codeDetective.timeline` | Visual commit history |
| `codeDetective.techDebt` | Calculate technical debt score |
| `codeDetective.whoKnowsWhat` | Generate expertise map |
| `codeDetective.onboarding` | Create onboarding docs for a folder |
| `codeDetective.generateCommit` | AI-generate commit message |
| `codeDetective.watchMode` | Monitor for conflicts/updates |
| `codeDetective.exportMarkdown` | Export investigation to Markdown |

---

## 📄 License

MIT License. Built with ❤️ for the Google DeepMind Gemini 3 Hackathon.
