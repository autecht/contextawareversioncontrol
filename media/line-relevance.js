const vscode = acquireVsCodeApi();
let currentMetric = "relevance";

window.addEventListener('message', (event) => {
  const directory = event.data.directory;
  const adjustedDirectory = directory === ""?"root":directory;
  const fileRelevances = event.data.fileRelevances;

  const files = event.data.files;
  console.log("Files: ", files);
  const element = document.getElementById(adjustedDirectory);

  const relevanceContainer = document.createElement('div');
  relevanceContainer.id = `${adjustedDirectory}-relevance-container`;
  relevanceContainer.className = "relevance-container";


  // add file content to directory
  files.forEach((file) => {
    const fileName = file.fileName;
    const relevance = file.relevance;
    const lines = file.lines;
    const indentations = file.indentations;
    let zoomIndex = 0;

    const zoomIn = () => {
      if (zoomIndex === indentations.length - 1) { // already at max zoom, maybe could enlarge later
        return;
      }
      zoomIndex++;
      lines.forEach((line, idx) => {
        if (line.indent === indentations[zoomIndex]) {
          const lineElement = document.getElementById(`${fileName}-line-${idx}`);
          if (lineElement) {
            lineElement.classList.remove("hidden");
          }
        }
      });
    };    

    const zoomOut = () => {
      if (zoomIndex === 0) { // already at max zoom, maybe could enlarge later
        return;
      }
      zoomIndex--;
      lines.forEach((line, idx) => {
        if (line.indent === indentations[zoomIndex]) {
          const lineElement = document.getElementById(`${fileName}-line-${idx}`);
          if (lineElement) {
            lineElement.classList.add("hidden");
          }
        }
      });
    };   

    const fileContainer = document.createElement('div');
    fileContainer.className = "file-container";
    
    fileContainer.innerHTML = `
      <h3 class = "small-heading" onclick="openFile('${fileName}')">${fileName}</h3> 
      <button class="zoom-in" onclick = "zoomIn()">+</button> <button class="zoom-out">-</button>
              <div class="">
                ${lines.map((line, idx) => {
                  // console.log("Indentation for this line: ", line.indent, ". And indentations for zoom index: ", indentations[zoomIndex]);
                  const hiddenClass = line.indent > indentations[zoomIndex] ? "hidden" : "";
                  // const hiddenClass = "hidden";
                  const hue = (1 - line.relevance) * 240;
                  const color = `hsla(${hue}, 100%, 50%, 0.5)`;
                  return `<div class="${hiddenClass} line-relevance" id = "${fileName}-line-${idx}" style="background-color:${color}">`
                    + `${line.content}`
                  + `</div>`;
                }).join("")} </div>`;


    relevanceContainer.appendChild(fileContainer);
    fileContainer.querySelector('.zoom-in').addEventListener('click', zoomIn);
    fileContainer.querySelector('.zoom-out').addEventListener('click', zoomOut);
  });
  element.appendChild(relevanceContainer);


  // element.innerHTML += 
  //   `<div id="${adjustedDirectory}-relevance-container" class="relevance-container">` + 
  //   files.map((file) => {
  //     const fileName = file.fileName;
  //     const relevance = file.relevance;
  //     const lines = file.lines;
  //     const indentations = file.indentations;
  //     let zoomIndex = 0;

  //           return `
  //             <div class="file-container">
  //             <h3 class = "small-heading" onclick="openFile('${fileName}')">${fileName}</h3> <button class="zoom-in" onclick = "zoomIn()">+</button> <button class="zoom-out" onclick = "zoomOut()">+</button>
  //             <div class="">
  //               ${lines.map((line, idx) => {
  //                 // console.log("Indentation for this line: ", line.indent, ". And indentations for zoom index: ", indentations[zoomIndex]);
  //                 const hiddenClass = line.indent > indentations[zoomIndex] ? "hidden" : "";
  //                 // const hiddenClass = "hidden";
  //                 const hue = (1 - line.relevance) * 240;
  //                 const color = `hsla(${hue}, 100%, 50%, 0.5)`;
  //                 return `<div class="${hiddenClass} line-relevance" style="background-color:${color}">`
  //                   + `${line.content}`
  //                 + `</div>`;
  //               }).join("")}
  //             </div> </div>`;}).join("") + '</div>';
    
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
    directory: dir,
    metric: currentMetric
  });
}

function chooseMetric(metric) {
  currentMetric = metric;
}