import { Client, Connection, QueryResult } from "pg";
import { Comment } from "../utils/types";
import CommandExecutor from "../commands/CommandExecutor";
import * as vscode from 'vscode';
import { resolve } from "path";



/**
 * Singleton class to connect and query to database. Must be called after extension is activated.
 */
class DatabaseManager{
  private client: Client; // postgres client
  private static instance: DatabaseManager | null = null;

  private constructor(context: vscode.ExtensionContext) {
    const path = resolve(context.extensionPath, ".env.sample");
    require("dotenv").config({
      path: path
    });
    console.log(".env values: ", {
      user: process.env.USER,
      host: process.env.HOST,
      database: process.env.DATABASE,
      port: process.env.PORT
    });
    this.client = new Client({
      user: process.env.USER,
      host: process.env.HOST,
      database: process.env.DATABASE,
      port: parseInt(process.env.PORT?process.env.PORT:""),
    });
    DatabaseManager.instance = this;
  }



  /**
   * Create new instance and connect to database.
   */
  public static openConnection(context: vscode.ExtensionContext): void {  
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(context);
      DatabaseManager.instance.client.connect().catch((err) => {
        console.error("Failed to connect to the database:", err);
      });
    }
    else {
      console.warn("Database connection already exists, not creating a new one.");
    }
    
  }

  /**
   * Close connection to database and remove instance.
   */
  public static closeConnection(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.client.end().catch((err) => {
        console.error("Failed to close the database connection:", err);
      });
      DatabaseManager.instance = null;
    }
  }

  /**
   * Perform query or update on database and return result
   *
   * @param query parameterized query string
   * @param parameters parameters to query string
   * @returns QueryResult which is result of query on database
   */
  public static async query(query: string, parameters: any[]): Promise<QueryResult<any>> {
    if (!DatabaseManager.instance) {
      throw new Error("Database connection is not established.");
    }
    return await DatabaseManager.instance.client.query(query, parameters);
  }

  /**
   * Delete a comment from the database.
   *
   * @param hash hash of commit comment was deleted from
   * @param commentId id of comment to be deleted in database
   * @returns updated comments of commit from database
   */
  public static async deleteComment(hash: string, commentId: string): Promise<Comment[]> {
    const query = "DELETE FROM comments WHERE id = $1";
    const parameters = [commentId];
    await DatabaseManager.query(query, parameters);
    return await DatabaseManager.getCommentsFromCommit(hash);
  }

  /**
   * Add a comment to the database.
   *
   * @param hash hash of commit comment will be added to
   * @param comment text of comment to be added to
   * @returns updated comments of comment from database
   */
  public static async addComment(hash: string, comment: string): Promise<Comment[]> {
    const repoUrl = await CommandExecutor.executeCommand("git remote get-url origin");
    const username = (await CommandExecutor.executeCommand("git config user.name")).trim();
    
    const insert = `
      INSERT INTO comments (username, comment, repo_url, commit_id)
      VALUES ($1, $2, $3, $4)
    `;
    const parameters = [username, comment, repoUrl, hash];
    await DatabaseManager.query(insert, parameters);
    return await DatabaseManager.getCommentsFromCommit(hash);
  }

  /**
   * Get comments posted under a commit
   *
   * @param commitHash hash of commit with comments
   * @returns Promise with comments associeted with commitHash
   */
  public static async getCommentsFromCommit(commitHash: string): Promise<Comment[]> {
    // Need hash and repository
    const repoUrl = await CommandExecutor.executeCommand("git remote get-url origin");
    const query = `
      SELECT username, comment, timestamp, id
      FROM comments
      WHERE commit_id = $1 AND repo_url = $2
      ORDER BY timestamp ASC
    `;
    const parameters = [commitHash, repoUrl];
    const result = await DatabaseManager.query(query, parameters);
    if (result.rows.length > 0) {
      return result.rows.map((row) => ({
        username: row.username,
        comment: row.comment,
        timestamp: row.timestamp.toISOString(), // Convert to ISO string for consistency
        id: row.id,
      }));
    }
    return [];
  }


  public getDatabase() {
    return this.client.database;
  }
  public static getDatabase() {
    return DatabaseManager.instance?.getDatabase();
  }

}


export default DatabaseManager;