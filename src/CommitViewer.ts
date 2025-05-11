import * as vscode from "vscode";
import { CommandExecutor } from "./CommandExecutor";
import { Viewer } from "./Viewer";
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
  visualizationPanel: vscode.WebviewPanel | undefined;

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
              panel.webview.html = Viewer.getCommitsHTML(
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
              panel.webview.html = Viewer.getCommitsHTML(
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
        this.visualizationPanel = panel;
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
        this.commandExecutor.getTrackedDirectories().then((directories) => {
          vscode.window.showInformationMessage(directories.toString());
          panel.webview.html = Viewer.getDirectoryHTML(stylesheetUri, scriptUri, directories);
          // panel.webview.html = this.getVisualizationHtml(stylesheetUri, fileRelevances);
        });
    });
  }
  

    

  /**
   *
   * @param message message received from webview
   * Handles messages received from the webview. It checks the command type and executes the corresponding command.
   */
  handleMessage(message: any) {
    vscode.window.showInformationMessage("Handling message from webview");
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
    if (message.command === "openDirectoryVisualization") {
      vscode.window.showInformationMessage("Open directory visualization command Message received in webview");
      if (this.visualizationPanel === undefined) {
        console.error("Visualization panel is undefined");
        return;
      }
      this.commandExecutor.getLineRelevance(message.directory === "."?"":message.directory).then((fileRelevances) => {
        if (this.visualizationPanel === undefined) {
          console.error("Visualization panel is undefined");
          return;
        }
        this.visualizationPanel.webview.postMessage(
          {directory: message.directory,
            fileRelevances: fileRelevances}
          );
      });
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

  

}

export { CommitViewer };
export { CommitInfo };
