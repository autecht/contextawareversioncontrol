// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CommitViewer } from "./CommitViewer";
import { CommandExecutor } from "./CommandExecutor";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "contextawareversioncontrol" is now active!'
  );

  const commitViewer = new CommitViewer(context);
  context.subscriptions.push(
    commitViewer.showCommitsCommand, 
    commitViewer.showCommitCommand,
    commitViewer.visualizeLinesCommand
  );

  const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
    async provideHover(document, position, token) {
      const line = position.line;
      const fileName = document.fileName;
      
      const commandExecutor = new CommandExecutor(context, commitViewer);
      // const {stdout} = await exec(`git blame -L ${line + 1},${line + 1} ${fileName}`, (error, stdout, stderr) => {
      // });
      const stdout = await commandExecutor.executeCommand(`git blame -L ${line + 1},${line + 1} "${fileName}"`);
      const hash = stdout.split(" ")[0];
      const markdown = new vscode.MarkdownString(
        `[🔍 View Commit](command:contextawareversioncontrol.showCommit?${encodeURIComponent(JSON.stringify([hash]))})`
      );
      markdown.appendMarkdown(`\n\n**Hash:** ${hash}`);
      
      markdown.isTrusted = true;

      return new vscode.Hover(markdown);
    }
  });

  
 

  context.subscriptions.push(hoverProvider);
  
}

// This method is called when your extension is deactivated
export function deactivate() {}
