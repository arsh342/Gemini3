# The Repo Archaeologist — Architecture Plan (TypeScript-Only)

> **Gemini 3 Hackathon Entry**  
> An AI Detective that connects specific lines of code to the human history behind them.

---

## 1. Architecture (Pure TypeScript)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VS CODE EXTENSION                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              EVIDENCE BOARD (Webview with Noir Theme)                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │  │
│  │  │ TimelineView  │  │SuspectProfile│  │ InterrogationRoom (Chat)   │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────────────┘  │  │
│  │                                                                       │  │
│  │              Conspiracy Board (SVG Connections)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LeadDetectiveAgent (TypeScript)                    │   │
│  │   • thinking_level = "high"                                          │   │
│  │   • thought_signature persistence                                    │   │
│  │   • 1M token context utilization                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       HistorianAgent + GitService                     │   │
│  │   • git blame → structured JSON                                      │   │
│  │   • git log -p → full history                                        │   │
│  │   • GitHub API integration                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

### Noir Detective Theme
- Deep slate grays, typewriter fonts
- Muted red accents for bugs/clues
- Amber accents for insights
- Conspiracy board connecting evidence

### Core Commands
1. **Investigate Selection** — Full investigation with Evidence Board
2. **Deep Dive** — Autonomous multi-turn reasoning
3. **Quick Blame** — Inline git annotations
4. **Resolve Conflicts** — AI-powered merge resolution
5. **Watch Mode** — Monitor commits

---

## 3. File Structure (Existing)

```
Gemini3/
├── PLAN.md                    # This file
├── mock_data.json             # Test data
├── package.json               # VS Code extension manifest
├── src/
│   ├── extension/
│   │   └── extension.ts       # Extension entry + Noir webviews
│   ├── agents/
│   │   ├── leadDetective.ts   # Main investigation agent
│   │   ├── historian.ts       # Git history agent
│   │   └── conflictResolver.ts
│   ├── investigator.ts        # Investigation orchestrator
│   └── types.ts               # Data models
```

---

## 4. Implementation Status

- [x] LeadDetectiveAgent with Gemini 3
- [x] HistorianAgent with git integration  
- [x] VS Code extension with sidebar
- [x] Investigation webview panel
- [ ] **Noir theme styling** ← NEXT
- [ ] Evidence connections visualization
- [ ] Improved suspect profiles
- [ ] Conspiracy board UI

---

*"Every line of code has a story. We uncover it."*
