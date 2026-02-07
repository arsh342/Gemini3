# Code Detective 🕵️‍♂️

> **Git blame tells you WHO. Code Detective tells you WHY.**

An AI-powered code archaeology tool powered by **Gemini 3**. Uncover the hidden history, context, and expertise behind every line of code.

<p align="center">
  <img src="images/icon.png" width="128" height="128" alt="Code Detective Logo">
</p>

---

## 🚀 Why Code Detective?

Every developer has experienced the **"Legacy Code Fear"**: staring at a block of complex, undocumented code and wondering, *"Why does this exist? Who wrote this? If I touch it, will everything break?"*

**Code Detective** solves this by acting as an AI archaeologist. It doesn't just read the code; it reads the *history* of the code.

-   **Understand Intent**: Discover the business logic and edge cases behind "weird" code.
-   **Identify Experts**: Instantly know who to ask for help with the **Expertise Map**.
-   **Measure Health**: Get a concrete **Tech Debt Score** and refactoring plan.
-   **Onboard Faster**: Generate documentation for any part of the codebase in seconds.

---

## ✨ Features

### 🔍 AI Investigation
Right-click any code to launch a deep investigation.
-   **Contextual Analysis**: Traces git history to find the original PRs and issues.
-   **Deep Dive**: Autonomous agents cross-reference multiple files to build a complete picture.
-   **Thinking Process**: Watch Gemini 3's "High Thinking" mode reason through complex history in real-time.

### 📜 Time Travel Timeline
A beautiful, interactive visualization of your code's evolution.
-   **Interactive History**: Scroll through the life of a file.
-   **Diff Analysis**: Click any commit to see exactly what changed.
-   **Searchable**: meaningful search across all commit messages and authors.

### 📊 Tech Debt Score
Gamify your code quality.
-   **AI Grading**: Get an A-F grade for your project.
-   **Factor Analysis**: Break down debt by **Freshness**, **Clarity**, **Complexity**, and **Consistency**.
-   **Actionable Advice**: AI suggests specific steps to improve your score.

### 👥 Who Knows What? (Expertise Map)
Visualize team knowledge distribution.
-   **Expertise Analysis**: Scans commit history to see who owns which modules.
-   **Bus Factor**: Identify parts of the code only one person understands.
-   **Find Mentors**: Know exactly who to ping for help.

### 📘 Instant Onboarding
Turn any folder into a handbook.
-   **Auto-Documentation**: Generates `Overview`, `Architecture`, and `Key Files` docs.
-   **Gotchas**: AI highlights common pitfalls and patterns in the module.

### ⚡ Smart Utils
-   **Commit Message Generator**: Analyses staged changes and writes Conventional Commits for you.
-   **Watch Mode**: Background agent that warns of merge conflicts and remote updates.

---

## 🧠 Powered by Gemini 3

Code Detective utilizes the advanced capabilities of the **Google Gemini 3** model:

*   **Thinking Level HIGH**: We enable Gemini's deep reasoning mode to deduce intent from sparse commit messages.
*   **1M Token Context**: We feed massive amounts of git history and file context into the model for comprehensive analysis.
*   **Multi-Agent System**:
    *   **Lead Detective**: Orchestrates the investigation.
    *   **Historian**: Mines git data.
    *   **Archivist**: Analyzes external context.

---

## 🛠️ Installation & Setup

1.  **Install the Extension** from the VS Code Marketplace.
2.  **Open a Valid Git Repository** in VS Code.
3.  **Configure API Key**:
    *   Get a Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
    *   Run command `Code Detective: Set API Key` OR set `GEMINI_API_KEY` in your environment.

### Configuration Settings

| Setting | Description | Default |
| :--- | :--- | :--- |
| `codeDetective.geminiApiKey` | Your Google Gemini API Key | `null` |
| `codeDetective.thinkingLevel` | AI Reasoning depth (`low`, `medium`, `high`) | `high` |
| `codeDetective.githubToken` | (Optional) GitHub Token for PR analysis | `null` |

---

## 🎮 Usage

### Start an Investigation
1.  Select any code in your editor.
2.  Right-click and choose **"Investigate Code"**.
3.  The **Code Detective** panel will open with your results.

### View Timeline
1.  Open the Command Palette (`Cmd+Shift+P`).
2.  Run **"Code Detective: View Code Timeline"**.

### Analyze Tech Debt
1.  Click the **Code Detective** icon in the Activity Bar (Telescope).
2.  Click **"Tech Debt Score"** in the sidebar.

### Generate Onboarding Docs
1.  Click **"Onboarding Docs"** in the sidebar.
2.  Select the folder you want to document.

---

## 🤝 Contributing

We welcome contributions! Please see our [GitHub Repository](https://github.com/arsh342/Gemini3) for details.

1.  Fork the repo.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for the Google DeepMind Gemini 3 Hackathon.**
