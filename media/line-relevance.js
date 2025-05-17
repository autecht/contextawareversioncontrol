const vscode = acquireVsCodeApi();


window.addEventListener('message', (event) => {
  console.log("Event", event);
  const directory = event.data.directory;
  const adjustedDirectory = directory === ""?"root":directory;
  const fileRelevances = event.data.fileRelevances;
  const element = document.getElementById(adjustedDirectory);
  console.log("Directory", directory);
  console.log("element", element);

  // add file content to directory
  element.innerHTML += 
    `<div id="${adjustedDirectory}-relevance-container" class="relevance-container">` + 
    Object.keys(fileRelevances).map((fileName) => {
            return `
              <div class="file-container">
              <h3 class = "small-heading" onclick="openFile('${fileName}')">${fileName}</h3>
              <div class="">
                ${fileRelevances[fileName].map((commit, idx) => {
                  const hue = (1 - commit.relevance) * 240;
                  const color = `hsla(${hue}, 100%, 50%, 0.5)`;
                  return `<div class="line-relevance" style="background-color:${color}">`
                    + `${commit.content}`
                  + `</div>`;
                }).join("")}
              </div> </div>`;}).join("") + '</div>';
    
    // add dropup button
    document.getElementById(`${adjustedDirectory}-heading-container`).innerHTML +=
    `<button class="up-button" id="${adjustedDirectory}-up-button" onclick="removeFiles('${adjustedDirectory}')">↑</button>`;
});

function removeFiles(directory) {
  const button = document.getElementById(`${directory}-up-button`);
  if (button) {
    button.remove();
  }
  const directoryFiles = document.getElementById(`${directory}-relevance-container`);
  if (directoryFiles) {
    directoryFiles.remove();
  }
}

function openFile(fileName) {
  vscode.postMessage({
    command: "openFile",
    fileName: fileName
  });
}

function openDirectoryVisualization(dir) {
  if (dir === "root") {
    dir = "";
  }
  vscode.postMessage({
    command: 'openDirectoryVisualization',
    directory: dir
  });
}