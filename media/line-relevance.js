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
      if (zoomIndex === 0) { // already at min zoom, maybe could shrink later
        return;
      }
      
      lines.forEach((line, idx) => {
        if (line.indent === indentations[zoomIndex]) {
          const lineElement = document.getElementById(`${fileName}-line-${idx}`);
          if (lineElement) {
            lineElement.classList.add("hidden");
          }
        }
      });
      zoomIndex--;
    };   

    const fileContainer = document.createElement('div');
    fileContainer.className = "file-container";
    const hue = (1 - file.relevance) * 240;
    const color = `hsla(${hue}, 100%, 50%, 0.5)`;
    fileContainer.style.backgroundColor = color;
    
    fileContainer.innerHTML = `
      <h3 class = "small-heading" onclick="openFile('${fileName}')">${fileName}</h3> 
      <button class="zoom-in" onclick = "zoomIn()">+</button> <button class="zoom-out">-</button>`;

    const fileContentContainer = document.createElement("div");
    fileContentContainer.className = "file-content-container";
    fileContentContainer.innerHTML = lines.map((line, idx) => {
                  // console.log("Indentation for this line: ", line.indent, ". And indentations for zoom index: ", indentations[zoomIndex]);
                  const hiddenClass = line.indent > indentations[zoomIndex] ? "hidden" : "";
                  // const hiddenClass = "hidden";
                  const hue = (1 - line.relevance) * 240;
                  const color = `hsla(${hue}, 100%, 50%, 0.5)`;
                  return `<div class="${hiddenClass} line-relevance" id = "${fileName}-line-${idx}" style="background-color:${color}">`
                    + `${idx + 1} ${line.content}`
                  + `</div>`;
                }).join("");

    fileContainer.appendChild(fileContentContainer);
    

    const dragContainer = document.createElement('div');
    dragContainer.className = "drag-handle";
    fileContainer.appendChild(dragContainer);
    relevanceContainer.appendChild(fileContainer);
    fileContainer.querySelector('.zoom-in').addEventListener('click', zoomIn);
    fileContainer.querySelector('.zoom-out').addEventListener('click', zoomOut);


    addDragEvents(dragContainer, fileContentContainer, zoomIn, zoomOut);

  });
  element.appendChild(relevanceContainer);


    // add dropup button
    document.getElementById(`${adjustedDirectory}-heading-container`).innerHTML +=
    `<button class="up-button" id="${adjustedDirectory}-up-button" onclick="removeFiles('${adjustedDirectory}')">↑</button>`;
});

function addDragEvents(dragContainer, fileContentContainer, onZoomIn, onZoomOut) {
  let isDragging = false;
  let startY, startHeight, container, lastHeight;

  const hasScrollBar = (element) => {
    return element.scrollHeight > element.clientHeight;
  }

  dragContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    container = dragContainer.parentElement;
    startY = e.clientY;
    startHeight = container.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    lastHeight = startHeight;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    const newHeight = Math.max(100, startHeight + deltaY); // set min height
    container.style.height = newHeight + 'px';

    // zoom out or in if needed
    if (newHeight > lastHeight) {
      if (!hasScrollBar(fileContentContainer)) {
        onZoomIn();
      }
    }
    else if (newHeight < lastHeight) {
      if (hasScrollBar(fileContentContainer)) {
        onZoomOut();
      }
    }
    
    lastHeight = newHeight;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
  });
}

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