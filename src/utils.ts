import CommandExecutor from "./CommandExecutor";
import { parseCommits } from "./parsers";
import * as vscode from "vscode";
import { CommitInfo, LineRelevance, metrics } from "./types";
import { findRelevancy } from "./findRelevancy";
import DatabaseManager from "./db/DatabaseManager";
import * as gitCommands from "./gitCommands";

/**
 * Retrieves commits from repo and evaluates their relevance.
 *
 * @param hash: hash of specific commit to retrieve. If undefined, retrieves all commits except initial commit.
 * @returns Promise with array of CommitInfo objects representing each commit.
 */
async function getRelevantCommits(hash?: string): Promise<CommitInfo[]> {
  let commits = await getCommits(hash);
  // find relevance and relevant lines of each commit
  const linesAndRelevances = await Promise.all(
    await getRelevaceAndLines(commits)
  );

  const relevances = linesAndRelevances.map((item) => item[0]);
  const maxRelevance = Math.max(...relevances);

  commits = await Promise.all(
    commits.map(async (commit, idx) => {
      return {
        ...commit,
        relevantLines: linesAndRelevances[idx][1],
        relevance: linesAndRelevances[idx][0] / maxRelevance,
        comments: await DatabaseManager.getCommentsFromCommit(commit.hash),
      };
    })
  );
  return commits;
}

async function getCommits(hash?: string): Promise<CommitInfo[]> {
  const output = await gitCommands.getLog(hash);
  return parseCommits(output);
}

async function writeResponsibleAuthors(filesChanged: string[]) {
  // write authors responsible
  for (const filePath of filesChanged.slice(0, filesChanged.length - 1)) {
    const fs = require("fs").promises;
    const absFilePath = vscode.Uri.joinPath(
      CommandExecutor.getWorkspaceRoot()!.uri,
      filePath
    ).fsPath;
    try {
      await fs.access(absFilePath);
      // console.log(`${absFilePath} is good.`);
    } catch {
      // console.log(`${absFilePath} does not exist.`);
      continue;
    }

    const blameOut = await gitCommands.getBlame(absFilePath);
    const blameFileName = filePath.split("/").pop() + "_blame.txt";

    await fs.writeFile(blameFileName, blameOut);
  }
}

async function getFilePathsAndLocation(
  editor: vscode.TextEditor | undefined
): Promise<[string, string, number]> {
  if (!editor) {
    console.log("No active text editor found.");
  }
  const repoPath = (await gitCommands.getRepositoryPath())
    .trim()
    .slice(3);
  let lineNumber: number = 0;
  let globalFilePath: string = "";
  let relFilePath: string = "";
  if (editor !== undefined) {
    const position = editor.selection.active;
    lineNumber = position.line;
    globalFilePath = editor.document.uri.fsPath;
    relFilePath = globalFilePath
      .trim()
      .replaceAll("\\", "/")
      .slice(3)
      .replace(repoPath, "")
      .replace("/", "");
  }
  return [globalFilePath, relFilePath, lineNumber];
}

