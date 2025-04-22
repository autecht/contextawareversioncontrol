// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CommitViewer } from "./CommitViewer";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "contextawareversioncontrol" is now active!'
  );

  const commitViewer = new CommitViewer(context);
  context.subscriptions.push(commitViewer.showCommitsCommand);

  const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
    provideHover(document, position, token) {
      const line = position.line;

      const markdown = new vscode.MarkdownString(
        `[🔍 View Commit](command:extension.showCommit?${encodeURIComponent(JSON.stringify([line]))})`
      );
      markdown.isTrusted = true;

      return new vscode.Hover(markdown);
    }
  });

  const showCommitCommand = vscode.commands.registerCommand(
    "extension.showCommit",
    () => {
      vscode.window.showInformationMessage("Commit clicked!");
    }
  );

  
 

  context.subscriptions.push(hoverProvider, showCommitCommand);
  
}

// This method is called when your extension is deactivated
export function deactivate() {}
