import { CommitInfo } from "../utils/types";
import { Comment } from "../utils/types";
import * as vscode from "vscode";
import ViewManager from "./ViewManager";
import DatabaseManager from "../db/DatabaseManager";
import * as relevanceUtils from "../utils/gitServices";
import * as gitCommands from "../commands/gitCommands";
import CommandExecutor from "../commands/CommandExecutor";

class RelevantCommitsView extends ViewManager {
  /**
   * Disposable to be pushed to extension.
   */
  command: vscode.Disposable;
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string,
    identifier: string,
    title: string
  ) {
    super(context, mediaFileName);
    this.handleMessage = this.handleMessage.bind(this);
    this.command = vscode.commands.registerCommand(
      "contextawareversioncontrol." + identifier,
      (hash?) => {
        console.log("Relevant Commits View Command Executed with hash: ", hash);
        const panel = this.createWebviewPanel(identifier, title);
        this.panel = panel;
        panel.webview.onDidReceiveMessage(this.handleMessage);
        const uris = this.getUris(panel);
        relevanceUtils
          .getCommitsAndRelevances(hash)
          .then((commits) => {
            console.log("Relevant Commits in ViewManager: ", commits);
            commits = commits.sort((commit1, commit2) => {
              if (commit1.relevance === undefined) {
                return 1; // commit1 is less relevant
              }
              if (commit2.relevance === undefined) {
                return -1; // commit2 is less relevant
              }
              return commit2.relevance - commit1.relevance;
            });

            panel.webview.html = RelevantCommitsView.getCommitsHTML(
              uris[0],
              uris[1],
              commits
            );
          })
          .catch((error) => {
            console.error("Error fetching relevant commits: ", error);
            vscode.window.showErrorMessage(
              "Error fetching relevant commits: " + error.message
            );
          });
      }
    );
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
            `</div>` +
            `<div class = "comment-section"> 
              <div id = "${commit.hash}-comments">` +
            commit.comments
              ?.map(
                (comment) =>
                  `<div class="comment">
                        <p><strong>${comment.username}:</strong> ${comment.comment}</p>
                          <button class="button" onclick="deleteComment('${commit.hash}', '${comment.id}')">Delete Comment</button>
                      </div>`
              )
              .join("") +
            `</div> 
                    <input type="text"  id="${commit.hash}-comment" placeholder="Add a comment"/>
                    <button type="submit" onclick="addComment('${commit.hash}')">Add Comment</button>
                    </div>` +
            `</div>`
          );
        })
        .join("") +
      `</div>`;
    return RelevantCommitsView.insertIntoOuterHTML(
      stylesheetUri,
      scriptUri,
      innerHTML
    );
  }
  handleMessage(message: any) {
    if (message.command === `addComment`) {
      this.addComment(message.hash, message.comment);
    }
    if (message.command === `deleteComment`) {
      vscode.window.showInformationMessage(
        "Delete comment command Message received in webview with hash: " +
          message.hash +
          " and id: " +
          message.id
      );
      this.deleteComment(message.hash, message.id);
    }
    if (message.command === "openDiffFile") {
      const filesChanged = relevanceUtils
        .getFilesChanged(message)
        .then((filesChanged) => {
          this.openChangedFileDiffs(message.hash, filesChanged);
        });
    }
    if (message.command === "checkoutCommit") {
      const hash: string = message.hash;
      gitCommands.stashChanges().then(() => {
        gitCommands.checkoutCommit(hash);
      });
    }
  }
  /**
   * Opens the vscode diff views for files changed in a specific commit.
   *
   * @param commit - The commit information containing details such as the commit hash.
   * @returns A promise that resolves when all diff views have been opened or if no action is taken.
   */
  async openChangedFileDiffs(
    hash: string,
    filesChanged: string[]
  ): Promise<void> {
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
        ref: hash,
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
        `Diff ${file}: ${hash} -> present`
      );
    }
  }

  async deleteComment(hash: string, id: string) {
    const updatedComments: Comment[] = await DatabaseManager.deleteComment(
      hash,
      id
    );
    this.updateComments(hash, updatedComments);
  }

  async addComment(hash: string, comment: string) {
    const updatedComments: Comment[] = await DatabaseManager.addComment(
      hash,
      comment
    );
    this.updateComments(hash, updatedComments);
  }

  updateComments(hash: string, comments: Comment[]) {
    if (this.panel) {
      this.panel.webview.postMessage({
        command: "updateComments",
        hash: hash,
        comments: comments,
      });
    } else {
      console.error("Panel is undefined, cannot update comments.");
    }
  }
}

export default RelevantCommitsView;