async function getRelevaceAndLines(commits: CommitInfo[]) {
  const editor = vscode.window.activeTextEditor; // active editor needs to be defined before webview is created
  const commitsRelevance = commits.map(async (commit) => {
    //get just the files changed between the current and the commit
    const filesChanged = (
      await gitCommands.getFilesChangedSinceCommit(commit.hash)
    ).split("\n");
    await writeResponsibleAuthors(filesChanged);

    const commitTime = new Date(
      await gitCommands.getCommitDate(commit.hash)
    );
    const firstTime = new Date(
      await gitCommands.getFirstCommitDate()
    );
    const commitMessage = await gitCommands.getCommitMessage(commit.hash);

    const [globalFilePath, relFilePath, lineNumber] =
      await getFilePathsAndLocation(editor);

    const diffOut = await gitCommands.getDiff(commit.hash);
    console.log(
      "Parameters for findRelevancy:",
      "Glabal path ",
      globalFilePath,
      "\n rel: ",
      relFilePath,
      "\n Commit time: ",
      commitTime,
      "\n first time: ",
      firstTime,
      "\n message: ",
      commitMessage,
      "\n number ",
      lineNumber
    );
    const relevantLines: [number, string[][]] = findRelevancy(
      globalFilePath,
      relFilePath,
      commitTime,
      firstTime,
      commitMessage,
      "autecht",
      lineNumber,
      [0.5, 0.3, 0.8, 0.2, 1],
      diffOut
    ) as [number, string[][]];
    return relevantLines;
  });
  return commitsRelevance;
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
async function getLineRelevance(
  directory: string,
  metric: string
): Promise<{ [fileName: string]: LineRelevance[] }> {
  let commitRelevances: { [hash: string]: number } = {};
  let allRelevances;
  if (metric === metrics.recency) {
    allRelevances = await getCommitRecency();
  } else {
    allRelevances = await getRelevantCommits();
  }

  for (const commit of allRelevances) {
    commitRelevances[commit.hash] =
      commit.relevance === undefined || Number.isNaN(commit.relevance)
        ? 0
        : commit.relevance;
  }
  let fileRelevances: { [fileName: string]: LineRelevance[] } = {};
  const fileNamesOut = await gitCommands.getTrackedFiles();
  for (const filename of fileNamesOut.split("\n")) {
    let parts = filename.split("/");
    parts.pop();
    const directoryName = parts.join("/");
    if (directoryName !== directory) {
      continue; // TODO: remove this line to get all files
    }
    if (filename.trim() === "") {
      continue;
    }
    const hashesAndContent = await getResponsibleCommitsAndContent(filename);

    const relevanceOfResponsibleCommits = hashesAndContent.map((object) => {
      const relevance =
        commitRelevances[object.hash] === undefined
          ? 0
          : commitRelevances[object.hash];
      const fileRelevance = {
        relevance: relevance,
        hash: object.hash,
        content: object.lineContent,
      };
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
 * Retrieves a list of unique directories that contain tracked files in the Git repository.
 *
 * @returns A promise that resolves to an array of unique directory paths as strings, relative to project root.
 *          Each path represents a directory containing at least one tracked file.
 *
 * @throws Will throw an error if the `git ls-files` command fails to execute.
 */
async function getTrackedDirectories(): Promise<string[]> {
  const fileNamesOut = await gitCommands.getTrackedFiles();
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
async function checkoutCommit(hash: string) {
  await gitCommands.stashChanges();
  await gitCommands.checkoutCommit(hash);
}

async function getResponsibleCommitsAndContent(filename: string) {
  const blameOut = await gitCommands.getBlame(filename);
  const lines = blameOut.split("\n");
  // line example: ^9e819ea (github-classroom[bot] 2025-01-10 02:13:35 +0000 29)     config = util.load_config(configYamlPath + configFile)
  // wan to keep everything after 29) for line content
  const content = lines.map((line) => line.split(/\d+\)/));
  const hashesAndContent = content.map((line) => {
    const hash = line[0].split(" ")[0];
    const abbreviatedHash = hash.startsWith("^")
      ? hash.slice(1)
      : hash.slice(0, -1); // retrieve abbreviated hash
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
async function getCommitRecency() {
  const now = new Date();
  const output = await gitCommands.getLog();
  let commits = parseCommits(output);
  let maxTimePassed = 0;
  let minTimePassed = Number.MAX_VALUE;
  let commitsWithRelevancePromise = commits.map(async (commit) => {
    let dateOut = await gitCommands.getDate(commit.hash);
    console.log("Here is the dateOut", dateOut);
    dateOut = dateOut.replace(/ -\d{4}$/, "");
    const commitDate = new Date(dateOut);
    const timePassed = now.getTime() - commitDate.getTime();
    if (timePassed > maxTimePassed) {
      maxTimePassed = timePassed;
    }
    if (timePassed < minTimePassed) {
      minTimePassed = timePassed;
    }
    return { ...commit, relevance: timePassed };
  });

  let commitsWithRelevance = await Promise.all(commitsWithRelevancePromise);
  commitsWithRelevance = commitsWithRelevance.map((commit) => {
    commit.relevance =
      (maxTimePassed - commit.relevance) / (maxTimePassed - minTimePassed);
    return commit;
  });
  return commitsWithRelevance;
}

/**
 * get files changed from a commit.
 */
async function getFilesChanged(commit: CommitInfo) {
  const output = await gitCommands.getFilesChangedByCommit(commit.hash);
  const filesChanged = output.split("\n").filter((file) => file.trim() !== "");
  return filesChanged;
}

/**
 * Opens the vscode diff views for files changed in a specific commit.
 *
 * @param commit - The commit information containing details such as the commit hash.
 * @returns A promise that resolves when all diff views have been opened or if no action is taken.
 */
async function openChangedFileDiffs(commit: CommitInfo): Promise<void> {
  const filesChanged = await gitCommands.getFilesChangedSinceCommit(commit.hash);
  if (filesChanged.length === 0) {
    vscode.window.showInformationMessage("No files changed in this commit.");
    return;
  }
  if (!CommandExecutor.workspaceRoot) {
    console.log("No workspace root found.");
    return;
  }

  for (const file of filesChanged) {
    const absolute = vscode.Uri.joinPath(
      CommandExecutor.workspaceRoot.uri,
      file
    );
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

export {
  getRelevantCommits,
  getLineRelevance,
  getTrackedDirectories,
  getCommitRecency,
  getResponsibleCommitsAndContent,
  checkoutCommit,
  getFilesChanged,
  openChangedFileDiffs,
};
