// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { GitNavigator } from "./GitNavigator";
import {Client} from 'pg';
import LineRelevanceView from "./webviews/LineRelevanceView";
import RelevantCommitsView from "./webviews/RelevantCommitsView";
import DatabaseManager from "./db/DatabaseManager";
import CommandExecutor from "./CommandExecutor";


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "contextawareversioncontrol" is now active!'
  );
  CommandExecutor.getInstance(context);
  DatabaseManager.openConnection();
  const lineRelevanceVisualization = new LineRelevanceView(context, "line-relevance", "visualizeLines", "Visualize Lines");
  const commitVisualization = new RelevantCommitsView(context, "commit-view", "showCommit", "Show Commit");
  const commitsVisualization = new RelevantCommitsView(context, "commit-view", "showCommits", "Show Commits");
  context.subscriptions.push(
    lineRelevanceVisualization.command, 
    commitVisualization.command,
    commitsVisualization.command
  );

  const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
    async provideHover(document, position, token) {
      const line = position.line;
      const fileName = document.fileName;
      
      const gitNavigator = new GitNavigator(context);
      
      const stdout = await gitNavigator.executeCommand(`git blame -L ${line + 1},${line + 1} "${fileName}"`);
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
export function deactivate() {
  DatabaseManager.closeConnection();
  console.log("Deactivating contextawareversioncontrol extension.");
  // Optionally, you can also close the database connection here if needed
  // DatabaseManager.getInstance().closeConnection();
}
