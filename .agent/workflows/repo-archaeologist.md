---
description: Investigate legacy code using The Repo Archaeologist AI tool
---

# Repo Archaeologist Workflow

This workflow uses the Repo Archaeologist to understand WHY legacy code exists.

## Prerequisites
Ensure your `.env` file has:
```
GEMINI_API_KEY=your_key_here
GITHUB_TOKEN=your_token_here  # optional
```

## Commands Available

### 1. Investigate a specific line
```bash
cd /Users/arsh/Developer/Projects/Gemini3
// turbo
npm run cli -- investigate <file> --line <n>
```

### 2. Deep Dive (autonomous exploration)
```bash
cd /Users/arsh/Developer/Projects/Gemini3
// turbo  
npm run cli -- deep-dive <file> --depth 3 --verify -o report.md
```

### 3. Watch Mode (continuous monitoring)
```bash
cd /Users/arsh/Developer/Projects/Gemini3
npm run cli -- watch . --investigate --detect-suspicious
```

### 4. Resolve Merge Conflicts
```bash
cd /Users/arsh/Developer/Projects/Gemini3
// turbo
npm run cli -- resolve-conflicts --preview
```

### 5. Apply Conflict Resolutions
```bash
cd /Users/arsh/Developer/Projects/Gemini3
npm run cli -- resolve-conflicts --apply
```

## Usage Examples

To investigate why specific code exists:
1. Open the file in question
2. Note the line number you want to understand
3. Run: `npm run cli -- investigate ./path/to/file.ts --line 42`

To resolve merge conflicts after a failed merge/rebase:
1. Run: `npm run cli -- resolve-conflicts --preview` to see proposed resolutions
2. Review the reasoning for each conflict
3. Run: `npm run cli -- resolve-conflicts --apply` to auto-apply high-confidence fixes
