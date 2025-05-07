import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";
import { CommitViewer, CommitInfo } from "./CommitViewer";
import { findRelevancy } from "./findRelevancy.js";

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

  async getLineRelevance() {
    let commitRelevances: {[hash:string]: number} = {};
    const allRelevances = await this.getRelevantCommits();
    for (const commit of allRelevances) {
      commitRelevances[commit.hash] = commit.relevance === undefined || Number.isNaN(commit.relevance) ? 0 : commit.relevance;
    }
    console.log("Commit Relevances: ", commitRelevances);
    let fileRelevances: {[fileName: string]: any[]} = {};
    const fileNamesOut = await this.executeCommand("git ls-files");
    for (const filename of fileNamesOut.split("\n")) {
      if (!filename.includes("threads/")) {
        continue; // TODO: remove this line to get all files
      }
      console.log("Filename: ", filename);
      if (filename.trim() === "") {
        continue;
      }
      const blameOut = await this.executeCommand(`git blame ${filename}`);
      const lines = blameOut.split("\n");
      const content = lines.map((line) => line.split(/\d+\)/));
      const hashesAndContent = content.map((line) => {
        const hash = line[0].split(" ")[0];
        const formattedHash = hash.startsWith("^")?hash.slice(1):hash.slice(0, -1);
        const lineContent = line[1];
        return { hash: formattedHash, lineContent: lineContent };
      });

      // const lines = blameOut.split("\n").map((line) => line.split(" "));
      // const hashesResponsible = lines.map((line) => {
      //   return line[0].startsWith("^")?line[0].slice(1):line[0].slice(0, -1);
      //   }
      // );
      const relevanceOfResponsibleCommits = hashesAndContent.map((object) => {
          // console.log("Hash: ", hash);
          const relevance = commitRelevances[object.hash] === undefined?0: commitRelevances[object.hash];
          // console.log("Relevance: ", relevance);
          return {relevance: relevance, hash: object.hash, content: object.lineContent};
      });
   

      fileRelevances[filename] = relevanceOfResponsibleCommits;
    }
    return fileRelevances;
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

      // Open diff view
      vscode.commands.executeCommand(
        "vscode.diff",
        gitUri,
        absolute,
        `Diff ${file}: ${message.hash} -> present`
      );
    }
  }

  /**
   * 
   * @param hash: hash of specific commit to retrieve. If undefined, retrieves all commits except initial commit.
   * @returns Promise with array of CommitInfo objects representing each commit.
   */
  async getRelevantCommits(hash?: string): Promise<CommitInfo[]> {
    console.log("In getRelevantCommits");
    const command =
      hash === undefined
        ? 'git log --pretty="%h "%s'
        : `git log -n 1 --pretty="%h "%s ${hash}`;
    

    const output = await this.executeCommand(command);
    let commits = this.getCommitInfo(output);
    // if (hash === undefined) {
    //   commits = commits.slice(1, commits.length); // Remove the first commit
    // }
    const commitsRelevance = commits.map(async (commit) =>{
      // const diffOut = await this.executeCommand(`git diff --no-color --unified=0 ${commit.hash}^ ${commit.hash}`);
      const diffOut = await this.executeCommand(`git show ${commit.hash}`);
      const relevantLines:[number, string[][]] = findRelevancy(vscode.Uri.joinPath(
        this.context.extensionUri, "git-files", "test.diff").fsPath, 
        "", new Date(), 
        "autecht", 
        20, 50, [0.5, 0.3, 0.8], 
        diffOut) as [number, string[][]];
      return relevantLines;
    }); 

    const linesAndRelevance = await Promise.all(commitsRelevance);

    commits = commits.map((commit, idx) => {
      return {...commit, relevantLines: linesAndRelevance[idx][1], relevance: linesAndRelevance[idx][0]};
    });

    return commits;
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
