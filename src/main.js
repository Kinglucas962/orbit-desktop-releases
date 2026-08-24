const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, desktopCapturer, session, globalShortcut } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const config = require('./config');
const appIconPath = path.join(__dirname, 'assets', 'orbit-icon.png');
const deepLinkScheme = 'orbit';

let mainWindow;
let tray;
let updateWindow;
let isQuitting = false;
let updateReady = false;
let latestUpdateEvent = { type: 'idle' };
const displayRequests = new Map();
const shortcutActions = new Set(['toggle-mute', 'toggle-deafen', 'toggle-stream']);
const defaultShortcuts = {
  'toggle-mute': 'CommandOrControl+Shift+M',
  'toggle-deafen': 'CommandOrControl+Shift+D',
  'toggle-stream': 'CommandOrControl+Shift+S'
};
let shortcuts = { ...defaultShortcuts };

function shortcutFilePath() {
  return path.join(app.getPath('userData'), 'shortcuts.json');
}

function loadShortcuts() {
  try {
    const saved = JSON.parse(fs.readFileSync(shortcutFilePath(), 'utf8'));
    for (const action of shortcutActions) {
      if (typeof saved?.[action] === 'string') shortcuts[action] = saved[action];
    }
  } catch {}
}

function saveShortcuts() {
  fs.writeFileSync(shortcutFilePath(), JSON.stringify(shortcuts, null, 2), 'utf8');
}

function triggerShortcut(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut:trigger', action);
  }
}

function registerShortcut(action, accelerator) {
  return globalShortcut.register(accelerator, () => triggerShortcut(action));
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll();
  for (const [action, accelerator] of Object.entries(shortcuts)) {
    if (!registerShortcut(action, accelerator)) {
      console.warn(`[Orbit] Atalho indisponível: ${action} (${accelerator})`);
    }
  }
}

function validateShortcut(action, accelerator) {
  if (!shortcutActions.has(action)) return 'Ação de atalho inválida.';
  if (typeof accelerator !== 'string' || accelerator.length < 2 || accelerator.length > 80) {
    return 'Combinação de teclas inválida.';
  }
  if (!/^[A-Za-z0-9+]+$/.test(accelerator)) return 'A combinação contém uma tecla não suportada.';
  if (Object.entries(shortcuts).some(([key, value]) => key !== action && value === accelerator)) {
    return 'Esse atalho já está sendo usado por outra ação.';
  }
  const standaloneFunctionKey = /^F(?:[1-9]|1\d|2[0-4])$/.test(accelerator);
  const standaloneSpecialKey = new Set([
    'PageDown',
    'PageUp',
    'Home',
    'End',
    'Insert',
    'Delete',
    'Up',
    'Down',
    'Left',
    'Right',
    'Space'
  ]).has(accelerator);
  const hasModifier = /(^|\+)(CommandOrControl|Control|Alt|Shift|Super)(\+|$)/.test(accelerator);
  if (!standaloneFunctionKey && !standaloneSpecialKey && !hasModifier) {
    return 'Use PgDn, PgUp, Home, End, Insert, Delete, uma seta, espaço, F1–F24 ou uma combinação com Ctrl, Alt ou Shift.';
  }
  return null;
}

function getInviteTarget(args) {
  const rawDeepLink = args.find(
    (value) => typeof value === 'string' && value.toLowerCase().startsWith(`${deepLinkScheme}://`)
  );

  if (!rawDeepLink) return null;

  try {
    const deepLink = new URL(rawDeepLink);
    const invitePath = deepLink.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const isInvite = deepLink.hostname.toLowerCase() === 'invite' || invitePath === 'invite';
    const token = deepLink.searchParams.get('token') || '';

    if (
      !isInvite ||
      token.length < 20 ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    ) {
      return null;
    }

    const target = new URL(config.remoteUrl);
    target.pathname = '/';
    target.search = '';
    target.hash = '';
    target.searchParams.set('privateInvite', token);
    return target.toString();
  } catch {
    return null;
  }
}

