interface Line {
  relevance: number; 
  hash: string; 
  content: string
  lines?: Line[];
}

interface File {
  fileName:string;
  relevance: number; // TODO: Should prbably change to include recency
  lines: Line[];

  // should logic to separate indentation be here or on frontend?

}


export { File, Line };