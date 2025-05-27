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


export { File, Line, LineRelevance };