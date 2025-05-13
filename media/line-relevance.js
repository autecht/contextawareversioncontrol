const vscode = acquireVsCodeApi();


window.addEventListener('message', (event) => {
  console.log("Event", event);
  const directory = event.data.directory;
  const fileRelevances = event.data.fileRelevances;
  const element = document.getElementById(directory);
  console.log("Directory", directory);
  console.log("element", element);
  document.getElementById(directory).innerHTML += 
    '<div class="relevance-container">' + 
    Object.keys(fileRelevances).map((fileName) => {
            return `
              <div class="file-container">
              <h3 class = "small-heading" onclick="openFile('${fileName}')">${fileName}</h3>
              <div class="">
                ${fileRelevances[fileName].map((commit, idx) => {
                  const background = 255 - Math.round(commit.relevance * 255);
                  const color = `rgb(${background}, ${background}, ${background})`;
                  return `<div class="line-relevance" style="background-color:${color}">`
                    + `${commit.content}`
                  + `</div>`;
                }).join("")}
              </div> </div>`;}).join("") + '</div>';
});

function openFile(fileName) {
  vscode.postMessage({
    command: "openFile",
    fileName: fileName
  });
}

function openDirectoryVisualization(dir) {
  vscode.postMessage({
    command: 'openDirectoryVisualization',
    directory: dir
  });
}