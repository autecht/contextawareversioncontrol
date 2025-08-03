import { CommitInfo, File, Line, LineRelevance } from "./types.js";

/**
 * Parse filenames and associated LineRelevances into array of file objects
 *
 * @param fileRelevances dictionary where paths to files are keys and LineRelevance objects are values
 * @returns array of file objects
 */
function createFiles(fileRelevances: {
  [fileName: string]: LineRelevance[];
}): File[] {
  const files: File[] = [];
  for (const fileName in fileRelevances) {
    files.push(createFile(fileName, fileRelevances[fileName]));
  }

  files.sort((a, b) => b.relevance - a.relevance); // sort by relevance, descending
  return files;
}

/**
 * Create File object from path to file and relevance of lines in each file
 *
 * @param fileName path to file
 * @param lineRelevances relevance, commit responsible for, and content of each line in the file
 * @returns representation of file with relevance and content of each line and relevance of file overall
 */
function createFile(fileName: string, lineRelevances: LineRelevance[]): File {
  let avgRelevance = 0;
  const lines: Line[] = [];

  let indentations: number[] = [];

  for (const lineRelevance of lineRelevances) {
    const nextLine: Line = {
      relevance: lineRelevance.relevance,
      hash: lineRelevance.hash,
      content: lineRelevance.content,
      indent: getIndentation(lineRelevance.content),
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

/**
 * @param lineContent content of line being evaluated
 * @returns number of consecutive whitespace characters starting the line, or 1000 if line has no non-whitespace characters
 */
function getIndentation(lineContent: string): number {
  const content = lineContent;
  if (content.trim() === "") {
    return 1000; // if line is empty, return large number so it is not shown
  }
  const indentation = content.search(/\S/); // Find first non-whitespace character
  return indentation === -1 ? 0 : indentation;
}

/**
 * Parses the output of the git log command to extract commit information.
 * @param stdout The output of the git log command.
 * @returns An array of CommitInfo objects containing the commit hash and message.
 */
function parseCommits(stdout: string): CommitInfo[] {
  const commitLines = stdout.split("\n").filter((line) => line.trim() !== "");
  const commits: CommitInfo[] = commitLines.map((line) => {
    const [hash, ...messageParts] = line.split(" ");
    const message = messageParts.join(" ");
    return { hash, message };
  });
  return commits;
}

export { createFiles, getIndentation, parseCommits };
