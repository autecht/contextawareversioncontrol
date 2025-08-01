import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";

class CommandExecutor {
  private static instance: CommandExecutor;
  static context: vscode.ExtensionContext;
  static workspaceRoot: vscode.WorkspaceFolder | undefined;

  constructor(context: vscode.ExtensionContext) {
    CommandExecutor.context = context;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }
    CommandExecutor.workspaceRoot = workspaceFolders[0];
  }

  /**
   * Execute command in workspace directory.
   */
  public static async executeCommand(
    command: string
  ): Promise<string> {
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

  public static getInstance(context: vscode.ExtensionContext): CommandExecutor {
    if (!CommandExecutor.instance) {
      CommandExecutor.instance = new CommandExecutor(context);
    }
    return CommandExecutor.instance;
  }
}

export default CommandExecutor;
