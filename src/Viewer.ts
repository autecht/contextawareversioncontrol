import * as vscode from "vscode";
import { CommitInfo } from "./GitNavigator";
import { metrics } from "./Commands";

/**
 * The `Viewer` class provides utility methods to generate HTML content for webviews.
 * - The `Viewer` class assumes that the provided URIs and data are valid and properly formatted.
 * - The generated HTML includes inline event handlers (e.g., `onclick`) for interactivity, which may require corresponding JavaScript functions to be defined in the included script.
 */
class Viewer {
  /**
   *
   * Generates a complete HTML document by embedding a stylesheet, script, and body content.
   *
   * @param stylesheetUri: URI of the CSS stylesheet to include in the webview.
   * @param scriptUri: URI of the JavaScript file to include in the webview.
   * @param innerHTML: The HTML content to be placed inside the `<body>` tag.
   * @returns A string containing the complete HTML document.
   */
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

  /**
   * Generates HTML content for initial line relevance visualization webview.
   *
   * @param stylesheetUri: URI of the CSS stylesheet to include in the webview.
   * @param scriptUri: URI of the JavaScript file to include in the webview.
   * @param directories: An array of tracked directories which will be displayed
   * @returns string containing HTML document with clickable directories listed.
   */
  static getDirectoryListingHTML(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    directories: string[]
  ): string {
    const innerHTML =
      `
      <div class="visualization-container">
      
      <div class = "row">` +
      Object.values(metrics)
        .map(
          (metric) =>
            `<button onclick="chooseMetric('${metric}')">${metric}</button>`
        )
        .join("") +
      `</div>
      ` +
      directories
        .map((directory) => {
          const adjustedDirectory = directory === "" ? "root" : directory;
          return `
              <div class = "directory-container" id="${adjustedDirectory}">
            <div id = "${adjustedDirectory}-heading-container" class="row"> <h2 class = "big-heading" onclick="openDirectoryVisualization('${adjustedDirectory}')">${
            directory === "" ? "." : directory
          }</h3>
              </div> </div>
              `;
        })
        .join("") +
      `</div>
    `;
    return Viewer.insertIntoOuterHTML(stylesheetUri, scriptUri, innerHTML);
  }

  /**
   * Generates HTML content for relevant commit(s) webview.
   *
   * @param stylesheetUri: URI of the CSS stylesheet to include in the webview.
   * @param scriptUri: URI of the JavaScript file to include in the webview.
   * @param commits: An array of commit information objects, each containing a hash, message, and relevant lines.
   * @returns string containing HTML document with each commit visualized.
   */
  static getCommitsHTML(
    stylesheetUri: vscode.Uri,
    scriptUri: vscode.Uri,
    commits: CommitInfo[]
  ) {
    const innerHTML =
      `<h1>Relevant Commits</h1>
      <div class="commit-list">` +

      commits.map((commit, idx) => {
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
            `</div>` +
            `<div class = "comment-section"> 
              <div id = "${commit.hash}-comments">` +
              commit.comments
                ?.map(
                  (comment) => 
                    `<div class="comment">
                        <p><strong>${comment.username}:</strong> ${comment.comment}</p>
                          <button class="button" onclick="deleteComment('${commit.hash}', '${comment.id}')">Delete Comment</button>
                      </div>`).join("") +
                      `</div> 
                    <input type="text"  id="${commit.hash}-comment" placeholder="Add a comment"/>
                    <button type="submit" onclick="addComment('${commit.hash}')">Add Comment</button>
                    </div>` +
            `</div>`
          );
        })
        .join("") +
      `</div>`;
    return Viewer.insertIntoOuterHTML(stylesheetUri, scriptUri, innerHTML);
  }
}

export { Viewer };
