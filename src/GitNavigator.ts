import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";
import { findRelevancy } from "./findRelevancy.js";

/**
 * Use git commands to extract information from git repo.
 */
class GitNavigator{

  context: vscode.ExtensionContext;
  workspaceRoot: vscode.WorkspaceFolder | undefined;
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }
    this.workspaceRoot = workspaceFolders[0];
  }

  /**
   * Execute command in workspace directory.
   */
  static async executeCommand(context: vscode.ExtensionContext, command: string):Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return "";
    }
    const workspaceRoot = workspaceFolders[0];
    try {
      const promisifiedExec = util.promisify(exec);
      const output = await promisifiedExec(command, {
        cwd: workspaceRoot?.uri.fsPath,
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

  /**
   * Execute command in workspace directory
   * 
   * @param command command to be executed
   * @returns Promise with string which is stdout from command
   */
  async executeCommand(command: string):Promise<string> {
    const stdout = await GitNavigator.executeCommand(this.context, command);
    return stdout;
  }

  /**
   * Retrieves a list of unique directories that contain tracked files in the Git repository.
   *
   * @returns A promise that resolves to an array of unique directory paths as strings, relative to project root.
   *          Each path represents a directory containing at least one tracked file.
   *
   * @throws Will throw an error if the `git ls-files` command fails to execute.
   */
  async getTrackedDirectories(): Promise<string[]> {
    const fileNamesOut = await this.executeCommand("git ls-files");
    const fileNames = fileNamesOut.split("\n");
    let directories = fileNames.map((fileName) => {
      let parts = fileName.split("/");
      parts.pop(); // Remove the last part (file name)
      return parts.join("/");
    });
    directories = [...new Set(directories)];

    return directories;
  }

  /**
   * checkout to commit given by @param hash
   */
  async checkoutCommit(hash: string) {
    await this.executeCommand("git stash");
    await this.executeCommand(`git checkout ${hash}`);
  }

  /**
     * Retrieves commits from repo and evaluates their relevance.
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
      let commits = this.parseCommits(output);
  
      const commitsRelevance = commits.map(async (commit) =>{
        const diffOut = await this.executeCommand(`git diff --no-color --unified=0 ${commit.hash}`);
  
        //get just the files changed between the current and the commit
        const filesChanged = await this.executeCommand(`git diff --name-only ${commit.hash}`);
        const filesChangedArr = filesChanged.split('\n');
  
  
        for (const filePath of filesChangedArr.slice(0, filesChangedArr.length - 1)) {
          const fs = require('fs').promises;
  
          try {
            await fs.access(filePath);
            console.log(`${filePath} exists.`);
          } catch {
            console.log(`${filePath} does not exist.`);
            continue;
          }
  
          const blameOut = await this.executeCommand(`git blame ${filePath}`);
          const blameFileName = filePath.split('/').pop() + '_blame.txt';
  
          await fs.writeFile(blameFileName, blameOut);
        }
  
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
  
      console.log(commits);
  
      return commits;
    }

  
  /**
   * Analyzes the relevance of each line in files within a specified directory
   * based on the relevance of the commits responsible for those lines.
   *
   * @param directory - The directory to filter files by. Only files within this directory
   * will be processed. To include all files, remove the directory filtering logic.
   * 
   * @returns A promise that resolves to an object where each key is a file name and the value
   * is an array of objects representing the relevance of each line in the file. Each object
   * contains:
   * - `relevance`: The relevance score of the commit responsible for the line.
   * - `hash`: The hash of the commit responsible for the line.
   * - `content`: The content of the line.
   *
   * @remarks
   * - If a commit's relevance is undefined or not a number, it defaults to 0.
   * 
   * @throws Will throw an error if any Git command fails.
   */
  async getLineRelevance(directory: string) {
      let commitRelevances: {[hash:string]: number} = {};
      const allRelevances = await this.getRelevantCommits();
      for (const commit of allRelevances) {
        commitRelevances[commit.hash] = commit.relevance === undefined || Number.isNaN(commit.relevance) ? 0 : commit.relevance;
      }
      let fileRelevances: {[fileName: string]: any[]} = {};
      const fileNamesOut = await this.executeCommand("git ls-files");
      for (const filename of fileNamesOut.split("\n")) {
        let parts = filename.split("/");
        parts.pop();
        const directoryName = parts.join("/");
        if (directoryName !== directory){
          continue; // TODO: remove this line to get all files
        }
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

  /**
   * Parses the output of the git log command to extract commit information.
   * @param stdout The output of the git log command.
   * @returns An array of CommitInfo objects containing the commit hash and message.
   */
  parseCommits(stdout: string): CommitInfo[] {
    const commitLines = stdout.split("\n").filter((line) => line.trim() !== "");
    const commits: CommitInfo[] = commitLines.map((line) => {
      const [hash, ...messageParts] = line.split(" ");
      const message = messageParts.join(" ");
      return { hash, message };
    });
    return commits;
  }
  

  /**
   * get files changed from a commit.
   */
  async getFilesChanged(commit: CommitInfo) {
    const output = await this.executeCommand(
      `git diff-tree --no-commit-id --name-only -r ${commit.hash}`
    );
    const filesChanged = output
      .split("\n")
      .filter((file) => file.trim() !== "");
    return filesChanged;
  }
  

  
  /**
   * Opens the vscode diff views for files changed in a specific commit.
   *
   * @param commit - The commit information containing details such as the commit hash.
   * @returns A promise that resolves when all diff views have been opened or if no action is taken.
   */
  async openChangedFileDiffs(commit: CommitInfo): Promise<void> {
    const filesChanged = await this.getFilesChanged(commit);
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
      const params = {
        path: absolute.fsPath,
        ref: commit.hash,
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
        `Diff ${file}: ${commit.hash} -> present`
      );
    }
  }
  
}

/**
 * Represents information about a Git commit.
 * 
 * @interface CommitInfo
 * 
 * @property {string} hash
 * The unique hash identifier of the commit.
 * 
 * @property {string} message
 * The commit message describing the changes made in the commit.
 * 
 * @property {number} [relevance]
 * An optional value indicating the relevance of the commit, such that 0 is not relevant and 1 is highly relevant.
 * 
 * @property {string[][]} [relevantLines]
 * An optional array of string arrays, where each inner array represents
 * 10 lines of content most relevant to the commit.
 */
interface CommitInfo {
  hash: string;
  message: string;
  relevance?:number;
  relevantLines?: string[][]; 
}
export { GitNavigator, CommitInfo};