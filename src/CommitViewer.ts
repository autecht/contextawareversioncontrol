import * as vscode from "vscode";
import { exec } from "child_process";


interface CommitViewer {
  getViewContent: (stylesheetUri: vscode.Uri, commitMessage: string) => string,
  showCommitsCommand: vscode.Disposable;
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
    
          const command = "git log -1 --pretty=%B";
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
    
              panel.webview.html = viewer.getViewContent(stylesheetUri, stdout);
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
      getViewContent: (stylesheetUri: vscode.Uri, commitMessage: string) => {
        return `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesheetUri}" rel="stylesheet">
            <title>Commit Viewer</title>
          </head>
          <body>
            <div class="commit-viewer">
              <h1>Relevant Commits</h1>
              <pre>${commitMessage}</pre>
            </div>
          </body>
        </html>`;
      },
  };
  return viewer;
}

