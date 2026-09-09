let loadedFiles = [];
import {SignalManager} from './signalManager.js';
import {ChartManager} from './chartManager.js';
const signalManager = new SignalManager();
let chartManager = null;

let csvLoading = false;
let csvHeaders = null;
let csvBuffers = [];
let csvPath = '';
let headerSeen = false;
let resizingSidebar = false;
let draggedDatasetIndex = -1;

function refreshUi() {
  rebuildSignalList();
  chartManager.synchronise();
}

function rebuildSignalList() {
  const signalList = document.getElementById('signalList');

  signalList.innerHTML = '';

  signalManager.visualItems().forEach((item, visualIndex) => {
    const datasetIndex = item.index;
    const ds = item.signal.dataset;
    const row = document.createElement('div');
    row.className = 'signal-entry';
    row.draggable = true;
    row.dataset.index = datasetIndex;

    row.addEventListener('dragstart', () => {
      draggedDatasetIndex = visualIndex;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      setLoadingState(true, 'Reordering Signals...');
      requestAnimationFrame(() => {
        signalManager.moveSignal(draggedDatasetIndex, visualIndex);
        refreshUi();
        setLoadingState(false);
      });
    });

    const handle = document.createElement('div');
    handle.innerText = '☰';
    handle.style.cursor = 'grab';
    handle.style.color = '#94a3b8';

    row.appendChild(handle);

    const colour = document.createElement('div');
    colour.className = 'signal-colour';
    colour.style.background = ds.borderColor;

    const name = document.createElement('div');
    name.className = 'signal-name';
    name.innerText = ds.label;

    const axis = document.createElement('div');
    axis.className = 'axis-toggle';

    axis.innerText = ds.yAxisID === 'y1' ? 'R' : 'L';

    updateAxisButtonColour(axis, ds);

    axis.onclick = () => {
      ds.yAxisID = ds.yAxisID === 'y' ? 'y1' : 'y';
      refreshUi();
    };

    const removeBtn = document.createElement('div');
    removeBtn.className = 'file-remove';
    removeBtn.innerText = '✕';

    removeBtn.onclick = () => {
      signalManager.removeSignal(datasetIndex);
      refreshUi();
    };

    colour.onclick = () => {
      const visible = chartManager.isDatasetVisible(datasetIndex);
      chartManager.setDatasetVisibility(datasetIndex, !visible);
      colour.style.opacity = visible ? '0.25' : '1';
    };

    row.appendChild(colour);
    row.appendChild(name);
    row.appendChild(axis);
    row.appendChild(removeBtn);

    signalList.appendChild(row);
  });
}

function updateAxisButtonColour(button, dataset) {
  if (dataset.yAxisID === 'y1') {
    button.style.color = '#f59e0b';
    button.style.background = 'rgba(245,158,11,0.15)';

  } else {
    button.style.color = '#60a5fa';
    button.style.background = 'rgba(59,130,246,0.15)';
  }
}

function finishCsvLoad() {
  const buffers = csvBuffers;

  const file = {
    path: csvPath,
    headers: csvHeaders,
    buffers,
  };
  setLoadingState(false, 'Loading... 0%');
  addLoadedFile(file);
}

