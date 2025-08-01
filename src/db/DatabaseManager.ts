import { Client, QueryResult } from "pg";
import { Comment } from "../types";
import CommandExecutor from "../CommandExecutor";





class DatabaseManager{
  private client: Client;
  private static instance: DatabaseManager | null = null;

  private constructor() {
    this.client = new Client({
      user: "postgres",
      host: "localhost",
      database: "context_aware_version_control",
      password: "password",
      port: 5432,
    });
    DatabaseManager.instance = this;
  }


  public static openConnection(): void {  
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
      DatabaseManager.instance.client.connect().catch((err) => {
        console.error("Failed to connect to the database:", err);
      });
    }
    else {
      console.warn("Database connection already exists, not creating a new one.");
    }
    
  }

  public static closeConnection(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.client.end().catch((err) => {
        console.error("Failed to close the database connection:", err);
      });
      DatabaseManager.instance = null;
    }
  }

  public static async query(query: string, parameters: any[]): Promise<QueryResult<any>> {
    if (!DatabaseManager.instance) {
      throw new Error("Database connection is not established.");
    }
    return await DatabaseManager.instance.client.query(query, parameters);
  }

  public static async deleteComment(hash: string, commentId: string): Promise<Comment[]> {
    const query = "DELETE FROM comments WHERE id = $1";
    const parameters = [commentId];
    await DatabaseManager.query(query, parameters);
    return await DatabaseManager.getCommentsFromCommit(hash);
  }

  public static async addComment(hash: string, commentId: string): Promise<Comment[]> {
    const repoUrl = await CommandExecutor.executeCommand("git remote get-url origin");
    const username = (await CommandExecutor.executeCommand("git config user.name")).trim();
    
    const insert = `
      INSERT INTO comments (username, comment, repo_url, commit_id)
      VALUES ($1, $2, $3, $4)
    `;
    const parameters = [username, commentId, repoUrl, hash];
    await DatabaseManager.query(insert, parameters);
    return await DatabaseManager.getCommentsFromCommit(hash);
  }

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


}


export default DatabaseManager;