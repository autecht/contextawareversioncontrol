import * as vscode from "vscode";
import { exec } from "child_process";
import * as util from "util";

/**
 * Singleton class to allow extension to easily execute commands in user terminal.
 */
class CommandExecutor {
  
  private static instance: CommandExecutor; // single instance of CommandExecutor
  private static context: vscode.ExtensionContext; // context of extension
  static workspaceRoot: vscode.WorkspaceFolder | undefined; // folder opened by user

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
   *
   * @param string command: command to be executed in terminal
   * @returns Promise with stdout of command
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

  public static getContext(): vscode.ExtensionContext {
    if (!CommandExecutor.context) {
      throw new Error("CommandExecutor context is not initialized.");
    }
    return CommandExecutor.context;
  }

  static getWorkspaceRoot() {
    if (!CommandExecutor.workspaceRoot) {
      throw new Error("Workspace root is not set.");
    }
    return CommandExecutor.workspaceRoot;
  }
}

export default CommandExecutor;
