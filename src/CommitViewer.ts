import * as vscode from "vscode";
import { exec } from "child_process";


interface CommitViewer {
  getViewContent: (stylesheetUri: vscode.Uri, commits: CommitInfo[]) => string,
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
          const stylesheetPath = vscode.Uri.joinPath(
            context.extensionUri,
            "media",
            "commit-view.css"
          );
          const stylesheetUri = panel.webview.asWebviewUri(stylesheetPath);
    
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
              panel.webview.html = viewer.getViewContent(stylesheetUri, commits);
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
      getViewContent: (stylesheetUri: vscode.Uri, commits:CommitInfo[]) => {
        return `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesheetUri}" rel="stylesheet">
            <title>Commit Viewer</title>
          </head>
          <body>
            <h1>Relevant Commits</h1>`
            + 
            commits.map(commit => {
              return `<div class ="commit-viewer"> 
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

