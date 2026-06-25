let loadedFiles = [];
let generatedWaveforms = [];
const datasets = [];
const dataBuffers = [];

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
      },
      y: {
        grid: {color: 'rgba(255,255,255,0.05)'},
        ticks: {color: '#94a3b8'},
      },
    },
  },
});

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
function addFile(file) {
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

  const rawHeaders = file.headers;
  const headers = rawHeaders

  const buffers = headers.map(() => []);

  for (let i = 0; i < file.rows.length; i++) {
    const row = file.rows[i];

    headers.forEach((header, colIndex) => {
      const value = Number(row[rawHeaders[colIndex]]);
      buffers[colIndex].push(Number.isNaN(value) ? null : value);
    });
  }

  const datasetStartIndex = datasets.length;

  buffers.forEach((buffer, i) => {
    dataBuffers.push(buffer);

    datasets.push({
      label: '',              // set later by index updater
      rawHeader: headers[i],  // store clean header
      data: buffer,
      borderColor: getColour(datasets.length),
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 0,
    });
  });

  chart.data.datasets = datasets;
  chart.data.labels = [...Array(buffers[0].length).keys()];

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
    const files = await window.api.OpenCsvFiles();  // you'll add this IPC

    files.forEach(file => {
      addFile(file);
    });
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