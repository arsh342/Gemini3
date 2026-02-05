# How to Deploy Code Detective 🚀

Since I cannot directly publish to the marketplace without your credentials, here is the step-by-step guide to deploy this extension.

## Prerequisites

1.  **Azure DevOps Personal Access Token (PAT)**
    *   Go to [dev.azure.com](https://dev.azure.com)
    *   User Settings → Personal Access Tokens
    *   Create New Token
    *   Organization: `All accessible organizations`
    *   Scopes: `Marketplace` (select `Acquire` and `Manage`)
    *   **COPY THIS TOKEN immediately!**

2.  **Create a Publisher**
    *   Go to [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
    *   Create a publisher ID (e.g., `your-name-code-detective`)
    *   Update `package.json` with this ID:
        ```json
        "publisher": "your-publisher-id-here"
        ```

3.  **Install vsce**
    ```bash
    npm install -g @vscode/vsce
    ```

## Publishing Steps

1.  **Login**
    ```bash
    vsce login <publisher-id>
    # Paste your Azure PAT when prompted
    ```

2.  **Package**
    ```bash
    npm run package
    # This creates code-detective-0.1.0.vsix
    ```

3.  **Publish**
    ```bash
    vsce publish
    ```
    *   Or upload the `.vsix` file manually at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).

## For Hackathon Submission

1.  Ensure the `code-detective-0.1.0.vsix` is included in your submission files.
2.  Include a link to your public GitHub repository.
3.  Include the demo video (if you made one).

Good luck! 🍀
