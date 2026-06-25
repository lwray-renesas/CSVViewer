const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function requireParamCount(args, expected, name) {
  if (args.length !== expected) {
    throw new Error(
        `${name} expects ${expected} parameter(s), got ${args.length}`);
  }
}

function requireNumber(value, index) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Parameter ${index + 1} must be a valid number`);
  }
}

function requireRange(value, min, max, name) {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function requireMinLessThanMax(min, max) {
  if (min >= max) {
    throw new Error(`Min must be less than max`);
  }
}

function validateNoParams(args, name) {
  if (args.length !== 0) {
    throw new Error(`${name} takes no parameters`);
  }
}

function validateNoParams(args, name) {
  if (args.length !== 0) {
    throw new Error(`${name} takes no parameters`);
  }
}


// =========================
// LPF
// =========================
function lpfFn(data, args) {
  const alpha = args[0] ?? 0.1;
  let prev = data[0] ?? 0;

  return data.map(v => {
    if (v == null) return null;

    prev = alpha * v + (1 - alpha) * prev;
    return prev;
  });
}

function validateLpf(args) {
  requireParamCount(args, 1, 'LPF');
  requireNumber(args[0], 0);
  requireRange(args[0], 0, 1, 'LPF coeff');
}

// =========================
// HPF
// =========================
function hpfFn(data, args) {
  const alpha = args[0] ?? 0.1;

  let prevY = 0;
  let prevX = data[0] ?? 0;

  return data.map(x => {
    if (x == null) return null;

    const y = alpha * (prevY + x - prevX);
    prevY = y;
    prevX = x;
    return y;
  });
}

function validateHpf(args) {
  requireParamCount(args, 1, 'HPF');
  requireNumber(args[0], 0);
  requireRange(args[0], 0, 1, 'HPF coeff');
}

// =========================
// MEDIAN FILTER
// =========================
function medianFn(data, args) {
  const window = args[0] ?? 5;

  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice =
        data.slice(start, i + 1).filter(v => v != null).sort((a, b) => a - b);

    if (slice.length === 0) return null;

    const mid = Math.floor(slice.length / 2);
    return slice[mid];
  });
}

function validateMedian(args) {
  requireParamCount(args, 1, 'MED_FILTER');
  requireNumber(args[0], 0);
  requirePositiveInteger(args[0], 'Window');
}

// =========================
// RMS
// =========================
function rmsFn(data, args) {
  const window = args[0] ?? 10;

  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1).filter(v => v != null);

    if (slice.length === 0) return null;

    const meanSq = slice.reduce((sum, v) => sum + v * v, 0) / slice.length;
    return Math.sqrt(meanSq);
  });
}

function validateRms(args) {
  requireParamCount(args, 1, 'RMS');
  requireNumber(args[0], 0);
  requirePositiveInteger(args[0], 'Window');
}

// =========================
// SIMPLE MOVING AVERAGE
// =========================
function smaFn(data, args) {
  const window = args[0] ?? 5;

  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1).filter(v => v != null);

    if (slice.length === 0) return null;

    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function validateSma(args) {
  requireParamCount(args, 1, 'SMA');
  requireNumber(args[0], 0);
  requirePositiveInteger(args[0], 'Window');
}

// =========================
// DIFFERENTIAL
// =========================
function diffFn(data) {
  return data.map((v, i) => {
    if (i === 0 || v == null || data[i - 1] == null) return null;
    return v - data[i - 1];
  });
}

// =========================
// SCALE
// =========================
function scaleFn(data, args) {
  const k = args[0] ?? 1;

  return data.map(v => v == null ? null : v * k);
}

function validateScale(args) {
  requireParamCount(args, 1, 'SCALE');
  requireNumber(args[0], 0);
}

// =========================
// OFFSET
// =========================
function offsetFn(data, args) {
  const k = args[0] ?? 0;
  return data.map(v => v == null ? null : v + k);
}

function validateOffset(args) {
  requireParamCount(args, 1, 'OFFSET');
  requireNumber(args[0], 0);
}

// =========================
// CLIP
// =========================
function clipFn(data, args) {
  const min = args[0];
  const max = args[1];

  return data.map(v => v == null ? null : Math.min(max, Math.max(min, v)));
}

function validateClip(args) {
  requireParamCount(args, 2, 'CLIP');

  requireNumber(args[0], 0);
  requireNumber(args[1], 1);

  requireMinLessThanMax(args[0], args[1]);
}

// =========================
// ABS
// =========================
function absFn(data) {
  return data.map(v => v == null ? null : Math.abs(v));
}

// =========================
// NORAMILSE
// =========================
function normFn(data) {
  const valid = data.filter(v => v != null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);

  return data.map(v => v == null ? null : (v - min) / (max - min));
}

const SUPPORTED_FUNCTIONS = {
  lpf: {name: 'LPF(coeff)', params: 1, fn: lpfFn, validate: validateLpf},
  hpf: {name: 'HPF(coeff)', params: 1, fn: hpfFn, validate: validateHpf},
  medfilter: {
    name: 'MED_FILTER(window)',
    params: 1,
    fn: medianFn,
    validate: validateMedian
  },
  sma: {name: 'SMA(window)', params: 1, fn: smaFn, validate: validateSma},
  rms: {name: 'RMS(window)', params: 1, fn: rmsFn, validate: validateRms},
  diff: {
    name: 'DIFF()',
    params: 0,
    fn: diffFn,
    validate: (args) => validateNoParams(args, 'DIFF')
  },
  scale:
      {name: 'SCALE(factor)', params: 1, fn: scaleFn, validate: validateScale},
  offset: {
    name: 'OFFSET(offset)',
    params: 1,
    fn: offsetFn,
    validate: validateOffset
  },
  clip: {name: 'CLIP(min,max)', params: 2, fn: clipFn, validate: validateClip},
  abs: {
    name: 'ABS()',
    params: 0,
    fn: absFn,
    validate: (args) => validateNoParams(args, 'ABS')
  },
  norm: {
    name: 'NORM()',
    params: 0,
    fn: normFn,
    validate: (args) => validateNoParams(args, 'NORM')
  },
};

function parseExpression(expr) {
  const match = expr.trim().match(/^(\w+)\((.*)\)$/);
  if (!match) return null;

  const rawArgs = match[2].trim();

  let args = [];

  if (rawArgs !== '') {
    args = rawArgs.split(',').map(x => {
      const n = Number(x.trim());
      return Number.isNaN(n) ? NaN : n;
    });
  }

  return {fn: match[1], args};
}


// =========================
// Create Window
// =========================
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// =========================
// Menu (optional dev tools)
// =========================
function createMenu() {
  const template = [
    {
      label: 'Settings',
      submenu: [
        {role: 'toggleDevTools'},
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// =========================
// App Ready
// =========================
app.whenReady().then(() => {
  createWindow();
  createMenu();
});

// =========================
// CSV File Loader
// =========================
ipcMain.handle('open-csv-files', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open CSV Files',
    properties: ['openFile', 'multiSelections'],
    filters: [{name: 'CSV Files', extensions: ['csv']}],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const filesData = [];

  for (const filePath of result.filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');

      if (lines.length === 0) return [];

      const headers = lines[0].split(',').map(h => h.replace(/^#+/, '').trim());

      // Skip metadata rows until first numeric row
      let startIndex = 1;

      for (; startIndex < lines.length; startIndex++) {
        const parts = lines[startIndex].split(',');

        const hasNumber = parts.some(v => !Number.isNaN(Number(v)));

        if (hasNumber) break;
      }

      // Parse rows
      const rows = [];

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',');

        if (parts.length !== headers.length) continue;  // skip malformed

        const row = {};

        headers.forEach((h, idx) => {
          row[h] = parts[idx];
        });

        rows.push(row);
      }

      filesData.push({
        path: filePath,
        headers: Object.keys(rows[0] || {}),
        rows,
      });

    } catch (err) {
      console.error(`Failed to load ${filePath}:`, err);
    }
  }

  return filesData;
});

// =========================
// Waveform Generator
// =========================
ipcMain.handle('generate-waveform', async (_, {data, expr}) => {
  try {
    const parsed = parseExpression(expr);
    if (!parsed) {
      throw new Error('Invalid expression');
    }

    const {fn, args} = parsed;

    const entry = SUPPORTED_FUNCTIONS[fn];
    if (!entry) {
      throw new Error(`Unknown function: ${fn}`);
    }

    if (!entry.validate) {
      throw new Error(`Function has no validation method!`);
    }

    /* Validate the functions arguments - throws error if fails*/
    entry.validate(args);

    const result = entry.fn(data, args);

    return {success: true, result};

  } catch (err) {
    console.error('Waveform error:', err);

    return {success: false, error: err.message};
  }
});

// =========================
// Supported Functions
// =========================
ipcMain.handle('get-functions', () => {
  return Object.entries(SUPPORTED_FUNCTIONS)
      .map(([key, val]) => ({id: key, name: val.name, params: val.params}));
});

// =========================
// Cleanup
// =========================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});