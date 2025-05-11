import * as vscode from "vscode";
import { CommitInfo } from "./CommitViewer";

class Viewer {
  static insertIntoOuterHTML(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    innerHTML: string
  ): string {
    return `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesheetUri}" rel="stylesheet">
                <script src="${scriptUri}"></script>
                <title>Line Visualization</title>
              </head>
              <body>
                ${innerHTML}
              </body>
            </html>`;
  }

  static getDirectoryHTML(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    directories: string[]
  ): string {
    const innerHTML =
      `
      <div class="visualization-container">` +
      directories
        .map((directory) => {
          return `
              <div class = "directory-container" id="${
                directory === "" ? "." : directory
              }">
              <h2 class = "big-heading" onclick="openDirectoryVisualization('${
                directory === "" ? "." : directory
              }')">${directory === "" ? "." : directory}</h3>
              </div>
              `;
        })
        .join("") +
      `</div>
    `;
    return Viewer.insertIntoOuterHTML(stylesheetUri, scriptUri, innerHTML);
  }

  /**
         * Generates html content of webview to display each commit.
         * 
         * @param stylesheetSrc uri of stylesheet used by webview
        
         * @param stdout output of command used for getting commit message
         * @returns html string to be displayed in webview
    */
  static getCommitsHTML(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    commits: CommitInfo[]
  ) {
    const innerHTML =
      `
      <h1>Relevant Commits</h1>
            <div class="commit-list">` +
      commits
        .map((commit, idx) => {
          return (
            `<div class ="single-commit"> 
                <pre onclick="openDiffFile('${commit.hash}')">${commit.hash}: ${commit.message}</pre>
                  <div onclick="checkoutCommit('${commit.hash}')" class="button"> Checkout </div>
                    <div class = "relevant-lines">` +
                      (commit.relevantLines as string[][])
                        .map((line) => {
                          const isDeletion = line[1].startsWith("-");
                          const backgroundColor = isDeletion ? "red" : "green";
                          return `
                                        <p class="relevant-line ${backgroundColor}-background"> 
                                        <span class="line-label">${line[0]}: </span>${line[1]} 
                                      </p>`;
                        })
                        .join("") +
                        `</div>
                      </div>
                    `);}).join("") +
            `</div>`;
    return Viewer.insertIntoOuterHTML(stylesheetUri, scriptUri, innerHTML);
  }
}

export { Viewer };
