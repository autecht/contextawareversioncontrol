import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";
import { findRelevancy } from "./findRelevancy.js";
import { Comment, CommitInfo, File, Line, LineRelevance, metrics } from "./types.js";
import DatabaseManager from "./db/DatabaseManager.js";

function createFiles(fileRelevances: { [fileName: string]: LineRelevance[] }): File[] {
    const files: File[] = [];
    for (const fileName in fileRelevances) {
      files.push(createFile(fileName, fileRelevances[fileName]));
    }

    files.sort((a, b) => b.relevance - a.relevance); // sort by relevance, descending
    return files;
}

function createFile(fileName: string, lineRelevances: LineRelevance[]): File {
    let avgRelevance = 0;
    const lines: Line[] = [];

    let indentations: number[] = [];

    // loop through, find 0 indent, call line finder. Indexing into indentations may be somewhat difficult.
    for (const lineRelevance of lineRelevances) {
      const nextLine: Line = {
        relevance: lineRelevance.relevance,
        hash: lineRelevance.hash,
        content: lineRelevance.content,
        indent: getIndentation(lineRelevance.content), // so lineRelevance.content is undefined
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

  function getIndentation(lineContent: string): number {
      // lineContent is undefined
      const content = lineContent;
      const trimmed = content.trim();
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

export { createFiles, createFile, getIndentation, parseCommits };