let loadedFiles = [];
let generatedWaveforms = [];
const datasets = [];
const dataBuffers = [];

let csvLoading = false;
let csvHeaders = null;
let csvBuffers = [];
let csvPath = '';
let headerLinesSeen = 0;

const ctx = document.getElementById('chart').getContext('2d');

const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,

    interaction: {
      intersect: false,
      mode: 'index',
    },

    plugins: {
      legend: {
        labels: {
          color: '#e5e7eb',
        },
      },
      decimation: {
        enabled: true,
        algorithm: 'min-max',
      },

      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
        },
        zoom: {
          wheel: {
            enabled: true,  // mouse wheel zoom
          },
          pinch: {
            enabled: true,  // trackpad pinch
          },
          drag: {
            enabled: true,
            modifierKey: 'ctrl',
            backgroundColor: 'rgba(59,130,246,0.2)',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          mode: 'xy',
        }
      }
    },

    scales: {
      x: {
        grid: {color: 'rgba(255,255,255,0.05)'},
        ticks: {color: '#94a3b8'},
        type: 'linear'
      },
      y: {
        grid: {color: 'rgba(255,255,255,0.05)'},
        ticks: {color: '#94a3b8'},
      },
    },
  },
});

function finishCsvLoad() {
  const buffers = csvBuffers;

  const file = {
    path: csvPath,
    headers: csvHeaders,
    buffers,
  };
  setLoadingState(false);
  addLoadedFile(file);
}

