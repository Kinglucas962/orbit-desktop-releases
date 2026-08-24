const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbitDisplayPicker', {
  onSources: (listener) => ipcRenderer.once('display-picker:sources', (_event, data) => listener(data)),
  select: (requestId, sourceId, includeAudio) => ipcRenderer.send('display-picker:select', { requestId, sourceId, includeAudio }),
  cancel: (requestId) => ipcRenderer.send('display-picker:cancel', requestId)
});
