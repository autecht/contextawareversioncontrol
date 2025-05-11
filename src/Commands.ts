import * as vscode from "vscode";
import { GitNavigator } from "./GitNavigator";
import { Viewer } from "./Viewer";

class Command {
  gitNavigator: GitNavigator;
  context: vscode.ExtensionContext;
  mediaFileName: string;
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string,
    identifier: string,
    title: string
  ) {
    this.gitNavigator = new GitNavigator(context);
    this.context = context;
    this.mediaFileName = mediaFileName;
  }

  getUris(panel: vscode.WebviewPanel) {
    const stylesheetPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      this.mediaFileName + ".css"
    ); 
    const stylesheetUri = panel.webview.asWebviewUri(stylesheetPath);

    const  scriptPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      this.mediaFileName + ".js"
    );
    const scriptUri = panel.webview.asWebviewUri(scriptPath);
    return [stylesheetUri, scriptUri];
  }

  createWebviewPanel(identifier: string, title: string) {
    const panel = vscode.window.createWebviewPanel(
      identifier,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "media"),
        ],
      }
    );
    return panel;
  }

  handleMessage(message: any) {
    if (message.command === "openDiffFile") {
      this.gitNavigator.executeDiffCommand(message);
    }
    if (message.command === "checkoutCommit") {
      vscode.window.showInformationMessage(
        "Checkout commit command Message received in webview"
      );
      const hash: string = message.hash;
      this.gitNavigator.checkoutCommit(hash);
    }
  }
}

class RelevantCommitsVisualization extends Command {
  command: vscode.Disposable;
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string,
    identifier: string,
    title: string
  ) {
    super(context, mediaFileName, identifier, title);
    this.handleMessage = this.handleMessage.bind(this);
    this.command = vscode.commands.registerCommand(
      "contextawareversioncontrol." + identifier,
      () => {
        const panel = this.createWebviewPanel(identifier, title);
        panel.webview.onDidReceiveMessage(this.handleMessage);
        const uris = this.getUris(panel);
        this.gitNavigator.getRelevantCommits().then((commits) => {
          commits = commits.sort((commit1, commit2) => {
            if (commit1.relevance === undefined) {
              return 1; // commit1 is less relevant
            }
            if (commit2.relevance === undefined) {
              return -1; // commit2 is less relevant
            }
            return commit2.relevance - commit1.relevance;
          });

          panel.webview.html = Viewer.getCommitsHTML(
            uris[0],
            uris[1],
            commits
          );
        });
      }
    );
  }
}

class RelevantCommitVisualization extends Command {
  command: vscode.Disposable;
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string,
    identifier: string,
    title: string
  ) {
    super(context, mediaFileName, identifier, title);
    this.handleMessage = this.handleMessage.bind(this);
    this.command = vscode.commands.registerCommand(
      "contextawareversioncontrol." + identifier,
      (hash) => {
        const panel = this.createWebviewPanel(identifier, title);
        panel.webview.onDidReceiveMessage(this.handleMessage);
        const uris = this.getUris(panel);
        this.gitNavigator
          .getRelevantCommits(hash) // TODO: Can this just be the same command
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

            panel.webview.html = Viewer.getCommitsHTML(
              uris[0],
              uris[1],
              commits
            );
          });
      }
    );
  }
}

class LinesRelevanceVisualization extends Command {
  command: vscode.Disposable;
  panel: vscode.WebviewPanel | undefined;
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string,
    identifier: string,
    title: string
    
  ) {
    super(context, mediaFileName, identifier, title);
    this.handleMessage = this.handleMessage.bind(this);
    this.command = vscode.commands.registerCommand(
      "contextawareversioncontrol." + identifier,
      () => {
        const panel = this.createWebviewPanel(identifier, title);
        this.panel = panel;
        panel.webview.onDidReceiveMessage(this.handleMessage);
        const uris = this.getUris(panel);

        this.gitNavigator.getTrackedDirectories().then((directories) => {
          panel.webview.html = Viewer.getDirectoryHTML(
            uris[0],
            uris[1],
            directories
          );
        });
      }
    );
  }

  handleMessage(message: any) {
    if (message.command === "openDirectoryVisualization") {
      vscode.window.showInformationMessage(
        "Open directory visualization command Message received in webview"
      );
      if (this.panel === undefined) {
        console.error("Visualization panel is undefined");
        return;
      }
      this.gitNavigator
        .getLineRelevance(message.directory === "." ? "" : message.directory)
        .then((fileRelevances) => {
          if (this.panel === undefined) {
            console.error("Visualization panel is undefined");
            return;
          }
          this.panel.webview.postMessage({
            directory: message.directory,
            fileRelevances: fileRelevances,
          });
        });
    }
  }
}

export {
  Command,
  LinesRelevanceVisualization,
  RelevantCommitVisualization,
  RelevantCommitsVisualization,
};
