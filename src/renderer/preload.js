const {
  contextBridge,
  ipcRenderer,
} = require('electron');

// Setup API in context bridge, allowing renderer to invoke main.js API
contextBridge.exposeInMainWorld('api', {
  // Invocation API
  OpenCsvFiles: () => ipcRenderer.invoke('open-csv-files'),

  GenerateWaveform: (data, expr) =>
      ipcRenderer.invoke('generate-waveform', {data, expr}),

  GetFunctions: () => ipcRenderer.invoke('get-functions')

});