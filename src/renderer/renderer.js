import {ChartManager} from './util/chartManager.js';
import {CsvLoader} from './util/csvLoader.js';
import {FileManager} from './util/fileManager.js';
import {SignalManager} from './util/signalManager.js';

const signalManager = new SignalManager();
const fileManager = new FileManager(signalManager);
const csvLoader = new CsvLoader(window.api);
let chartManager = null;
let resizingSidebar = false;

function refreshUi() {
  chartManager.synchronise();
}

function refreshFileLabels() {
  fileManager.updateLabels();
  fileManager.files.forEach(file => {
    const fileName = file.path.split(/[\\/]/).pop();
    file.element.querySelector('.file-path').innerText =
        `[${file.index}] ${fileName}`;
  });
}

function rebuildSignalList() {
  const signalList = document.getElementById('signalList');

  signalList.innerHTML = '';

  signalManager.visualItems().forEach((item, visualIndex) => {
    const datasetIndex = item.index;
    const ds = item.signal.dataset;
    const row = document.createElement('div');
    row.className = 'signal-entry';
    row.dataset.index = datasetIndex;

    const handle = document.createElement('div');
    handle.className = 'signal-handle';
    handle.innerText = '☰';

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
      rebuildSignalList();
      refreshUi();
    };

    const removeBtn = document.createElement('div');
    removeBtn.className = 'file-remove';
    removeBtn.innerText = '✕';
    removeBtn.onclick = () => {
      const fileRecord = fileManager.removeSignal(datasetIndex);

      if (fileRecord && fileRecord.count === 0) {
        fileRecord.element.remove();
      }

      refreshFileLabels();
      rebuildSignalList();
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

  buffers.forEach((buffer, i) => {
    const numericBuffer = buffer.map(v => {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    });

    signalManager.addSignal(
        headers[i], numericBuffer, getColour(signalManager.count));
  });

  const fileRecord = fileManager.addFile(file.path, buffers.length);
  fileRecord.element = entry;

  removeBtn.onclick = () => removeFile(fileRecord);

  refreshFileLabels();
  rebuildSignalList();
  refreshUi();
}

// Helper function to remove a file
function removeFile(fileRecord) {
  fileManager.removeFile(fileRecord);
  fileRecord.element.remove();

  refreshFileLabels();
  rebuildSignalList();
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

  rebuildSignalList();
  refreshUi();
}

window.addEventListener('DOMContentLoaded', async () => {
  chartManager =
      new ChartManager(document.getElementById('chart'), signalManager);
  const sidebar = document.getElementById('sidebar');
  const resizeHandle = document.getElementById('sidebarResizeHandle');

  // Sortable list
  const signalList = document.getElementById('signalList');
  Sortable.create(signalList, {
    animation: 150,
    handle: '.signal-handle',
    ghostClass: 'signal-drag-ghost',
    chosenClass: 'signal-drag-chosen',
    dragClass: 'signal-dragging',

    onEnd: evt => {
      if (evt.oldIndex === evt.newIndex) {
        return;
      }
      signalManager.moveSignal(evt.oldIndex, evt.newIndex);
      refreshUi();
    }
  });

  // resizeable sidebar
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
    if (csvLoader.loading) {
      return;
    }

    const file = await window.api.OpenCsvFiles();

    if (!file) {
      return;
    }

    csvLoader.begin(file.path);
    setLoadingState(true, 'Loading... 0%');

    const loadedFile = await csvLoader.load(progress => {
      setLoadingState(true, `Loading... ${progress.toFixed(0)}%`);
    });

    setLoadingState(false);
    addLoadedFile(loadedFile);
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
    rebuildSignalList();
  };
});

window.onload = () => {
  // Nothing to do here
};