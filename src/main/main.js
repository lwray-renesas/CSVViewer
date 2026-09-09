const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

let win;
let csvLoadSession = null;


// =========================
// Create Window
// =========================
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
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
    properties: ['openFile'],
    filters: [{name: 'CSV Files', extensions: ['csv']}],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];

  const stream = fs.createReadStream(filePath);

  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  const iterator = reader[Symbol.asyncIterator]();
  const stats = fs.statSync(filePath);
  csvLoadSession = {
    filePath,
    iterator,
    headers: null,
    finished: false,
    totalBytes: stats.size,
    bytesRead: 0
  };

  return {
    path: filePath,
  };
});

// =========================
// CSV Chunks
// =========================
ipcMain.handle('csv-get-next-chunk', async () => {
  if (!csvLoadSession) {
    return {
      done: true,
      headers: [],
      rows: [],
    };
  }
  const CHUNK_SIZE = 3500;

  const rows = [];

  while (rows.length < CHUNK_SIZE) {
    const result = await csvLoadSession.iterator.next();

    if (result.done) {
      csvLoadSession.finished = true;
      break;
    }

    const line = result.value.trim();
    if (!line) {
      continue;
    }
    csvLoadSession.bytesRead += Buffer.byteLength(line, 'utf8') + 1;
    rows.push(line);
  }

  return {
    done: csvLoadSession.finished,
    rows,
    progress: Math.min(
        100, (csvLoadSession.bytesRead / csvLoadSession.totalBytes) * 100),

  };
});

// =========================
// Cleanup
// =========================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});