function processCsvChunk(lines) {
  for (const line of lines) {
    const parts = line.split(',');

    // Process header line differently
    if (!headerSeen) {
      csvHeaders = parts.map(h => h.replace(/^#+/, '').trim());
      csvBuffers = csvHeaders.map(() => []);
      headerSeen = true;
      continue;
    }

    // Skip row if ANY field is empty OR NaN
    let isInvalid = parts.some(v => {
      const value = v.trim();
      return value === '' || Number.isNaN(Number(value));
    });

    if (isInvalid) {
      continue;
    }

    // Start storing data
    parts.forEach((value, index) => {
      const num = Number(value);
      csvBuffers[index].push(Number.isNaN(num) ? null : num);
    });
  }
}

async function csvLoadLoop() {
  if (!csvLoading) {
    return;
  }

  const chunk = await window.api.GetCsvChunk();

  setLoadingState(true, `Loading... ${chunk.progress.toFixed(0)}%`);

  processCsvChunk(chunk.rows);

  if (!chunk.done) {
    requestAnimationFrame(csvLoadLoop);
  } else {
    csvLoading = false;
    finishCsvLoad();
  }
}

function beginCsvLoad(path) {
  csvPath = path;
  csvHeaders = null;
  csvBuffers = [];
  headerSeen = false;

  csvLoading = true;

  setLoadingState(true, 'Loading...0%');

  requestAnimationFrame(csvLoadLoop);
}

// Sets loading state
function setLoadingState(loading, text = '') {
  const overlay = document.getElementById('loadingOverlay');
  const msg = document.getElementById('loadingMessage');

  if (loading) {
    overlay.classList.remove('hidden');
    msg.innerText = text;

  } else {
    overlay.classList.add('hidden');
  }

  document.querySelectorAll('button,input').forEach(el => {
    el.disabled = loading;
  });
}

// Helper function to generate a new colour
function getColour(index) {
  const goldenRatio = 137.508;  // spreads colours nicely
  const hue = (index * goldenRatio) % 360;

  return `hsl(${hue}, 70%, 55%)`;
}

// Helper to track file indices, when using multiple files we link data with
// repeat names to a file index in the list in square brackets.
function updateFileIndices() {
  loadedFiles.forEach((fileRecord, fileIdx) => {
    const newIndex = fileIdx + 1;
    fileRecord.index = newIndex;

    // Update sidebar label
    const fileName = fileRecord.path.split(/[\\/]/).pop();
    fileRecord.element.querySelector('.file-path').innerText =
        `[${newIndex}] ${fileName}`;

    // Update dataset labels
    for (let i = 0; i < fileRecord.count; i++) {
      const datasetIndex = fileRecord.startIndex + i;
      const header = signalManager.datasets[datasetIndex].rawHeader;
      signalManager.datasets[datasetIndex].label = `[${newIndex}] ${header}`;
    }
  });
}

// Helper function to add data to plot from file
function addLoadedFile(file) {
  const fileList = document.getElementById('fileList');

  const entry = document.createElement('div');
  entry.className = 'file-entry';

  const pathEl = document.createElement('div');
  pathEl.className = 'file-path';
  pathEl.title = file.path;

  const removeBtn = document.createElement('div');
  removeBtn.className = 'file-remove';
  removeBtn.innerText = '✕';

  entry.appendChild(pathEl);
  entry.appendChild(removeBtn);
  fileList.appendChild(entry);

  const headers = file.headers;
  const buffers = file.buffers;

  const datasetStartIndex = signalManager.count;

  buffers.forEach((buffer, i) => {
    const numericBuffer = buffer.map(v => {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    });

    signalManager.addSignal(
        headers[i], numericBuffer, getColour(signalManager.count));
  });

  const fileRecord = {
    path: file.path,
    startIndex: datasetStartIndex,
    count: buffers.length,
    element: entry,
    index: 0
  };

  loadedFiles.push(fileRecord);
  removeBtn.onclick = () => removeFile(fileRecord);

  updateFileIndices();
  refreshUi();
}

// Helper function to remove a file
function removeFile(fileRecord) {
  // Remove file signals
  signalManager.removeRange(fileRecord.startIndex, fileRecord.count);

  // Remove DOM element
  fileRecord.element.remove();

  // Remove from list
  loadedFiles = loadedFiles.filter(f => f !== fileRecord);

  // Rebuild dataset indices
  let currentIndex = 0;
  loadedFiles.forEach(f => {
    f.startIndex = currentIndex;
    currentIndex += f.count;
  });

  updateFileIndices();
  refreshUi();
}

function applyRegexRename(pattern) {
  let regex;

  try {
    regex = new RegExp(pattern);
  } catch (err) {
    alert(`Invalid regex: ${err.message}`);
    return;
  }

  signalManager.datasets.forEach(ds => {
    const match = ds.rawHeader.match(regex);

    if (match?.[1]) {
      ds.label = match[1];
    }
  });

  refreshUi();
}

window.addEventListener('DOMContentLoaded', async () => {
  chartManager =
      new ChartManager(document.getElementById('chart'), signalManager);
  const sidebar = document.getElementById('sidebar');
  const resizeHandle = document.getElementById('sidebarResizeHandle');

  resizeHandle.addEventListener('mousedown', e => {
    resizingSidebar = true;
    document.body.classList.add('resizing');
  });

  window.addEventListener('mousemove', e => {
    if (!resizingSidebar) {
      return;
    }
    if ((e.buttons & 1) === 0) {
      resizingSidebar = false;
      document.body.classList.remove('resizing');
      return;
    }
    const left = sidebar.parentElement.getBoundingClientRect().left;
    const width = Math.max(150, Math.min(800, e.clientX - left));

    sidebar.style.width = `${width}px`;
  });

  window.addEventListener('mouseup', () => {
    resizingSidebar = false;
    document.body.classList.remove('resizing');
  });

  // Add events listeners to UI
  document.getElementById('AddFile').onclick = async () => {
    if (csvLoading) {
      return;
    }
    const file = await window.api.OpenCsvFiles();
    if (!file) {
      return;
    }
    beginCsvLoad(file.path);
  };

  chartManager.getCanvas().addEventListener('dblclick', () => {
    setLoadingState(true, 'Resetting View...');
    setTimeout(() => {
      chartManager.resetView();
      setLoadingState(false);
    }, 0);
  });

  document.getElementById('applyRegex').onclick = () => {
    const pattern = document.getElementById('nameRegex').value;
    applyRegexRename(pattern);
  };

  document.getElementById('resetNames').onclick = () => {
    updateFileIndices();
    rebuildSignalList();
  };
});

window.onload = () => {
  // Nothing to do here
};