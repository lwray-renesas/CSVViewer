const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron');
const path = require('path');
const fs = require('fs');

let win;

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
// Cleanup
// =========================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});