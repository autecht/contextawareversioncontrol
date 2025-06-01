import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";
import { findRelevancy } from "./findRelevancy.js";
import { metrics } from "./Commands.js";
import {File, Line, LineRelevance} from "./types.js";
import { lastKnownEditor, lastKnownFile, lastKnownPosition } from "./extension.js";

/**
 * Use git commands to extract information from git repo.
 */
class GitNavigator{
  createFiles(fileRelevances: { [fileName: string]: LineRelevance[]; }): File[] {
    const files: File[] = [];
    for (const fileName in fileRelevances) {
      files.push(this.createFile(fileName, fileRelevances[fileName]));
    }

    files.sort((a, b) => b.relevance - a.relevance); // sort by relevance, descending
    return files;
  }

  
  createFile(fileName: string, lineRelevances: LineRelevance[]): File {

    let avgRelevance = 0;
    const lines: Line[] = [];

    let indentations: number[] = [];

    // loop through, find 0 indent, call line finder. Indexing into indentations may be somewhat difficult.
    for (const lineRelevance of lineRelevances) {
      const nextLine: Line = {
        relevance: lineRelevance.relevance,
        hash: lineRelevance.hash,
        content: lineRelevance.content,
        indent: this.getIndentation(lineRelevance.content), // so lineRelevance.content is undefined
      };
      avgRelevance += nextLine.relevance;
      indentations.push(nextLine.indent);
      lines.push(nextLine);
    }
    avgRelevance /= lineRelevances.length; // average relevance of all lines in file
    indentations = [...new Set(indentations)]; // remove duplicates
    indentations.sort((a, b) => a - b); // sort indentations from smallest to largest

    const file: File = {
      fileName: fileName,
      relevance: avgRelevance,
      lines: lines,
      indentations: indentations,
    };
    return file;
  }

