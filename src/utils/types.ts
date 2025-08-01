
interface Line { // line of a file
  relevance: number; 
  hash: string; 
  content: string
  indent: number; // number of leading spaces or tabs
}

interface File {
  fileName:string;
  relevance: number; // TODO: Should prbably change to include recency
  lines: Line[];
  indentations: number[]; // array of distinct indentations in the file
}

type LineRelevance = {
  relevance: number;
  hash: string;
  content: string;
}

enum metrics {
  recency = "recency",
  relevance = "relevance",}

export { File, Line, LineRelevance, metrics };
export interface Comment {
  username: string;
  comment: string;
  timestamp: string;
  id: string; // Unique identifier for the comment
}/**
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
export interface CommitInfo {
  hash: string;
  message: string;
  relevance?: number;
  relevantLines?: string[][];
  comments?: Comment[];
}

