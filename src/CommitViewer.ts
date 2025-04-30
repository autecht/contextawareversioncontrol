import * as vscode from "vscode";
import { CommandExecutor } from "./CommandExecutor";
interface CommitInfo {
  hash: string;
  message: string;
}

class CommitViewer {
  showCommitsCommand: vscode.Disposable;
  showCommitCommand: vscode.Disposable;
  commandExecutor: CommandExecutor;

  constructor(context: vscode.ExtensionContext) {
    this.commandExecutor = new CommandExecutor(context, this);
    this.handleMessage = this.handleMessage.bind(this); // Bind the method to the class instance

    this.showCommitsCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.showCommits",
      () => {
        const panel = this.createWebviewPanel(
          context,
          "showCommits",
          "Relevant Commits"
        );
        panel.webview.onDidReceiveMessage(this.handleMessage);

        const stylesheetPath = vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "commit-view.css"
        );
        const stylesheetUri = panel.webview.asWebviewUri(stylesheetPath);

        const scriptPath = vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "commit-view.js"
        );
        const scriptUri = panel.webview.asWebviewUri(scriptPath);
        this.commandExecutor
          .executeLogCommand(panel)
          .then((commits: CommitInfo[]) => {

            // TODO: change logic to get relevant commits from findRelevancy()
            const relevantLines = commits.map((commit) => {
              return Array.from({ length: 11 }, (_, i) => i + 10).map((i)=> {
                return ["./nachos/threads/KThread.java", i%2===0?`+      "resolved": "https://registry.npmjs.org/diffparser/-/diffparser-2.0.1.tgz",`:`-    "typescript": "^5.8.2",`];
            });
            });

            panel.webview.html = this.getViewContent(
              stylesheetUri,
              scriptUri,
              commits,
              relevantLines
            );
          });
      }
    );

    this.showCommitCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.showCommit",
      (hash) => {
        const panel = this.createWebviewPanel(
          context,
          "showCommit",
          "Selected Commit"
        );
        panel.webview.onDidReceiveMessage(this.handleMessage);
        this.commandExecutor.executeLogCommand(panel, hash);
      }
    );
  }

  /**
   *
   * @param message message received from webview
   * Handles messages received from the webview. It checks the command type and executes the corresponding command.
   */
  handleMessage(message: any) {
    if (message.command === "openDiffFile") {
      this.commandExecutor.executeDiffCommand(message);
    }
    if (message.command === "checkoutCommit") {
      vscode.window.showInformationMessage(
        "Checkout commit command Message received in webview"
      );
      const hash: string = message.hash;
      this.commandExecutor.executeCheckoutCommand(hash);
    }
  }

  /**
   * * Creates a webview panel in a new column with no information.
   */
  createWebviewPanel(
    context: vscode.ExtensionContext,
    identifier: string,
    title: string
  ) {
    const panel = vscode.window.createWebviewPanel(
      identifier,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      }
    );
    return panel;
  }

  /**
       * Generates html content of webview to display each commit.
       * 
       * @param stylesheetSrc uri of stylesheet used by webview
      
       * @param stdout output of command used for getting commit message
       * @returns html string to be displayed in webview
  */
  getViewContent(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    commits: CommitInfo[],
    relevantLines: string[][][]
  ): string {
    return (
      `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesheetUri}" rel="stylesheet">
            <script src="${scriptUri}"></script>
            <title>Commit Viewer</title>
          </head>
          <body>
            <h1>Relevant Commits</h1>
            <div class="commit-list">` +
      commits
        .map((commit, idx) => {
          return `<div class ="single-commit"> 
                        <pre onclick="openDiffFile('${commit.hash}')">${commit.hash}: ${commit.message}</pre>
                        <div onclick="checkoutCommit('${commit.hash}')" class="button"> Checkout </div>

                        <div class = "relevant-lines">`
                        + relevantLines[idx].map((line) => {
                            const isDeletion = line[1].startsWith("-");
                            const backgroundColor = isDeletion ? "red" : "green";
                            return `
                              <p class="relevant-line ${backgroundColor}-background"> 
                              <span class="line-label">${line[0]}: </span>${line[1]}
                            </p>`;
                        }).join("") 
                        +`</div>
                      </div>
                    `;
        })
        .join("") +
      `</div>
          </body>
        </html>`
    );
  }
}

export { CommitViewer };
export { CommitInfo };
