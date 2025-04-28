const vscode = acquireVsCodeApi();




function openDiffFile(hash) {
  vscode.postMessage({
    command: 'openDiffFile',
    hash: hash
  });
}

function checkoutCommit(hash) {
  console.log(hash);
  vscode.postMessage({
    command: 'checkoutCommit',
    hash: hash
  });
}