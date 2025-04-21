import * as vscode from "vscode";
import { exec } from "child_process";



interface CommitInfo {
  hash: string;
  message: string;
}

class CommitViewer {

  showCommitsCommand: vscode.Disposable;

  constructor(context: vscode.ExtensionContext) {
    this.showCommitsCommand = vscode.commands.registerCommand(
      "contextawareversioncontrol.showCommits",
      () => {
        const panel = vscode.window.createWebviewPanel(
          "showCommits",
          "Relevant Commits",
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, "media"),
            ],
          }
        );

        panel.webview.onDidReceiveMessage((message) => {
          if (message.command === "openDiffFile") {
            console.log("Message received");

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
              return;
            }
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            exec(
              "git diff-tree --no-commit-id --name-only -r " + message.hash,
              { cwd: workspaceRoot },
              (error, stdout, stderr) => {
                if (error) {
                  return;
                }
                console.log("stdout", stdout);
                const filesChanged = stdout
                  .split("\n")
                  .filter((file) => file.trim() !== "");
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                  return;
                }
                const workspaceRoot = workspaceFolders[0];

                for (const file of filesChanged) {
                  const absolute = vscode.Uri.joinPath(workspaceRoot.uri, file);
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

                  // Open diff view
                  vscode.commands.executeCommand(
                    "vscode.diff",
                    gitUri,
                    absolute,
                    `Diff ${file}: ${message.hash} -> present`
                  );
                }
              }
            );
          }
        });
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

        const command = 'git log --pretty="%h "%s';
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        exec(command, { cwd: workspaceRoot }, (error, stdout, stderr) => {
          if (error) {
            return;
          }
          const commits = this.getCommitInfo(stdout);
          panel.webview.html = this.getViewContent(
            stylesheetUri,
            scriptUri,
            commits
          );
        });
      }
    );
  }
  getCommitInfo(stdout: string): CommitInfo[] {
      const commitLines = stdout
        .split("\n")
        .filter((line) => line.trim() !== "");
      const commits: CommitInfo[] = commitLines.map((line) => {
        const [hash, ...messageParts] = line.split(" ");
        const message = messageParts.join(" ");
        return { hash, message };
      });
      return commits;
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
export { CommitInfo };

