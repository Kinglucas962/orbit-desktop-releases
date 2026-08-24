const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbitUpdate', {
  onEvent: (listener) => ipcRenderer.on('update:event', (_event, data) => listener(data)),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  close: () => ipcRenderer.invoke('update:close')
});
