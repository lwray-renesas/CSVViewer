const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function scaleFn(data, args) {
  const k = args[0] ?? 1;

  return data.map(v => v == null ? null : v * k);
}

function lpfFn(data, args) {
  const alpha = args[0] ?? 0.1;
  let prev = data[0] ?? 0;

  return data.map(v => {
    if (v == null) return null;

    prev = alpha * v + (1 - alpha) * prev;
    return prev;
  });
}

function clipFn(data, args) {
  const min = args[0];
  const max = args[1];

  return data.map(v => v == null ? null : Math.min(max, Math.max(min, v)));
}

const SUPPORTED_FUNCTIONS = {
  scale: {name: 'Scale(coeff)', params: 1, fn: scaleFn},
  lpf: {name: 'LPF(coeff)', params: 1, fn: lpfFn},
  clip: {name: 'Clip(min,max)', params: 2, fn: clipFn}
};

function parseExpression(expr) {
  const match = expr.trim().match(/^(\w+)\((.*)\)$/);
  if (!match) return null;

  return {fn: match[1], args: match[2].split(',').map(x => Number(x.trim()))};
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

  const parse = require('csv-parse/sync');

  const filesData = [];

  for (const filePath of result.filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      const rows = parse.parse(content, {
        columns: true,
        skip_empty_lines: true,
      });

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
    if (!parsed) throw new Error('Invalid expression');

    const {fn, args} = parsed;

    const entry = SUPPORTED_FUNCTIONS[fn];
    if (!entry) throw new Error(`Unknown function: ${fn}`);

    const result = entry.fn(data, args);

    return {success: true, result};

  } catch (err) {
    console.error('Waveform error:', err);

    dialog.showErrorBox('Waveform Error', err.message);

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