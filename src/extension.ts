// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { exec } from "child_process";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "contextawareversioncontrol" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "contextawareversioncontrol.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage(
        "Hello World from ContextAwareVersionControl!"
      );
    }
  );

  const showCommitsCommand = vscode.commands.registerCommand(
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
      const stylePath = vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "commit-view.css"
      );
      const styleUri = panel.webview.asWebviewUri(stylePath);

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

					panel.webview.html = getCommitViewContent(styleUri, stdout);
        }
      );
      
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(showCommitsCommand);
}

function getCommitViewContent(stylesheetSrc: vscode.Uri, stdout: string) {
  return `<!DOCTYPE html>
			<html lang="en">
		<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relevant Commits</title>
		<link href = "${stylesheetSrc}" rel = "stylesheet">
		</head>
		<body>
		<h1>
		Relevant commits should be displayed eventually
		<div class = "commit-container"> 
			<div class = "commit"> 
				<h4>${stdout}</h4>
			</div>
		</div>
		</h1>
		</body>
</html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