function processCsvChunk(lines) {
  for (const line of lines) {
    const parts = line.split(',');

    // Process first 3 lines differently
    if (headerLinesSeen < 3) {
      if (headerLinesSeen === 0) {
        csvHeaders = parts.map(h => h.replace(/^#+/, '').trim());

        csvBuffers = csvHeaders.map(() => []);
      }

      headerLinesSeen++;
      continue;
    }

    // Skip row if ANY field is empty
    if (parts.some(v => v.trim() === '')) {
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

  setLoadingState(true, chunk.progress, 'Opening file...');

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
  headerLinesSeen = 0;

  csvLoading = true;

  setLoadingState(true, 0, 'Opening file...');

  requestAnimationFrame(csvLoadLoop);
}

// Sets loading state
function setLoadingState(loading, progress = 0, text = '') {
  const overlay = document.getElementById('loadingOverlay');

  const fill = document.getElementById('progressFill');
  const label = document.getElementById('loadingText');
  const percent = document.getElementById('progressPercent');

  if (loading) {
    overlay.classList.remove('hidden');

    fill.style.width = `${progress}%`;
    percent.innerText = `${progress.toFixed(0)}%`;

    label.innerText = text;

  } else {
    overlay.classList.add('hidden');
  }

  document.querySelectorAll('button,select,input').forEach(el => {
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
      const header = datasets[datasetIndex].rawHeader;
      datasets[datasetIndex].label = `[${newIndex}] ${header}`;
    }
  });

  updateDatasetSelector();
  updateExpressionPreview();
  chart.update();
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

  const datasetStartIndex = datasets.length;

  buffers.forEach((buffer, i) => {
    const numericBuffer = buffer.map(v => {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    });

    dataBuffers.push(numericBuffer);

    datasets.push({
      label: '',              // set later by index updater
      rawHeader: headers[i],  // store clean header
      data: numericBuffer.map((y, x) => ({x, y})),
      borderColor: getColour(datasets.length),
      borderWidth: 2,
      pointRadius: 0,
    });
  });

  chart.data.datasets = datasets;

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
}

// Helper function to remove a file
function removeFile(fileRecord) {
  // Remove datasets + buffers
  datasets.splice(fileRecord.startIndex, fileRecord.count);
  dataBuffers.splice(fileRecord.startIndex, fileRecord.count);

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

  chart.data.datasets = datasets;

  updateFileIndices();
}

function addWaveformEntry(name, datasetIndex) {
  const list = document.getElementById('waveformList');

  const entry = document.createElement('div');
  entry.className = 'file-entry';

  const label = document.createElement('div');
  label.className = 'file-path';
  label.innerText = name;

  const removeBtn = document.createElement('div');
  removeBtn.className = 'file-remove';
  removeBtn.innerText = '✕';

  entry.appendChild(label);
  entry.appendChild(removeBtn);
  list.appendChild(entry);

  const record = {dataset: datasets[datasetIndex], element: entry};

  generatedWaveforms.push(record);

  removeBtn.onclick = () => removeWaveform(record);
}

function removeWaveform(record) {
  const index = datasets.indexOf(record.dataset);

  if (index !== -1) {
    datasets.splice(index, 1);
  }

  // Remove from DOM
  record.element.remove();

  // Remove from list
  generatedWaveforms = generatedWaveforms.filter(w => w !== record);

  updateDatasetSelector();
  updateExpressionPreview();
  chart.update();
}

function buildExpression() {
  const fn = document.getElementById('functionSelect').value;
  const param = document.getElementById('functionParam').value.trim();

  return `${fn}(${param})`;
}

function updateDatasetSelector() {
  const select = document.getElementById('datasetSelect');
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = '';

  datasets.forEach((ds, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.text = ds.label;
    select.appendChild(option);
  });

  if (previousValue !== '' && datasets[previousValue]) {
    select.value = previousValue;
  } else if (datasets.length > 0) {
    // fallback to first entry
    select.value = 0;
  }
}

function updateExpressionPreview() {
  const expr = buildExpression();
  const preview = document.getElementById('expressionPreview');
  const datasetSelect = document.getElementById('datasetSelect');

  // Reset styles
  preview.style.borderColor = '';
  preview.style.background = '';

  if (!expr) {
    preview.innerHTML = `<span class="expr-label">fx</span>`;
    preview.classList.remove('active');
    return;
  }

  const datasetIndex = parseInt(datasetSelect.value, 10);
  const sourceDataset = datasets[datasetIndex];

  if (!sourceDataset) {
    preview.innerHTML = `<span class="expr-label">fx</span>`;
    preview.classList.remove('active');
    return;
  }

  const inputName = sourceDataset.rawHeader;

  // Inject as FIRST argument
  const parsed = expr.match(/^(\w+)\((.*)\)$/);

  let displayExpr = expr;

  if (parsed) {
    const fn = parsed[1];
    const args = parsed[2];

    displayExpr = args ? `${fn}(${inputName}, ${args})` : `${fn}(${inputName})`;
  }

  preview.innerHTML = `<span class="expr-label">fx</span> ` +
      `<span class="expr-fn"> = ${parsed ? parsed[1] : ''}</span>` +
      `(` +
      `<span class="expr-input">${inputName}</span>` +
      (parsed && parsed[2] ? `, ${parsed[2]}` : '') + `)`;

  preview.classList.add('active');
}

function showExpressionError(message) {
  const preview = document.getElementById('expressionPreview');

  preview.innerHTML = `<span class="expr-label">error</span> ${message}`;
  preview.classList.add('active');

  // make it red
  preview.style.borderColor = '#ef4444';
  preview.style.background = 'rgba(239,68,68,0.1)';
}

async function createDerivedWaveform(datasetIndex, expr) {
  const sourceDataset = datasets[datasetIndex];

  if (!sourceDataset) {
    showExpressionError('Invalid Dataset Selected!');
    return;
  }

  const response = await window.api.GenerateWaveform(sourceDataset.data, expr);

  if (!response.success) {
    showExpressionError(response.error);
    return;
  }

  const name = `${sourceDataset.label}_${expr}`;

  datasets.push({
    label: name,
    rawHeader: name,
    data: response.result,
    borderColor: getColour(datasets.length),
    borderWidth: 2,
    tension: 0.2,
    pointRadius: 0,
  });

  const newIndex = datasets.length - 1;
  addWaveformEntry(name, newIndex)

  updateDatasetSelector();
  chart.update();
}

window.addEventListener('DOMContentLoaded', async () => {
  const functions = await window.api.GetFunctions();

  const select = document.getElementById('functionSelect');
  select.innerHTML = '';

  functions.forEach(f => {
    const option = document.createElement('option');
    option.value = f.id;
    option.text = `${f.name}`;
    select.appendChild(option);
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

  ctx.canvas.addEventListener('dblclick', () => {
    chart.resetZoom();
  });

  document.getElementById('datasetSelect').onchange = updateExpressionPreview;

  document.getElementById('functionSelect').onchange = updateExpressionPreview;

  document.getElementById('functionParam').oninput = updateExpressionPreview;

  document.getElementById('addWaveform').onclick = () => {
    const datasetIndex =
        parseInt(document.getElementById('datasetSelect').value, 10);

    const expr = buildExpression();

    createDerivedWaveform(datasetIndex, expr);
  };

  updateExpressionPreview();
});

window.onload = () => {
  // Nothing to do here
};