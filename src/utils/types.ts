
/**
 * Single line in a file
 */
interface Line {
  relevance: number; // relevance of line as evaluated by getRelevancy()
  hash: string; // hash of commit responsible for line
  content: string // text in line
  indent: number; // number of leading spaces or tabs
}

/**
 * Representation of single file
 */
interface File {
  fileName:string; // path to file
  relevance: number; // average relevance of each line in file
  lines: Line[]; // relevance, commit responsible, text, and level of indentation of each line in file
  indentations: number[]; // array of distinct indentations in the file
}

/**
 * Relevance of a line in a file
 */
type LineRelevance = {
  relevance: number; // relevance of line as evaluated by getRelevancy()
  hash: string; // commit responsible for commit
  content: string; // text in line
}

/**
 * metrics available to evaluate relevance
 */
enum metrics {
  recency = "recency",
  relevance = "relevance",
}

/**
 * Comment posted to database
 *
 * @interface Comment
 * 
 * @property {string} username git username of user who posted comment
 * @property {string} comment text of comment posted
 * @property {string} timestamp ISO string representing time comment was posted
 * @property {string} id unique id of comment in database 
*/
interface Comment {
  username: string;
  comment: string;
  timestamp: string;
  id: string; // Unique identifier for the comment
}

/**
 * Represents information about a Git commit.
 *
 * @interface CommitInfo
 *
 * @property {string} hash
 * The unique hash identifier of the commit.
 *
 * @property {string} message
 * The commit message describing the changes made in the commit.
 *
 * @property {number} [relevance]
 * An optional value indicating the relevance of the commit, such that 0 is not relevant and 1 is highly relevant.
 *
 * @property {string[][]} [relevantLines]
 * An optional array of string arrays, where each inner array represents
 * 10 lines of content most relevant to the commit.
 */
interface CommitInfo {
  hash: string;
  message: string;
  relevance?: number;
  relevantLines?: string[][];
  comments?: Comment[];
}

export { File, Line, LineRelevance, metrics, Comment, CommitInfo };

