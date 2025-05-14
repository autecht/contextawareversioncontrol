import * as vscode from "vscode";
import * as path from 'path';
import { GitNavigator } from "./GitNavigator";
import { Viewer } from "./Viewer";


/**
 * Represents extension command with associated webview.
 */
class Command {
  gitNavigator: GitNavigator; // GitNavigator to obtain necessary information from git repo.
  context: vscode.ExtensionContext; // this extension's ExtensionContext
  mediaFileName: string; // name of script and stylesheet without extension in media folder
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

  /**
   *
   * @param panel panel created for this command's webview
   * @returns uris of stylesheet and javascript file for webview of this command.
   */
  getUris(panel: vscode.WebviewPanel): vscode.Uri[] {
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

  /**
   * Create initial webview for command.
   *
   * @param identifier: unique identifier to access command.
   * @param title: visible title of command and webview.
   * @returns panel of blank webview.
   */
  createWebviewPanel(identifier: string, title: string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      identifier,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "media"),
        ],
        retainContextWhenHidden: true,
      }
    );
    return panel;
  }

  
  /**
   * Handles incoming messages and executes corresponding commands.
   *
   * @param message - The message object containing the command and any associated data.
   * 
   * Supported commands:
   * - `openDiffFile`: Opens the diff view for changed files using the `gitNavigator`.
   * - `checkoutCommit`: Checks out a specific commit by its hash and displays an information message.
   *   - `message.hash` (string): The hash of the commit to be checked out.
   */
  handleMessage(message: any) {
    if (message.command === "openDiffFile") {
      this.gitNavigator.openChangedFileDiffs(message);
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

/**
 * Command to visualize all commits in the repo.
 */
class RelevantCommitsVisualization extends Command {
  /**
   * Disposable to be pushed to extension.
   */
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


/**
 * Command to show information and relevance about a single commit and allow checkout and opening diff files.
 */
class RelevantCommitVisualization extends Command {
  /**
    * Command to be pushed to extension.
   */
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

/**
 * Command to visualize relevance of each line of any tracked files. 
 */
class LinesRelevanceVisualization extends Command {
  /**
    * Command to be pushed to extension.
   */
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
          panel.webview.html = Viewer.getDirectoryListingHTML(
            uris[0],
            uris[1],
            directories
          );
        });
      }
    );
  }

  /**
   * Handles incoming messages and processes commands accordingly.
   *
   * @param message - The message object containing the command and additional data.
   * 
   * Commands:
   * - `"openDirectoryVisualization"`: Processes the directory visualization request.
   *   - Retrieves file relevance data for the specified directory and sends it to the webview.
   * 
   * @remarks
   * - If the `directory` in the message is `"."`, it is treated as the root directory.
   */
  handleMessage(message: any) {
    if (message.command === "openDirectoryVisualization") {
      vscode.window.showInformationMessage(
        "Open directory visualization command Message received in webview"
      );
      if (this.panel === undefined) {
        console.error("Visualization panel is undefined");
        return;
      }
      const adjustedDirectory = message.directory === ""? "root":message.directory;
      this.gitNavigator
        .getLineRelevance(adjustedDirectory)
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
    if (message.command === "openFile") {
      const relativePath = message.fileName;
      const workspace = vscode.workspace.workspaceFolders;
      if (workspace === undefined) {
        vscode.window.showErrorMessage("No workspace open");
        return;
      }
      const projectRoot = workspace[0].uri.fsPath;
      const absolutePath = path.join(projectRoot, relativePath);
      const fileUri = vscode.Uri.file(absolutePath);
      try{
        vscode.workspace.openTextDocument(fileUri).then(
          (document) => {
            vscode.window.showTextDocument(document, {preview: false});
          }
        );
        
      
      }catch{
      
      }
    }
  }
}

export {
  Command,
  LinesRelevanceVisualization,
  RelevantCommitVisualization,
  RelevantCommitsVisualization,
};
