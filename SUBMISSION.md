## Inspiration

Every developer has experienced the "Legacy Code Fear": staring at a block of complex, undocumented code and wondering, *"Why does this exist? Who wrote this? If I touch it, will everything break?"*

Git blame tells you **WHO** wrote the code and **WHEN**. But it never tells you **WHY**.

We were inspired by the concept of **Software Archaeology**—treating a codebase not just as text files, but as a living history of decisions, constraints, and trade-offs. We wanted to build a tool that acts as a "Lead Detective," piecing together the story behind every line of code so developers can modify legacy systems with confidence, not fear.

## What it does

**Code Detective** is an AI-powered VS Code extension that uncovers the hidden context behind your code.

1.  **🕵️‍♂️ Automated Investigation**: Right-click any code to launch an AI investigation. It traces the git history, analyzes commit messages, and explains *why* the code was written the way it is.
2.  **⏳ Interactive Timeline**: Visualizes the evolution of a file or module over time. See exactly when and how code changed with a beautiful, interactive timeline view.
3.  **🧠 Tech Debt Score**: Analyzes your project's health using factors like "Code Freshness," "Clarity," and "Complexity," giving you an A-F grade and actionable refactoring advice.
4.  **🗺️ Who Knows What (Expertise Map)**: Automatically identifies which developers own which parts of the codebase. Great for finding the right person to ask for help or identifying "bus factor" risks.
5.  **📘 Instant Onboarding**: Generates comprehensive onboarding documentation for any folder in seconds, explaining architecture, key files, and common patterns.
6.  **✍️ Smart Commits**: Analyses your staged changes and generates Conventional Commit messages automatically.

## How we built it

We built **Code Detective** as a native **VS Code Extension** using TypeScript. The core intelligence is powered by **Google's Gemini 3** model, specifically leveraging its **`thinking_level="HIGH"`** capability for deep reasoning.

*   **Multi-Agent Architecture**: We designed a system of specialized agents:
    *   **Lead Detective**: The orchestrator that plans the investigation.
    *   **Historian Agent**: Interacts with `simple-git` to mine the repository's history.
    *   **Archivist Agent**: ( planned ) Checks GitHub Issues/PRs for external context.
    *   **TechDebt & Timeline Agents**: Specialized analysis agents for specific views.
*   **VS Code Webviews**: We built rich, interactive HTML/CSS/JS interfaces for the Timeline, Tech Debt Report, and Expertise Map to go beyond standard text output.
*   **Gemini 1.5 Pro/Flash**: Used for faster tasks like commit message generation and summarization.

## Challenges we ran into

*   **Context Window Limits**: Git history can be massive. We had to intelligently filter and summarize generic commit logs before feeding them to the AI to stay within token limits while still capturing the full story.
*   **VS Code API Complexity**: Managing state between the extension backend and the webview frontend is tricky. We had to build a robust message-passing system to handle updates like "Deep Dive" progress in real-time.
*   **Packaging & Deployment**: We faced issues with `.env` files and large `node_modules` being included in the final `.vsix` package, which caused deployment failures. We learned the hard way how critical a proper `.vscodeignore` file is!

## Accomplishments that we're proud of

*   **Shipped to Marketplace**: We successfully published **Code Detective v0.1.0** to the Visual Studio Marketplace!
*   **"Who Knows What" Visualization**: We're really proud of the Expertise Map. Seeing a visual representation of team knowledge distribution is a powerful "Aha!" moment for many teams.
*   **Gemini's Reasoning**: Getting Gemini to "think" like a detective—deducing intent from commit messages and code changes—feels generic. Seeing it correctly infer *why* a "magic number" exists based on a 3-year-old commit message was a huge win.

## What we learned

*   **Agents Need Structure**: Giving LLMs open-ended tasks often leads to wandering. Giving them specific roles (Historian, Archivist) and tools makes them significantly more effective.
*   **History is Messy**: Real-world git history is full of "fix typo," "wip," and merge commits. Filtering this noise is essential for good analysis.
*   **Thinking Models**: Gemini 3's "Thinking" process is perfect for this use case. We expose this thinking stream to the user so they can trust *how* the AI reached its conclusion.

## What's next for Code Detective

*   **JIRA/Linear Integration**: Linking code directly to the tickets that spawned it for even richer context.
*   **"Risky Change" Interceptor**: A background agent that warns you *before* you save a file if you're editing a high-risk, legacy component without enough tests.
*   **Team Knowledge Graph**: Persisting the "Who Knows What" map to a shared database so the whole team can access it without re-analyzing locally.

## Built With

-   **TypeScript**
-   **Visual Studio Code Extension API**
-   **Google Gemini API**
-   **Google Cloud Vertex AI**
-   **Node.js**
-   **Simple-Git**
-   **HTML5 & CSS3**
