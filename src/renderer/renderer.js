let loadedFiles = [];
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
  const headers = rawHeaders.map(h => h.replace(/^#/, '').trim());

  let startIndex = 0;

  for (let i = 0; i < file.rows.length; i++) {
    const row = file.rows[i];

    const values = headers.map((h, idx) => Number(row[rawHeaders[idx]]));

    const hasNumber = values.some(v => !Number.isNaN(v));

    if (hasNumber) {
      startIndex = i;
      break;
    }
  }

  const buffers = headers.map(() => []);

  for (let i = startIndex; i < file.rows.length; i++) {
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


window.addEventListener('DOMContentLoaded', async () => {
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
});

window.onload = () => {
  // Nothing to do here
};