let pendingInviteTarget = getInviteTarget(process.argv);

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(deepLinkScheme, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(deepLinkScheme);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on('second-instance', (_event, commandLine) => {
  const inviteTarget = getInviteTarget(commandLine);

  if (inviteTarget) {
    showMainWindow(inviteTarget);
    return;
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  const inviteTarget = getInviteTarget([url]);

  if (!inviteTarget) return;

  if (app.isReady()) {
    showMainWindow(inviteTarget);
  } else {
    pendingInviteTarget = inviteTarget;
  }
});

function showMainWindow(targetUrl) {
  if (mainWindow) {
    if (targetUrl) {
      void mainWindow.loadURL(targetUrl);
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Orbit',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  mainWindow.loadURL(targetUrl || config.remoteUrl);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedOrigin(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle('Orbit');
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function isTrustedOrigin(origin) {
  try {
    return new URL(origin).origin === new URL(config.remoteUrl).origin;
  } catch {
    return false;
  }
}

async function openDisplayPicker(request, callback) {
  if (!isTrustedOrigin(request.securityOrigin)) {
    callback({});
    return;
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true
    });
    const requestId = crypto.randomUUID();
    const pickerWindow = new BrowserWindow({
      width: 920,
      height: 650,
      minWidth: 720,
      minHeight: 500,
      modal: true,
      parent: mainWindow,
      title: 'Compartilhar tela — Orbit',
      icon: appIconPath,
      webPreferences: {
        preload: path.join(__dirname, 'display-picker-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    pickerWindow.removeMenu();
    displayRequests.set(requestId, { callback, sources, pickerWindow, audioRequested: request.audioRequested });
    pickerWindow.loadFile(path.join(__dirname, 'display-picker.html'));
    pickerWindow.webContents.once('did-finish-load', () => {
    pickerWindow.webContents.send('display-picker:sources', {
      requestId,
      audioRequested: request.audioRequested,
      sources: sources.map((source) => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL() }))
    });
    });
    pickerWindow.on('closed', () => {
      const pending = displayRequests.get(requestId);
      if (pending) {
        displayRequests.delete(requestId);
        pending.callback({});
      }
    });
  } catch {
    callback({});
  }
}

function configureDisplayCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(openDisplayPicker);
}

function sendUpdate(type, payload = {}) {
  latestUpdateEvent = { type, ...payload };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:event', latestUpdateEvent);
  }
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('update:event', latestUpdateEvent);
  }
}

function showUpdateWindow() {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.show();
    updateWindow.focus();
    return;
  }
  updateWindow = new BrowserWindow({
    width: 420,
    height: 270,
    resizable: false,
    maximizable: false,
    minimizable: false,
    modal: !!mainWindow,
    parent: mainWindow,
    title: 'Atualização do Orbit',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'update-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  updateWindow.removeMenu();
  updateWindow.loadFile(path.join(__dirname, 'update.html'));
  updateWindow.webContents.once('did-finish-load', () => {
    updateWindow.webContents.send('update:event', latestUpdateEvent);
  });
  updateWindow.on('closed', () => { updateWindow = null; });
}

function checkForUpdates() {
  const { owner, repo } = config.updates;
  if (!app.isPackaged || !owner || !repo) return;
  sendUpdate('checking');
  autoUpdater.checkForUpdates().catch((error) => sendUpdate('error', { message: error.message }));
}

function configureUpdates() {
  const { owner, repo } = config.updates;
  if (!owner || !repo) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({ provider: 'github', owner, repo });
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-available', (info) => sendUpdate('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdate('not-available'));
  autoUpdater.on('download-progress', (progress) => sendUpdate('progress', { percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', (info) => { updateReady = true; sendUpdate('downloaded', { version: info.version }); });
  autoUpdater.on('error', (error) => sendUpdate('error', { message: error.message }));
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets', 'orbit-tray.png');
  const trayIcon = nativeImage.createFromPath(trayIconPath);

  if (trayIcon.isEmpty()) {
    console.error(`[Orbit] Não foi possível carregar o ícone da bandeja: ${trayIconPath}`);
    return;
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Orbit');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Orbit', click: showMainWindow },
    { label: 'Procurar atualizações', click: checkForUpdates },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', showMainWindow);
}

app.whenReady().then(() => {
  loadShortcuts();
  configureDisplayCapture();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Orbit', submenu: [{ label: 'Mostrar', click: showMainWindow }, { type: 'separator' }, { label: 'Sair', click: () => { isQuitting = true; app.quit(); } }] },
    { label: 'Ajuda', submenu: [{ label: 'Abrir site', click: () => shell.openExternal(config.remoteUrl) }, { label: 'Procurar atualizações', click: checkForUpdates }] }
  ]));
  showMainWindow(pendingInviteTarget || undefined);
  pendingInviteTarget = null;
  createTray();
  configureUpdates();
  registerAllShortcuts();
  setTimeout(checkForUpdates, 5000);
});

ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('update:install', () => { if (updateReady) { isQuitting = true; autoUpdater.quitAndInstall(); } });
ipcMain.handle('update:close', () => updateWindow?.close());
ipcMain.handle('update:get-state', () => latestUpdateEvent);
ipcMain.handle('shortcuts:get', (event) => {
  if (!isTrustedOrigin(event.senderFrame.url)) return { ...defaultShortcuts };
  return { ...shortcuts };
});
ipcMain.handle('shortcuts:capture', (event, active) => {
  if (!isTrustedOrigin(event.senderFrame.url)) return;
  if (active === true) globalShortcut.unregisterAll();
  else registerAllShortcuts();
});
ipcMain.handle('shortcuts:set', (event, payload = {}) => {
  if (!isTrustedOrigin(event.senderFrame.url)) {
    return { ok: false, error: 'Origem não autorizada.' };
  }

  const { action, accelerator } = payload;
  const validationError = validateShortcut(action, accelerator);
  if (validationError) return { ok: false, error: validationError };

  const previous = shortcuts[action];
  globalShortcut.unregister(previous);

  if (!registerShortcut(action, accelerator)) {
    registerShortcut(action, previous);
    return { ok: false, error: 'Essa combinação está reservada pelo Windows ou por outro programa.' };
  }

  shortcuts = { ...shortcuts, [action]: accelerator };

  try {
    saveShortcuts();
  } catch (error) {
    globalShortcut.unregister(accelerator);
    shortcuts = { ...shortcuts, [action]: previous };
    registerShortcut(action, previous);
    return { ok: false, error: `Não foi possível salvar o atalho: ${error.message}` };
  }

  return { ok: true, shortcuts: { ...shortcuts } };
});
ipcMain.on('display-picker:select', (event, { requestId, sourceId, includeAudio }) => {
  const pending = displayRequests.get(requestId);
  if (!pending || event.sender !== pending.pickerWindow.webContents) return;
  const source = pending.sources.find((item) => item.id === sourceId);
  if (!source) return;
  displayRequests.delete(requestId);
  const selection = { video: source };
  if (pending.audioRequested && includeAudio) {
    selection.audio = 'loopback';
  }
  pending.callback(selection);
  pending.pickerWindow.close();
});
ipcMain.on('display-picker:cancel', (event, requestId) => {
  const pending = displayRequests.get(requestId);
  if (!pending || event.sender !== pending.pickerWindow.webContents) return;
  displayRequests.delete(requestId);
  pending.callback({});
  pending.pickerWindow.close();
});
app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (event) => event.preventDefault());
