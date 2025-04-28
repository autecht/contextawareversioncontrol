import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";
import { CommitViewer, CommitInfo } from "./CommitViewer";

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
    try {
      const promisifiedExec = util.promisify(exec);
      const output = await promisifiedExec(command, {
        cwd: this.workspaceRoot?.uri.fsPath,
      });
      return output.stdout;
    } catch (error) {
      console.error("Error executing command:", error);
      vscode.window.showErrorMessage(
        `Error executing command: ${command}. Error: ${error}`
      );
      return "";
    }
  }

  async executeCheckoutCommand(hash: string) {
    await this.executeCommand("git stash");
    await this.executeCommand(`git checkout ${hash}`);
    // await this.executeCommand(`git stash pop`);
    vscode.window.showInformationMessage(`Checked out commit ${hash}.`);
  }

  async executeDiffCommand(message: CommitInfo) {
    console.log("Executing diff command for commit:", message.hash);
    const output = await this.executeCommand(
      `git diff-tree --no-commit-id --name-only -r ${message.hash}`
    );
    const filesChanged = output
      .split("\n")
      .filter((file) => file.trim() !== "");
    if (filesChanged.length === 0) {
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

export { CommandExecutor };
