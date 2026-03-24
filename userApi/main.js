const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let sandboxes = {};

const createWindow = async (userApi) => {
  console.log('创建音源窗口:', userApi.name);

  if (sandboxes[userApi.id]) {
    sandboxes[userApi.id].destroy();
  }

  let sb = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'renderer/search-preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  sandboxes[userApi.id] = sb;

  // 加载空白页面
  await sb.loadURL('about:blank');
  
  // 发送初始化事件给 preload，让它执行用户脚本
  sb.webContents.send('userApi_initEnv', userApi);
  
  console.log('✅ 脚本注入命令已发送:', userApi.name);

  sb.on('closed', () => {
    delete sandboxes[userApi.id];
  });

  return sb;
};

const closeWindow = async (apiId) => {
  if (sandboxes[apiId]) {
    sandboxes[apiId].destroy();
    delete sandboxes[apiId];
  }
};

const openDevTools = (apiId) => {
  if (sandboxes[apiId]) {
    sandboxes[apiId].webContents.openDevTools();
  }
};

const sendRequest = (apiId, requestKey, data) => {
  console.log('[sendRequest] apiId:', apiId, 'requestKey:', requestKey, 'data:', data);
  console.log('[sendRequest] available sandboxes:', Object.keys(sandboxes));

  if (!sandboxes[apiId]) {
    console.error('[sendRequest] ERROR: sandbox not found');
    return;
  }

  sandboxes[apiId].webContents.send('trigger-request', requestKey, data);
  console.log('[sendRequest] trigger-request sent');
};

ipcMain.on('sandbox-event', (event, type, data) => {
  let scriptId = null;
  for (let id in sandboxes) {
    if (sandboxes[id].webContents === event.sender) {
      scriptId = id;
      break;
    }
  }
  console.log('[sandbox-event] scriptId:', scriptId, 'type:', type);
  if (scriptId && global.mainWindow) {
    global.mainWindow.webContents.send('sandbox-event', scriptId, type, data);
  }
});

ipcMain.on('test-request', (event, scriptId, reqId, requestData) => {
  console.log('[test-request] scriptId:', scriptId, 'reqId:', reqId);
  if (sandboxes[scriptId]) {
    sandboxes[scriptId].webContents.send('trigger-request', reqId, requestData);
  } else {
    console.error('[test-request] sandbox not found for scriptId:', scriptId);
  }
});

module.exports = {
  createWindow,
  closeWindow,
  openDevTools,
  sendRequest
};