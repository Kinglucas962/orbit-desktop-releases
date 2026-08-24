const { contextBridge, ipcRenderer } = require('electron');

// API mínima e específica. Nenhum módulo Node é exposto ao site remoto.
contextBridge.exposeInMainWorld('orbitDesktop', {
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  onUpdate: (listener) => {
    const wrapped = (_event, data) => listener(data);
    ipcRenderer.on('update:event', wrapped);
    return () => ipcRenderer.removeListener('update:event', wrapped);
  },
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getShortcuts: () => ipcRenderer.invoke('shortcuts:get'),
  setShortcut: (action, accelerator) => ipcRenderer.invoke('shortcuts:set', { action, accelerator }),
  setShortcutCaptureActive: (active) => ipcRenderer.invoke('shortcuts:capture', active),
  onShortcut: (listener) => {
    const wrapped = (_event, action) => listener(action);
    ipcRenderer.on('shortcut:trigger', wrapped);
    return () => ipcRenderer.removeListener('shortcut:trigger', wrapped);
  }
});
