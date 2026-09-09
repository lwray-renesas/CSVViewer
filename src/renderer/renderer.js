import {ChartManager} from './util/chartManager.js';
import {CsvLoader} from './util/csvLoader.js';
import {FileManager} from './util/fileManager.js';
import {SignalListView} from './util/signalListView.js';
import {SignalManager} from './util/signalManager.js';

const signalManager = new SignalManager();
const fileManager = new FileManager(signalManager);
const csvLoader = new CsvLoader(window.api);
let chartManager = null;
let signalListView = null;
let resizingSidebar = false;


function refreshUi() {
  chartManager.synchronise();
}

function refreshFileLabels() {
  fileManager.files.forEach(file => {
    const fileName = file.path.split(/[\\/]/).pop();
    file.element.querySelector('.file-path').innerText =
        `[${file.index}] ${fileName}`;
  });
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

  removeBtn.onclick = () => {
    fileManager.removeFile(fileRecord);
    refreshFileLabels();
    signalListView.rebuild();
    refreshUi();
  };

  refreshFileLabels();
  signalListView.rebuild();
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

  signalManager.datasets.forEach((ds, index) => {
    const match = ds.label.match(regex);

    if (match?.[1]) {
      ds.label = match[1];
    }
  });

  signalListView.rebuild();
  refreshUi();
}

window.addEventListener('DOMContentLoaded', async () => {
  chartManager =
      new ChartManager(document.getElementById('chart'), signalManager);

  const sidebar = document.getElementById('sidebar');
  const resizeHandle = document.getElementById('sidebarResizeHandle');
  const dataList = document.getElementById('dataList');

  signalListView =
      new SignalListView(dataList, signalManager, fileManager, chartManager);

  // Sortable list
  Sortable.create(dataList, {
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

    setLoadingState(true, 'Opening Files...');

    const file = await window.api.OpenCsvFiles();

    setLoadingState(false);

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
    signalManager.datasets.forEach(ds => {
      ds.label = ds.rawHeader;
    });
    signalListView.rebuild();
    refreshUi();
  };
});

window.onload = () => {
  // Nothing to do here
};