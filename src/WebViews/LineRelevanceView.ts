
import * as vscode from "vscode";
import * as path from "path";
import { metrics } from "../utils/types";
import ViewManager from "./ViewManager";
import { getLineRelevance, getTrackedDirectories } from "../utils/gitServices";
import { createFiles } from "../utils/parsers";

class LineRelevaceView extends ViewManager {
  
  command: vscode.Disposable; // command to register this view
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
      () => {
        const panel = this.createWebviewPanel(identifier, title);
        this.panel = panel;
        panel.webview.onDidReceiveMessage(this.handleMessage);
        const uris = this.getUris(panel);

        getTrackedDirectories().then((directories) => {
          panel.webview.html = LineRelevaceView.getDirectoryListingHTML(
            uris[0],
            uris[1],
            directories
          );
        });
      }
    );
  }
  /**
   * Generates HTML content for initial line relevance visualization webview.
   *
   * @param stylesheetUri: URI of the CSS stylesheet to include in the webview.
   * @param scriptUri: URI of the JavaScript file to include in the webview.
   * @param directories: An array of tracked directories which will be displayed
   * @returns string containing HTML document with clickable directories listed.
   */
  private static getDirectoryListingHTML(
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
    return LineRelevaceView.insertIntoOuterHTML(stylesheetUri, scriptUri, innerHTML);
  }

  /**
   * Handles incoming messages and processes commands accordingly.
   *
   * @param message - The message object containing the command and additional data.
   *
   * Commands:
   * - `"openDirectoryVisualization"`: Processes the directory visualization request.
   *   - Retrieves file relevance data for the specified directory and sends it to the webview.
   *
   * @remarks
   * - If the `directory` in the message is `"."`, it is treated as the root directory.
   */
  handleMessage(message: any) {
    if (message.command === "openDirectoryVisualization") {
      vscode.window.showInformationMessage(
        "Open directory visualization command Message received in webview"
      );
      if (this.panel === undefined) {
        console.error("Visualization panel is undefined");
        return;
      }
      const adjustedDirectory = message.directory;
      getLineRelevance(adjustedDirectory, message.metric)
        .then((fileRelevances) => {
          console.log("File Relevances: ", fileRelevances);

          const files = createFiles(fileRelevances);

          if (this.panel === undefined) {
            console.error("Visualization panel is undefined");
            return;
          }
          this.panel.webview.postMessage({
            directory: message.directory,
            fileRelevances: fileRelevances,
            files: files,
          });
        });
    }
    if (message.command === "openFile") {
      const relativePath = message.fileName;
      const workspace = vscode.workspace.workspaceFolders;
      if (workspace === undefined) {
        vscode.window.showErrorMessage("No workspace open");
        return;
      }
      const projectRoot = workspace[0].uri.fsPath;
      const absolutePath = path.join(projectRoot, relativePath);
      const fileUri = vscode.Uri.file(absolutePath);
      try {
        vscode.workspace.openTextDocument(fileUri).then((document) => {
          vscode.window.showTextDocument(document, { preview: false });
        });
      } catch {}
    }
  }
}

export default LineRelevaceView;
