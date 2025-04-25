import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";

interface CommitInfo {
  hash: string;
  message: string;
}

class CommandExecutor {
  context: vscode.ExtensionContext;
  workspaceRoot: vscode.WorkspaceFolder | undefined;
  commitViewer: CommitViewer;
  constructor(context: vscode.ExtensionContext, commitViewer: CommitViewer) {
    this.commitViewer = commitViewer;
    this.context = context;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }
    const workspaceRoot = workspaceFolders[0];
    this.workspaceRoot = workspaceRoot;
  }

  async executeCommand(command: string): Promise<string> {
    const promisifiedExec = util.promisify(exec);
    const output = await promisifiedExec(command, {
      cwd: this.workspaceRoot?.uri.fsPath,
    });
    return output.stdout;
  }

  async executeDiffCommand(message: CommitInfo) {
    console.log("Executing diff command for commit:", message.hash);
    const output = await this.executeCommand(
      `git diff-tree --no-commit-id --name-only -r ${message.hash}`
    );
    const filesChanged = output
      .split("\n")
      .filter((file) => file.trim() !== "");
    if(filesChanged.length === 0) {
      vscode.window.showInformationMessage("No files changed in this commit.");
      return;
    }
    if (!this.workspaceRoot) {
      console.log("No workspace root found.");
      return;
    }

    for (const file of filesChanged) {
      const absolute = vscode.Uri.joinPath(this.workspaceRoot.uri, file);
      // For files in the repo root
      const params = {
        path: absolute.fsPath,
        ref: message.hash,
      };
      const path = absolute.path;

      const gitUri = absolute.with({
        scheme: "git",
        path,
        query: JSON.stringify(params),
      });

      console.log("About to open diff view");
      // Open diff view
      vscode.commands.executeCommand(
        "vscode.diff",
        gitUri,
        absolute,
        `Diff ${file}: ${message.hash} -> present`
      );
    }
  }

  async executeLogCommand(panel: vscode.WebviewPanel, hash?: string) {
    const command =
      hash === undefined
        ? 'git log --pretty="%h "%s'
        : `git log -n 1 --pretty="%h "%s ${hash}`;
    const stylesheetPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "commit-view.css"
    );
    const stylesheetUri = panel.webview.asWebviewUri(stylesheetPath);

    const scriptPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "commit-view.js"
    );
    const scriptUri = panel.webview.asWebviewUri(scriptPath);

    const output = await this.executeCommand(command);
    const commits = this.getCommitInfo(output);

    panel.webview.html = this.commitViewer.getViewContent(
      stylesheetUri,
      scriptUri,
      commits
    );
  }

  /**
   * Parses the output of the git log command to extract commit information.
   * @param stdout The output of the git log command.
   * @returns An array of CommitInfo objects containing the commit hash and message.
   */
  getCommitInfo(stdout: string): CommitInfo[] {
    const commitLines = stdout.split("\n").filter((line) => line.trim() !== "");
    const commits: CommitInfo[] = commitLines.map((line) => {
      const [hash, ...messageParts] = line.split(" ");
      const message = messageParts.join(" ");
      return { hash, message };
    });
    return commits;
  }
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
        this.commandExecutor.executeLogCommand(panel);
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


  handleMessage(message: any) {
    if (message.command === "openDiffFile") {
      vscode.window.showInformationMessage("Open Diff file command Message received in webview");
      console.log("Message received");
      this.commandExecutor.executeDiffCommand(message);
    }
  }
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
        .map((commit) => {
          return `<div class ="single-commit" onclick="openDiffFile('${commit.hash}')"> 
                        <pre>${commit.hash} ${commit.message}</pre>
                      </div>`;
        })
        .join("") +
      `</div>
          </body>
        </html>`
    );
  }
}

export { CommitViewer };
export { CommitInfo, CommandExecutor };
