import * as vscode from "vscode";


/**
 * Manages a webview. Helps create initial HTML and handles messages from webview.
 */
class ViewManager {
  context: vscode.ExtensionContext; // this extension's ExtensionContext
  mediaFileName: string; // name of script and stylesheet without extension in media folder
  panel: vscode.WebviewPanel | undefined; // webview panel for this command
  constructor(
    context: vscode.ExtensionContext,
    mediaFileName: string
  ) {
    this.context = context;
    this.mediaFileName = mediaFileName;
  }
  
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
   *
   * @param panel panel created for this command's webview
   * @returns uris of stylesheet and javascript file for webview of this command.
   */
  getUris(panel: vscode.WebviewPanel): vscode.Uri[] {
    const stylesheetPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      this.mediaFileName + ".css"
    );
    const stylesheetUri = panel.webview.asWebviewUri(stylesheetPath);

    const scriptPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      this.mediaFileName + ".js"
    );
    const scriptUri = panel.webview.asWebviewUri(scriptPath);
    return [stylesheetUri, scriptUri];
  }

  /**
   * Create initial webview for command.
   *
   * @param identifier: unique identifier to access command.
   * @param title: visible title of command and webview.
   * @returns panel of blank webview.
   */
  createWebviewPanel(identifier: string, title: string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      identifier,
      title,
      {viewColumn: vscode.ViewColumn.Beside, preserveFocus: true},
      {
        
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "media"),
        ],
        retainContextWhenHidden: true,
      }
    );
    return panel;
  }

  /**
   * Handles incoming messages and executes corresponding commands.
   *
   * @param message - The message object containing the command and any associated data.
   *
   * Supported commands:
   * - no supported commands
   */
  handleMessage(message: any) {
  }

}


export default ViewManager;