// == Global variables and setup ==
const vscode = acquireVsCodeApi();
let currentMetric = "relevance";
window.addEventListener('message', (event) => {
  if (event.data.command === 'openDirectory') {
    openFilesInDirectory(event);
  }
});


// == Rendering functions ==
/**
 * Renders files in the relevance container, adds zoom and drag events to each file.
 *
 * @param File[] files: array of files to render
 * @param HTMLDivElement relevanceContainer: container from directory to render files in
 */
function renderFiles(files, relevanceContainer) {
  // add file content to directory
  files.forEach((file, fileIndex) => {
    const zoomIndex = { value: 0 }; // use an object to keep track of zoom level
    const { fileContainer, dragContainer, fileContentContainer } = addFileHTMLToDOM(file, zoomIndex, relevanceContainer);
    addZoomEvents(zoomIndex, file, fileContainer, dragContainer, fileContentContainer);
    addDragEvents(fileContainer, fileIndex, files, relevanceContainer);
  });
}
/**
 * Adds all HTML elements and attributes to the DOM for a file, excluding drag and zoom events.
 *
 * @param File file: file to add to the dom
 * @param {value: number} zoomIndex: current zoom level, used to determine which lines to show
 * @param HTMLDivElement relevanceContainer: container to add the file to.
 * @returns {fileContainer: HTMLDivElement, dragContainer: HTMLDivElement, fileContentContainer: HTMLDivElement}, 
 *    where fileContainer is the container for the file, 
 *    dragContainer contains the drag handle,
 *    and fileContentContainer is the container for the lines of the file.
 */
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
/**
 * Opens files in a directory and renders them in the webview. Adds event listeners for zooming and dragging.
 *
 * @param {command: string, directory: string, fileRelevances: number[], files: File[]} event: event containing the directory and files to open
 */
function openFilesInDirectory(event) {
  const directory = event.data.directory;
  const adjustedDirectory = directory === "" ? "root" : directory;
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

/**
 * Close directory and remove its files from the webview.
 *
 * @param string directory: directory to close
 */
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

// == Command functions to talk to the extension ==
/**
 * Messages extension to open files in a directory.
 *
 * @param string dir: relative path of directory to open, if "root" is given, the root directory is opened
 */
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


/**
 * Messages extension to open a file in the editor.
 *
 * @param string fileName: reletive path of the file to open
 */
function openFile(fileName) {
  vscode.postMessage({
    command: "openFile",
    fileName: fileName
  });
}


// == Event handlers ==
/**
 * Adds drag and drop events to a file container, allowing files to be reordered.
 *
 * @param HTMLDivElement fileContainer: container for the file to add drag events to
 * @param number fileIndex: index of the file in the files array, used to determine the fromIndex for drag and drop 
 * @param File[] files: array of files to reorder
 * @param HTMLDivElement relevanceContainer: container to update with the new order of files
 */
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
/**
 * Adds zoom in and zoom out events to a file, allowing users to zoom in and out on the lines of the file.
 *
 * @param {value: number} zoomIndex 
 * @param File file: information about the file zoom events are added to
 * @param HTMLDivElement fileContainer: container for the file to add zoom events to
 * @param HTMLDivElement dragContainer: container for the drag handle of the file
 * @param HTMLDivElement fileContentContainer: container for the lines of the file
 */
function addZoomEvents(zoomIndex, file, fileContainer, dragContainer, fileContentContainer) {
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
  addZoomEventsOnDrag(dragContainer, fileContentContainer, zoomIn, zoomOut);
}
/**
 * Adds zoom events to a drag container, allowing users to zoom in and out by dragging the container.
 *
 * @param HTMLDivElement dragContainer: container for the drag handle of the file
 * @param HTMLDivElement fileContentContainer: container for the lines of the file
 * @param function onZoomIn: function to call when zooming in
 * @param function onZoomOut: function to call when zooming out
 */
function addZoomEventsOnDrag(dragContainer, fileContentContainer, onZoomIn, onZoomOut) {
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

// == Helper functions ==
/**
  * Changes the current metric to the given metric.
  *
  * @param string metric: metric to change to, can be "relevance", or "recency"
  */
function chooseMetric(metric) {
  currentMetric = metric;
}
