# The Repo Archaeologist 🔍

> **Git blame tells you WHO and WHEN. We tell you WHY.**

An AI-powered code archaeology tool using **Gemini 3's advanced reasoning** to uncover the story behind legacy code.

---

## ✨ Features

- **Multi-Agent Investigation System** - Lead Detective coordinates Historian (git) and Archivist (GitHub) agents
- **Gemini 3 Deep Reasoning** - Uses `thinking_level="HIGH"` for thorough code analysis
- **Thought Signature Chaining** - Maintains investigation context across multi-turn reasoning
- **Evidence Timeline** - Visual "detective board" with connected evidence nodes
- **Real-Time Thinking Stream** - Watch the AI reason through the investigation
- **Confidence Scoring** - Clear indication of how certain the findings are
- **Source Citations** - All claims backed by commit SHAs, PRs, and issues
- **Markdown/ADR Export** - Generate documentation directly from findings

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/repo-archaeologist.git
cd repo-archaeologist

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### VS Code Extension

1. Press `F5` to launch Extension Development Host
2. Open any git repository
3. Select code and right-click → **"Investigate Code"**
4. Watch the investigation unfold!

### CLI Usage

```bash
# Investigate a specific line
npm run cli -- investigate ./src/utils.ts --line 42

# Investigate a range
npm run cli -- investigate ./src/utils.ts --start 40 --end 50

# Quick blame lookup
npm run cli -- blame ./src/utils.ts 42

# Enable debug mode (shows thought signatures)
npm run cli -- investigate ./src/app.ts --line 15 --debug
```

---

## 🧠 Architecture

```
┌──────────────────────────────────────┐
│     Lead Detective Agent             │
│     (Gemini 3 Pro + HIGH thinking)   │
│     Role: Orchestration & Synthesis  │
└──────────┬───────────────────────────┘
           │
           ├──→ Historian Agent (Git Operations)
           │    - git blame, log, diff parsing
           │    - File change tracking
           │
           └──→ Archivist Agent (GitHub API)
                - PR/Issue retrieval
                - Discussion analysis
```

### Gemini 3 Features Used

| Feature | Purpose |
|---------|---------|
| `thinking_level="HIGH"` | Deep reasoning for code archaeology |
| Thought Signatures | State persistence across multi-turn investigations |
| 1M Token Context | Load full file history for comprehensive analysis |

---

## ⚙️ Configuration

### Environment Variables

```bash
GEMINI_API_KEY=your_gemini_api_key  # Required
GITHUB_TOKEN=your_github_pat        # Optional, for PR/Issue lookup
```

### VS Code Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `repoArchaeologist.geminiApiKey` | Gemini API key | - |
| `repoArchaeologist.githubToken` | GitHub PAT | - |
| `repoArchaeologist.thinkingLevel` | low/medium/high | high |

---

## 📖 Example Output

```markdown
## Investigation Summary

**Confidence: 92%**

This `MAGIC_NUMBER_OFFSET = 2` exists because of an edge case 
in React's Fiber reconciler discovered in production at Facebook in 2019.

### The Context
- **When:** March 2019 (Commit a1b2c3d)
- **Who:** @gaearon (Dan Abramov)
- **Why:** Issue #14536 reported crashes in concurrent mode

### The Deep Dive
The offset of 2 accounts for the lane priority system. Without this 
offset, high-priority updates could be starved by continuous low-priority work.

### Sources
- Commit: a1b2c3d
- PR: #15324 (67 comments)
- Issue: #14536

### Recommendation
**KEEP** - This code is still necessary. Removing causes test failures.
```

---

## 🎯 Hackathon Submission

**Target:** Google DeepMind Gemini 3 Global Hackathon

**Scoring Criteria:**
- Technical Execution (40%) ✅ Multi-agent system with proper orchestration
- Innovation (30%) ✅ Novel "code archaeology" approach with thought signatures
- Impact (20%) ✅ Solves real developer pain (understanding legacy code)
- Presentation (10%) ✅ Detective-themed UI with clear visualizations

---

## 🛠️ Development

```bash
# Watch mode
npm run watch

# Build
npm run build

# Package extension
npm run package

# Run tests
npm test
```

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Built with ❤️ for the Gemini 3 Hackathon**
