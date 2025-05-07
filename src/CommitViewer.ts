import * as vscode from "vscode";
import { CommandExecutor } from "./CommandExecutor";
import { findRelevancy } from './findRelevancy.js';
import { execSync } from 'child_process';
interface CommitInfo {
  hash: string;
  message: string;
  relevance?:number;
  relevantLines?: string[][]; // Array of string arrays, where each string array contains two strings: filename changed and line content of relevant line changed
}

class CommitViewer {
  showCommitsCommand: vscode.Disposable;
  showCommitCommand: vscode.Disposable;
  visualizeLinesCommand: vscode.Disposable;
  commandExecutor: CommandExecutor;

  constructor(context: vscode.ExtensionContext) {
    this.commandExecutor = new CommandExecutor(context, this);
    this.handleMessage = this.handleMessage.bind(this); // Bind the method to the class instance

    this.showCommitsCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.showCommits",
      () => {
        vscode.window.showInformationMessage("Showing relevant commits");
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
        this.commandExecutor.getRelevantCommits()
          .then((commits) => {
            commits = commits.sort((commit1, commit2) => {
              if (commit1.relevance === undefined) {
                return 1; // commit1 is less relevant
              }
              if (commit2.relevance === undefined) {
                return -1; // commit2 is less relevant
              }
              return commit2.relevance - commit1.relevance;
            });

            // TODO: change logic to get relevant commits from findRelevancy()
              panel.webview.html = this.getViewContent(
                stylesheetUri,
                scriptUri,
                commits
              );
            });
          });
      


    this.showCommitCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.showCommit",
      (hash) => {
        const panel = this.createWebviewPanel(
          context,
          "showCommit",
          "Selected Commit"
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
        this.commandExecutor.getRelevantCommits(hash)
          .then((commits) => {
              panel.webview.html = this.getViewContent(
                stylesheetUri,
                scriptUri,
                commits
              );
            });

          });

    this.visualizeLinesCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.visualizeLines",
      () => {
        vscode.window.showInformationMessage("Showing relevant commits");
        const panel = this.createWebviewPanel(
          context,
          "visualizeLines",
          "Visualize Lines"
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
        
        // first step is to get the relevance of line blamed for each
        this.commandExecutor.getLineRelevance().then((fileRelevances) => {
          panel.webview.html = this.getVisualizationHtml(stylesheetUri, fileRelevances);
        });
    });
  }
  getVisualizationHtml(stylesheetUri: vscode.Uri,fileRelevances: { [fileName: string]: any[]; }): string {
    console.log("In getVisualizationHtml");
    return `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesheetUri}" rel="stylesheet">
            <title>Line Visualization</title>
          </head>
          <body>` + 
          Object.keys(fileRelevances).map((fileName) => {
            return `
              <div class="relevance-container">
              <h3>${fileName}</h3>
              <div class="file-relevance">
                ${fileRelevances[fileName].map((commit, idx) => {
                  const background = 255 - Math.round(commit.relevance * 255);
                  const color = `rgb(${background}, ${background}, ${background})`;
                  return `<div class="line-relevance" style="background-color:${color}">Line ${idx + 1}: ${commit.relevance} ${commit.hash}</div>`;
                })
                
                }
              </div>
              </div>
              `;

          }).join("")
          +
          `</body>
        </html>`;
    throw new Error("Method not implemented.");
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
    commits: CommitInfo[]
  ): string {
    // TODO: line content seems to be trimmed in the middle where there are multiple spaces
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
                        + (commit.relevantLines as string[][]).map((line) => {
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
