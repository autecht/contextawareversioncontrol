import * as vscode from "vscode";
import { exec } from "child_process";


interface CommitViewer {
  getViewContent: (stylesheetUri: vscode.Uri, scriptUri: vscode.Uri, commits: CommitInfo[]) => string,
  showCommitsCommand: vscode.Disposable,
  getCommitInfo: (stdout: string) => CommitInfo[],
}

interface CommitInfo{
  hash: string;
  message: string;
}


export function getCommitViewer(context: vscode.ExtensionContext) {
  const viewer: CommitViewer = {
    showCommitsCommand: vscode.commands.registerCommand(
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

          panel.webview.onDidReceiveMessage(
            (message) => {
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
                    const filesChanged = stdout.split("\n").filter((file) => file.trim() !== "");
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

                      const gitUri = absolute.with({ scheme: 'git', path, query: JSON.stringify(params)});

                      // Open diff view
                      vscode.commands.executeCommand('vscode.diff', gitUri, absolute, "Test");
                    }

                  }
                );
                // const filePath = message.filePath;
                // const workspaceFolders = vscode.workspace.workspaceFolders;
                // if (!workspaceFolders) {
                //   return;
                // }
                // const workspaceRoot = workspaceFolders[0].uri.fsPath;
                // const fullPath = `${workspaceRoot}/${filePath}`;
                // vscode.workspace.openTextDocument(fullPath).then((doc) => {
                //   vscode.window.showTextDocument(doc);
                // });
              }
            }
          );
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
          exec(
            command,
            { cwd: workspaceRoot },
            (error, stdout, stderr) => {
              if (error) {
                return;
              }
              const commits = viewer.getCommitInfo(stdout);
              panel.webview.html = viewer.getViewContent(stylesheetUri, scriptUri, commits);
            }
          );
        }
      ),
      /**
       * 
       * @param stylesheetSrc uri of stylesheet used by webview
      
       * @param stdout output of command used for getting commit message
       * @returns html string to be displayed in webview
       */
      getViewContent: (stylesheetUri: vscode.Uri, scriptUri: vscode.Uri, commits:CommitInfo[]) => {
        return `<!DOCTYPE html>
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
            <div class="commit-list">`
            + 
            commits.map(commit => {
              return `<div class ="single-commit" onclick="openDiffFile('${commit.hash}')"> 
                        <pre>${commit.hash} ${commit.message}</pre>
                      </div>`;
            }).join("")              
            
            + `</div>
          </body>
        </html>`;
      },
      /**
       * 
       * @param stdout output of command used for getting commit message
       * @returns array of commit objects containing hash and message
       */
      getCommitInfo: (stdout: string) => {
        const commitLines = stdout.split("\n").filter(line => line.trim() !== "");
        const commits: CommitInfo[] = commitLines.map(line => {
          const [hash, ...messageParts] = line.split(" ");
          const message = messageParts.join(" ");
          return { hash, message };
        });
        return commits;
      },
  };
  return viewer;
}