  getIndentation(lineContent: string): number { // lineContent is undefined
    const content = lineContent;
    const trimmed = content.trim();
    if (content.trim() === "") {
      return 1000; // if line is empty, return large number so it is not shown
    }
    const indentation = content.search(/\S/); // Find first non-whitespace character
    return indentation === -1 ? 0 : indentation;
  }


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
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
          console.log("Editor issue");
      }

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

          const absFilePath = vscode.Uri.joinPath(this.workspaceRoot!.uri, filePath).fsPath;
          try {
            await fs.access(absFilePath);
            // console.log(`${absFilePath} is good.`);
          } catch {
            // console.log(`${absFilePath} does not exist.`);
            continue;
          }

          const blameOut = await this.executeCommand(`git blame ${filePath}`);
          const blameFileName = filePath.split('/').pop() + '_blame.txt';

          await fs.writeFile(blameFileName, blameOut);
        }

        const gitTopLevel = (await this.executeCommand(`git rev-parse --show-toplevel`)).trim().slice(3);
        const commitTime = new Date(await this.executeCommand(`git log -1 --format=%ci ${commit.hash}`));
        const firstTime = new Date(await this.executeCommand(`git log --max-parents=0 --format=%ci`));
        console.log(firstTime);
        const commitMessage = await this.executeCommand(`git log --format=%B -n 1 ${commit.hash}`);


        let position: vscode.Position;
        let lineNumber: number = 0;
        let globalFileLoc: string = "";
        let relFileLoc: string = "";

        if (editor) {
          position = editor.selection.active;
          lineNumber = position.line;
          globalFileLoc = editor.document.uri.fsPath;
          relFileLoc = globalFileLoc.trim().replaceAll("\\", "/").slice(3).replace(gitTopLevel, "").replace("/", "");
        }
        else if (lastKnownFile && lastKnownPosition) {
          position = lastKnownPosition;
          lineNumber = position.line;
          globalFileLoc = lastKnownFile.fsPath;
          relFileLoc = globalFileLoc.trim().replaceAll("\\", "/").slice(3).replace(gitTopLevel, "").replace("/", "");
        }
        else {
          vscode.window.showErrorMessage("No active editor or last known file/position found. Cannot determine line number and file location.");
          return []; // Return empty relevance if no editor or last known file/position
        }
        
        
        const relevantLines:[number, string[][]] = findRelevancy(
          globalFileLoc, 
          relFileLoc,
          commitTime, 
          firstTime,
          commitMessage, 
          "autecht", 
          lineNumber, [0.5, 0.3, 0.8, 0.2, 1], 
          diffOut) as [number, string[][]];
        return relevantLines;
      }); 

      const linesAndRelevance = await Promise.all(commitsRelevance);

      const justRelevance = linesAndRelevance.map(item => item[0]);
      const maxRelevance = Math.max(...justRelevance);

      commits = commits.map((commit, idx) => {
        return {...commit, relevantLines: linesAndRelevance[idx][1], relevance: linesAndRelevance[idx][0] / maxRelevance};
      });

      console.log(commits);

      return commits;
    }

  

  private async getResponsibleCommitsAndContent(filename: string) {
        
        const blameOut = await this.executeCommand(`git blame ${filename}`);
        const lines = blameOut.split("\n");
        // line example: ^9e819ea (github-classroom[bot] 2025-01-10 02:13:35 +0000 29)     config = util.load_config(configYamlPath + configFile)  
        // wan to keep everything after 29) for line content
        const content = lines.map((line) => line.split(/\d+\)/)); 
        const hashesAndContent = content.map((line) => {
          const hash = line[0].split(" ")[0];
          const abbreviatedHash = hash.startsWith("^")?hash.slice(1):hash.slice(0, -1); // retrieve abbreviated hash
          // line[1] should be something like "     config = util.load_config(configYamlPath + configFile)  "
          const lineContent = line[1];
          console.log("Line content:", lineContent);
          return { hash: abbreviatedHash, lineContent: lineContent }; // seems to be preserving indentation
        });
        return hashesAndContent;
  }


  /**
   * Retrieves the recency of commits in the repo as a number between 0 and 1.
   *
   * @returns A promise that resolves to an array of CommitInfo objects with their relevance scores.
   *
   * @throws Will throw an error if any Git command fails.
   */
  private async getCommitRecency() {
        const now = new Date();
        const output = await this.executeCommand('git log --pretty="%h "%s');
        let commits = this.parseCommits(output);
        let maxTimePassed = 0;
        let minTimePassed = Number.MAX_VALUE;
        let commitsWithRelevancePromise = commits.map(async (commit) =>{
          
          let dateOut = await this.executeCommand(`git show -s --format=%ci ${commit.hash}`);
          console.log("Here is the dateOut", dateOut);
          dateOut = dateOut.replace(/ -\d{4}$/, "");
          const commitDate  = new Date(dateOut);
          const timePassed = now.getTime() - commitDate.getTime();
          if (timePassed > maxTimePassed){
            maxTimePassed = timePassed;
          }
          if (timePassed < minTimePassed){
            minTimePassed = timePassed;
          }
          return {...commit, relevance: timePassed};
        }); 

        let commitsWithRelevance = await Promise.all(commitsWithRelevancePromise);
        commitsWithRelevance = commitsWithRelevance.map((commit) => {
          commit.relevance = (maxTimePassed - commit.relevance) / (maxTimePassed - minTimePassed);
          return commit;
        });
        return commitsWithRelevance;
  }
  /**
   * Analyzes the relevance of each line in files within a specified directory
   * based on the relevance of the commits responsible for those lines.
   *
   * @param directory - The directory to filter files by. Only files within this directory
   * will be processed. To include all files, remove the directory filtering logic.
   * @param metric - The metric used to determine relevance. Can be "recency" or "other", which uses findRelevancy.
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
  async getLineRelevance(directory: string, metric: string): Promise<{[fileName: string]: LineRelevance[]}> {
      
      let commitRelevances: {[hash:string]: number} = {};
      let allRelevances;
      if (metric === metrics.recency) {
        allRelevances = await this.getCommitRecency();
      }
      else {
        allRelevances = await this.getRelevantCommits();
      }
      
      for (const commit of allRelevances) {
        commitRelevances[commit.hash] = commit.relevance === undefined || Number.isNaN(commit.relevance) ? 0 : commit.relevance;
      }
      let fileRelevances: {[fileName: string]: LineRelevance[]} = {};
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
        const hashesAndContent = await this.getResponsibleCommitsAndContent(filename);
        
        const relevanceOfResponsibleCommits = hashesAndContent.map((object) => {
            const relevance = commitRelevances[object.hash] === undefined?0: commitRelevances[object.hash];
            const fileRelevance = {relevance: relevance, hash: object.hash, content: object.lineContent};
            if (fileRelevance.content === undefined) {
              fileRelevance.content = "";
            }
            return fileRelevance;
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


