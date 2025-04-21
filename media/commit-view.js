const vscode = acquireVsCodeApi();




function openDiffFile(hash) {
  console.log(hash);
  vscode.postMessage({
    command: 'openDiffFile',
    hash: hash
  });
}