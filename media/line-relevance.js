// == Global variables and setup ==
const vscode = acquireVsCodeApi();
let currentMetric = "relevance";

window.addEventListener('message', (event) => {
  if (event.data.command === 'openDirectory') {
    const directory = event.data.directory;
    const adjustedDirectory = directory === ""?"root":directory;
    const files = event.data.files;
    console.log("Files: ", files);
    const element = document.getElementById(adjustedDirectory);
    const relevanceContainer = document.createElement('div');
    relevanceContainer.id = `${adjustedDirectory}-relevance-container`;
    relevanceContainer.className = "relevance-container";
    
    element.appendChild(relevanceContainer);
    renderFiles(files, relevanceContainer);
    // add dropup button
    document.getElementById(`${adjustedDirectory}-heading-container`).innerHTML +=
    `<button class="up-button" id="${adjustedDirectory}-up-button" onclick="removeFiles('${adjustedDirectory}')">↑</button>`;
  }
});

function renderFiles(files, relevanceContainer) {
  // add file content to directory
  files.forEach((file, fileIndex) => {
    const zoomIndex = {value: 0}; // use an object to keep track of zoom level
    const { fileContainer, dragContainer, fileContentContainer } = addFileHTMLToDOM(file, zoomIndex, relevanceContainer);
    createZoomEvents(zoomIndex, file, fileContainer, dragContainer, fileContentContainer);
    addDragEvents(fileContainer, fileIndex, files, relevanceContainer);
  });
}

function addFileHTMLToDOM(file, zoomIndex, relevanceContainer) {
  const fileContainer = document.createElement('div');
  fileContainer.className = "file-container";
  const hue = (1 - file.relevance) * 240;
  const color = `hsla(${hue}, 100%, 50%, 0.5)`;
  fileContainer.style.backgroundColor = color;
  fileContainer.setAttribute("draggable", "true");
  fileContainer.innerHTML = `
      <h3 class = "small-heading" onclick="openFile('${file.fileName}')">${file.fileName}</h3> 
      <button class="zoom-in" onclick = "zoomIn()">+</button> <button class="zoom-out">-</button>`;
  const fileContentContainer = document.createElement("div");
  fileContentContainer.className = "file-content-container";
  fileContentContainer.innerHTML = file.lines.map((line, idx) => {
    const hiddenClass = line.indent > file.indentations[zoomIndex.value] ? "hidden" : "";
    // const hiddenClass = "hidden";
    const hue = (1 - line.relevance) * 240;
    const color = `hsla(${hue}, 100%, 50%, 0.5)`;
    return `<div class="${hiddenClass} line-relevance" id = "${file.fileName}-line-${idx}" style="background-color:${color}">`
      + `${idx + 1} ${line.content}`
      + `</div>`;
  }).join("");
  fileContainer.appendChild(fileContentContainer);
  const dragContainer = document.createElement('div');
  dragContainer.className = "drag-handle";
  fileContainer.appendChild(dragContainer);
  relevanceContainer.appendChild(fileContainer);
  return { fileContainer, dragContainer, fileContentContainer };
}

function addDragEvents(fileContainer, fileIndex, files, relevanceContainer) {
  fileContainer.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData("fromIndex", fileIndex);
  });
  fileContainer.addEventListener("drop", (e) => {
    const fromIndex = e.dataTransfer.getData("fromIndex");
    const toIndex = fileIndex;
    const smallerIndex = Math.min(fromIndex, toIndex);
    const largerIndex = Math.max(fromIndex, toIndex);

    const newFiles = files.slice(0, smallerIndex).
      concat([files[largerIndex]]).
      concat(files.slice(smallerIndex + 1, largerIndex)).
      concat([files[smallerIndex]]).
      concat(files.slice(largerIndex + 1));

    relevanceContainer.innerHTML = "";
    renderFiles(newFiles, relevanceContainer);
  });
}

function createZoomEvents(zoomIndex, file, fileContainer, dragContainer, fileContentContainer) {
  const zoomIn = () => {
    if (zoomIndex.value === file.indentations.length - 1) { // already at max zoom, maybe could enlarge later
      return;
    }
    zoomIndex.value++;
    file.lines.forEach((line, idx) => {
      if (line.indent === file.indentations[zoomIndex.value]) {
        const lineElement = document.getElementById(`${file.fileName}-line-${idx}`);
        if (lineElement) {
          lineElement.classList.remove("hidden");
        }
      }
    });
  };

  const zoomOut = () => {
    if (zoomIndex.value === 0) { // already at min zoom, maybe could shrink later
      return;
    }

    file.lines.forEach((line, idx) => {
      if (line.indent === file.indentations[zoomIndex.value]) {
        const lineElement = document.getElementById(`${file.fileName}-line-${idx}`);
        if (lineElement) {
          lineElement.classList.add("hidden");
        }
      }
    });
    zoomIndex.value--;
  };
  fileContainer.querySelector('.zoom-in').addEventListener('click', zoomIn);
  fileContainer.querySelector('.zoom-out').addEventListener('click', zoomOut);
  addZoomEvents(dragContainer, fileContentContainer, zoomIn, zoomOut);
}

function addZoomEvents(dragContainer, fileContentContainer, onZoomIn, onZoomOut) {
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