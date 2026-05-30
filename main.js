const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const axios = require('axios');
const { createInflate, constants: zlibConstants } = require('zlib');
const NodeID3 = require('node-id3');
const { setMeta } = require('./src/musicMeta');

let mainWindow;
let tray;
let qrc_decode;

// 单实例锁 - 确保应用只运行一个实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果没有获得锁，说明已经有一个实例在运行，直接退出
  console.log('[main] 已有实例运行，退出当前进程');
  app.quit();
} else {
  // 当用户再次启动应用时，将窗口显示出来
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[main] 检测到第二个实例启动，恢复主窗口');
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 加载 qrc_decode 原生模块
function loadQrcDecode() {
  try {
    const addon = require('./qrc_decode.node');
    qrc_decode = addon.qrc_decode;
    console.log('[main] qrc_decode 模块加载成功');
  } catch (error) {
    console.error('[main] qrc_decode 模块加载失败:', error.message);
    qrc_decode = null;
  }
}

function createWindow() {
  console.log('开始创建窗口');

  const iconPath = path.join(__dirname, 'fengmian.ico');
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#000000',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: true
  });

  global.mainWindow = mainWindow;

  console.log('窗口创建完成，加载index.html');
  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    console.log('窗口准备就绪，显示窗口');
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    console.log('窗口关闭');
    mainWindow = null;
  });
  
  mainWindow.on('show', () => {
    console.log('窗口已显示');
  });
  
  mainWindow.on('hide', () => {
    console.log('窗口已隐藏');
  });

  // 绑定 F12 快捷键打开开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
    // Ctrl+Shift+I 也可以打开开发者工具
    if (input.control && input.shift && input.key === 'I') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
    // Ctrl+Shift+J 打开控制台（Console 面板）
    if (input.control && input.shift && input.key === 'J') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });
}

function createTray() {
  try {
    const trayIconPath = path.join(__dirname, 'fengmian.ico');
    
    if (fs.existsSync(trayIconPath)) {
      tray = new Tray(trayIconPath);
    } else {
      tray = new Tray(nativeImage.createEmpty());
    }

    const contextMenu = Menu.buildFromTemplate([
      { label: '显示窗口', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: '播放/暂停', click: () => mainWindow.webContents.send('play-pause') },
      { label: '上一首', click: () => mainWindow.webContents.send('previous-song') },
      { label: '下一首', click: () => mainWindow.webContents.send('next-song') },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);

    tray.setToolTip('音乐播放器');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  } catch (e) {
    console.log('创建系统托盘失败:', e);
  }
}

function registerGlobalShortcuts() {
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('play-pause');
  });

  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('previous-song');
  });

  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('next-song');
  });
}

app.whenReady().then(() => {
  // 设置应用图标（用于任务管理器等系统位置）
  const iconPath = path.join(__dirname, 'fengmian.ico');
  const appIcon = nativeImage.createFromPath(iconPath);
  if (!appIcon.isEmpty()) {
    app.setAppUserModelId('com.musicplayer.app');
    console.log('[main] 应用图标设置成功');
  }
  
  loadQrcDecode();
  createWindow();
  createTray();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 窗口控制
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.hide();
});

// 选择音乐文件夹或文件
ipcMain.handle('select-folder', async () => {
  // 通知渲染进程显示导入类型选择对话框
  mainWindow.webContents.send('show-import-type-dialog');
  
  // 等待渲染进程返回选择结果
  return new Promise((resolve) => {
    const handleResult = (event, result) => {
      ipcMain.removeListener('import-type-selected', handleResult);
      resolve(result);
    };
    
    ipcMain.on('import-type-selected', handleResult);
    
    // 设置超时，防止用户一直不选择
    setTimeout(() => {
      ipcMain.removeListener('import-type-selected', handleResult);
      resolve(null);
    }, 300000); // 5 分钟超时
  });
});

// 选择文件对话框
ipcMain.handle('select-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: '选择音乐文件',
    filters: [
      { name: '音频文件', extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    buttonLabel: '导入'
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths;
});

// 选择文件夹对话框
ipcMain.handle('select-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择音乐文件夹',
    buttonLabel: '导入'
  });

  if (result.canceled) {
    return [];
  }

  return result.filePaths;
});

// 选择音源文件
ipcMain.handle('select-source-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JavaScript Files', extensions: ['js'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// 读取音源文件内容
ipcMain.handle('read-source-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 检查文件是否存在
ipcMain.handle('check-file-exists', async (event, filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
});

// 存储已导入的音源信息（在内存中）
const importedSourcesMap = new Map();

// 注册音源（在导入时调用）
ipcMain.handle('register-source', async (event, sourceInfo) => {
  importedSourcesMap.set(sourceInfo.id, sourceInfo);
  return { success: true };
});



// 通过 ID 加载音源脚本
ipcMain.handle('load-user-api', async (event, sourceInfo) => {
  try {
    console.log('[main] 加载音源:', sourceInfo.name);
    
    // 使用 userApi 模块加载音源
    const userApi = require('./userApi/main');
    await userApi.createWindow(sourceInfo);
    
    return { success: true };
  } catch (error) {
    console.error('[main] 加载音源失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 处理音源请求（发送请求到音源窗口）
ipcMain.on('userApi_request', (event, apiId, requestKey, data) => {
  console.log('[main] userApi_request received - apiId:', apiId, 'requestKey:', requestKey, 'data:', data);
  const userApi = require('./userApi/main');
  userApi.sendRequest(apiId, requestKey, data);
});

// 处理打开开发者工具
ipcMain.on('userApi_openDevTools', (event, apiId) => {
  const userApi = require('./userApi/main');
  userApi.openDevTools(apiId);
});

// 监听音源初始化事件（从 preload.js 发送）
ipcMain.on('userApi_init', (event, { apiId, data, status, message }) => {
  console.log('[main] 收到 userApi_init 事件:', { apiId, status, message });
  // 转发给渲染进程
  if (global.mainWindow) {
    global.mainWindow.webContents.send('userApi_init', { apiId, data, status, message });
  }
});

// 卸载音源脚本
ipcMain.handle('unload-user-api', async (event, sourceId) => {
  try {
    console.log('[main] 卸载音源:', sourceId);
    
    const userApi = require('./userApi/main');
    await userApi.closeWindow(sourceId);
    
    return { success: true };
  } catch (error) {
    console.error('[main] 卸载音源失败:', error.message);
    return { success: false, error: error.message };
  }
});

// 音源搜索
let sourceSearchWindow = null;

ipcMain.on('source-search', async (event, sourceData, query) => {
  try {
    if (!sourceData || !sourceData.script) {
      event.sender.send('source-search-error', '音源数据无效');
      return;
    }

    // 创建隐藏窗口执行搜索
    if (sourceSearchWindow) {
      sourceSearchWindow.close();
    }

    const preloadPath = path.join(__dirname, 'userApi', 'renderer', 'search-preload.js');

    sourceSearchWindow = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        preload: preloadPath
      }
    });

    let scriptReady = false;
    let requestId = 0;
    const pendingRequests = {};
    let preloadReadyHandler = null;
    let sandboxEventHandler = null;

    // 先注册监听器
    preloadReadyHandler = (event, channel) => {
      if (channel === 'preload-ready') {
        console.log('[main] Preload ready, injecting user script...');
        // 移除自身监听器
        sourceSearchWindow.webContents.removeListener('ipc-message', preloadReadyHandler);
        // 注入用户脚本
        sourceSearchWindow.webContents.executeJavaScript(sourceData.script).then(() => {
          console.log('[main] 用户脚本执行成功');
          scriptReady = true;
        }).catch(err => {
          console.error('[main] 用户脚本执行失败:', err);
          event.sender.send('source-search-error', '用户脚本执行失败：' + err.message);
        });
      }
    };

    sandboxEventHandler = (ipcEvent, channel, ...args) => {
      if (channel === 'sandbox-event') {
        const [type, data] = args;
        console.log('[main] 沙盒事件:', type, data);

        if (type === 'response') {
          const { reqId, response } = data;
          if (pendingRequests[reqId]) {
            pendingRequests[reqId](response);
            delete pendingRequests[reqId];
          }
        } else if (type === 'error') {
          const { reqId, msg } = data;
          if (pendingRequests[reqId]) {
            pendingRequests[reqId]({ status: false, message: msg });
            delete pendingRequests[reqId];
          }
        }
      }
    };

    sourceSearchWindow.webContents.on('ipc-message', preloadReadyHandler);
    sourceSearchWindow.webContents.on('ipc-message', sandboxEventHandler);
    sourceSearchWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[renderer] ${message}`);
    });

    sourceSearchWindow.loadURL('about:blank').then(() => {
      console.log('[main] Window loaded, waiting for preload...');

      // 发送搜索请求
      let searchRequestAttempts = 0;
      const maxAttempts = 100; // 最多尝试 100 次（10 秒）
      const sendSearchRequest = () => {
        searchRequestAttempts++;
        console.log(`[main] sendSearchRequest attempt ${searchRequestAttempts}/${maxAttempts}, scriptReady:`, scriptReady);
        
        if (searchRequestAttempts >= maxAttempts) {
          console.error('[main] Search request timeout after', maxAttempts, 'attempts');
          event.sender.send('source-search-error', '脚本初始化超时，请检查音源文件是否有效');
          sourceSearchWindow.close();
          sourceSearchWindow = null;
          return;
        }
        
        if (!scriptReady) {
          setTimeout(sendSearchRequest, 100);
          return;
        }

        const reqId = `search_${++requestId}`;
        const requestData = {
          source: 'custom',
          action: 'search',
          info: { keyword: query }
        };

        console.log('[main] Sending trigger-request:', reqId, requestData);
        sourceSearchWindow.webContents.send('trigger-request', reqId, requestData);

        pendingRequests[reqId] = (response) => {
          console.log('[main] Search result received:', response);
          event.sender.send('source-search-result', response);
          sourceSearchWindow.close();
          sourceSearchWindow = null;
        };

        // 超时处理 - 10 秒
        setTimeout(() => {
          if (pendingRequests[reqId]) {
            console.log('[main] Search timeout');
            delete pendingRequests[reqId];
            event.sender.send('source-search-error', '搜索超时');
            sourceSearchWindow.close();
            sourceSearchWindow = null;
          }
        }, 10000);
      };

      // 延迟发送搜索请求，等待脚本初始化
      console.log('[main] Waiting 500ms before sending search request...');
      setTimeout(sendSearchRequest, 500);
    });

  } catch (error) {
    event.sender.send('source-search-error', error.message);
  }
});

// 获取下载目录
ipcMain.handle('get-download-path', async () => {
  // 默认下载到用户的音乐文件夹
  const downloadPath = path.join(app.getPath('music'), 'MusicPlayer_Downloads');
  
  // 确保目录存在
  try {
    await fs.promises.mkdir(downloadPath, { recursive: true });
  } catch (error) {
    console.error('创建下载目录失败:', error);
  }
  
  return downloadPath;
});

// 下载文件
ipcMain.handle('download-file', async (event, url, filename, options = {}) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, message: '用户取消' };
    }

    const filePath = result.filePath;

    // 使用 axios 下载文件
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000
    });

    const file = fs.createWriteStream(filePath);
    response.data.pipe(file);

    await new Promise((resolve, reject) => {
      file.on('finish', resolve);
      file.on('error', reject);
    });

    // 内嵌封面和歌词到音频文件
    console.log('[download-file] 检查是否需要写入元数据...');
    console.log('[download-file] options:', JSON.stringify({
      coverUrl: options.coverUrl ? '[存在]' : null,
      lyrics: options.lyrics ? options.lyrics.substring(0, 50) + '...' : null,
      title: options.title,
      artist: options.artist,
      album: options.album
    }, null, 2));
    
    if (options.coverUrl || options.lyrics || options.title || options.artist || options.album) {
      try {
        const meta = {
          title: options.title || '',
          artist: options.artist || '',
          album: options.album || '',
          APIC: options.coverUrl || null,
          lyrics: options.lyrics || null,
        };
        console.log('[download-file] 开始写入元数据, filePath:', filePath);
        console.log('[download-file] meta对象:', JSON.stringify({
          ...meta,
          APIC: meta.APIC ? '[图片数据]' : null,
          lyrics: meta.lyrics ? meta.lyrics.substring(0, 50) + '...' : null
        }, null, 2));
        await setMeta(filePath, meta);
        console.log('[download-file] 元数据写入完成');
      } catch (metaError) {
        console.error('[download-file] 写入元数据失败:', metaError.message, metaError.stack);
      }
    } else {
      console.log('[download-file] 无需写入元数据（条件不满足）');
    }

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// 扫描音乐文件
ipcMain.handle('scan-music-folder', async (event, selectedPaths) => {
  const musicFiles = [];
  const supportedFormats = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'];
  
  // 处理单个路径或路径数组
  const paths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
  
  function scanDirectory(dirPath) {
    try {
      const files = fs.readdirSync(dirPath);
      const subtitleFiles = {};
      
      // 首先扫描所有字幕文件
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (!stat.isDirectory()) {
          const ext = path.extname(file).toLowerCase();
          const subtitleFormats = ['.lrc', '.txt'];
          if (subtitleFormats.includes(ext)) {
            const baseName = path.basename(file, ext);
            subtitleFiles[baseName] = filePath;
          }
        }
      });
      
      // 然后扫描音乐文件并匹配字幕
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        
        if (!stat.isDirectory()) {
          const ext = path.extname(file).toLowerCase();
          if (supportedFormats.includes(ext)) {
            const baseName = path.basename(file, ext);
            const subtitlePath = subtitleFiles[baseName];
            
            musicFiles.push({
              path: filePath,
              name: baseName,
              format: ext.substring(1),
              subtitle: subtitlePath
            });
          }
        }
      });
    } catch (error) {
      console.error('扫描目录失败:', error);
    }
  }
  
  try {
    // 遍历所有选中的路径
    for (const selectedPath of paths) {
      const stat = fs.statSync(selectedPath);
      
      if (stat.isDirectory()) {
        // 如果是文件夹，扫描该文件夹
        scanDirectory(selectedPath);
      } else if (stat.isFile()) {
        // 如果是文件，检查是否为音频文件
        const ext = path.extname(selectedPath).toLowerCase();
        if (supportedFormats.includes(ext)) {
          const baseName = path.basename(selectedPath, ext);
          musicFiles.push({
            path: selectedPath,
            name: baseName,
            format: ext.substring(1),
            subtitle: null
          });
        }
      }
    }
    
    // 读取音乐元数据
    const filesWithMetadata = await Promise.all(
      musicFiles.map(async (file) => {
        try {
          // 尝试使用不同编码解析元数据，解决 WAV 文件乱码问题
          let metadata;
          
          // 对于 WAV 文件，优先使用 GBK 编码
          if (file.format === 'wav') {
            try {
              metadata = await mm.parseFile(file.path, { encoding: 'gbk' });
              console.log(`使用 gbk 编码解析 WAV 文件成功:`, file.path);
            } catch (e) {
              console.log(`使用 gbk 编码解析 WAV 文件失败:`, e.message);
              // 如果 GBK 失败，尝试其他编码
              let encodings = ['utf8', 'gb2312', 'ascii'];
              let encodingIndex = 0;
              
              while (encodingIndex < encodings.length) {
                try {
                  const encoding = encodings[encodingIndex];
                  metadata = await mm.parseFile(file.path, { encoding });
                  console.log(`使用${encoding}编码解析成功:`, file.path);
                  break;
                } catch (e) {
                  console.log(`使用${encodings[encodingIndex]}编码解析失败:`, e.message);
                  encodingIndex++;
                }
              }
              
              // 如果所有编码都失败，使用默认解析
              if (!metadata) {
                metadata = await mm.parseFile(file.path);
              }
            }
          } else {
            // 对于其他格式，使用默认编码
            metadata = await mm.parseFile(file.path);
          }
          console.log('读取元数据成功:', file.path);
          console.log('文件格式:', metadata.format.container);
          
          let cover = null;
          
          // 检查不同格式的封面存储位置
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            cover = mm.selectCover(metadata.common.picture);
            console.log('从 common.picture 获取封面:', cover ? cover.format : '无');
          } else if (metadata.format.container === 'mp3' && metadata.mp3 && metadata.mp3.picture) {
            cover = metadata.mp3.picture[0];
            console.log('从 mp3.picture 获取封面:', cover ? cover.format : '无');
          } else if (metadata.format.container === 'ogg' && metadata.vorbis && metadata.vorbis.picture) {
            cover = metadata.vorbis.picture[0];
            console.log('从 vorbis.picture 获取封面:', cover ? cover.format : '无');
          } else if (metadata.format.container === 'flac' && metadata.flac && metadata.flac.picture) {
            cover = metadata.flac.picture[0];
            console.log('从 flac.picture 获取封面:', cover ? cover.format : '无');
          }
          
          // 处理编码问题，确保文本显示正确
          function fixEncoding(str) {
            if (!str) return str;
            try {
              // 尝试将字符串转换为正确的编码
              return decodeURIComponent(escape(str));
            } catch (e) {
              return str;
            }
          }
          
          // 对于 WAV 文件，直接使用文件名作为标题和艺术家，避免编码问题
          if (file.format === 'wav') {
            return {
              ...file,
              title: file.name,
              artist: '未知艺术家',
              album: '未知专辑',
              genre: '未知流派',
              year: null,
              duration: metadata.format.duration,
              cover: cover ? `data:${cover.format || 'image/jpeg'};base64,${cover.data.toString('base64')}` : null
            };
          }
          
          // 检查是否有内嵌歌词
          let embeddedLyrics = null;
          if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
            embeddedLyrics = metadata.common.lyrics[0];
          }
          // 对于 MP3 文件，使用 node-id3 读取 ID3 歌词
          if (!embeddedLyrics && file.format === 'mp3') {
            try {
              const id3Tags = NodeID3.read(file.path);
              if (id3Tags && id3Tags.unsynchronisedLyrics) {
                embeddedLyrics = id3Tags.unsynchronisedLyrics.text;
                console.log('[scan-music-folder] 通过 node-id3 读取到 MP3 歌词');
              }
            } catch (e) {
              console.log('[scan-music-folder] node-id3 读取歌词失败:', e.message);
            }
          }
          
          return {
            ...file,
            title: fixEncoding(metadata.common.title) || file.name,
            artist: fixEncoding(metadata.common.artist) || '未知艺术家',
            album: fixEncoding(metadata.common.album) || '未知专辑',
            genre: metadata.common.genre ? fixEncoding(metadata.common.genre[0]) : '未知流派',
            year: metadata.common.year,
            duration: metadata.format.duration,
            cover: cover ? `data:${cover.format || 'image/jpeg'};base64,${cover.data.toString('base64')}` : null,
            subtitle: file.subtitle,
            lyrics: embeddedLyrics
          };
        } catch (error) {
          console.error('读取元数据失败:', file.path, error);
          return {
            ...file,
            title: file.name,
            artist: '未知艺术家',
            album: '未知专辑',
            genre: '未知流派',
            year: null,
            duration: null,
            cover: null,
            subtitle: file.subtitle,
            lyrics: null
          };
        }
      })
    );
    
    return filesWithMetadata;
  } catch (error) {
    console.error('扫描音乐文件夹失败:', error);
    return [];
  }
});

// 保存导入的音乐路径（使用文件存储，因为渲染进程的 localStorage 在重启后会持久化）
let userDataPath;

// 在 app ready 后才能获取 userData 路径
app.whenReady().then(() => {
  userDataPath = require('path').join(app.getPath('userData'), 'imported-paths.json');
  console.log('[main] userDataPath:', userDataPath);
});

ipcMain.handle('save-imported-paths', async (event, paths) => {
  try {
    if (!userDataPath) {
      userDataPath = require('path').join(app.getPath('userData'), 'imported-paths.json');
      console.log('[main] 延迟初始化 userDataPath:', userDataPath);
    }
    const data = JSON.stringify(paths);
    await fs.promises.writeFile(userDataPath, data, 'utf-8');
    console.log('[main] 保存导入路径成功:', paths.length, '个路径，文件路径:', userDataPath);
    // 验证写入
    const verifyData = await fs.promises.readFile(userDataPath, 'utf-8');
    const verifyPaths = JSON.parse(verifyData);
    console.log('[main] 验证写入成功，读取到路径数量:', verifyPaths.length);
    return { success: true };
  } catch (error) {
    console.error('[main] 保存导入路径失败:', error, 'userDataPath:', userDataPath);
    return { success: false, error: error.message };
  }
});

// 加载已保存的导入路径
ipcMain.handle('load-imported-paths', async (event) => {
  try {
    console.log('[main] 尝试从文件加载导入路径:', userDataPath);
    const data = await fs.promises.readFile(userDataPath, 'utf-8');
    const paths = JSON.parse(data);
    console.log('[main] 加载导入路径成功:', paths.length, '个路径');
    return paths;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[main] 导入路径文件不存在，返回空数组');
    } else {
      console.error('[main] 加载导入路径失败:', error);
    }
    return [];
  }
});

// QQ 音乐 QRC 歌词解密
const inflate = async(lrcBuf) => new Promise((resolve, reject) => {
  const buffer_builder = [];
  const decompress_stream = createInflate()
    .on('data', (chunk) => {
      buffer_builder.push(chunk);
    })
    .on('close', () => {
      resolve(Buffer.concat(buffer_builder).toString());
    })
    .on('error', (err) => {
      if (err.errno !== zlibConstants.Z_BUF_ERROR) {
        reject(err);
      }
    });
  decompress_stream.end(lrcBuf);
});

const decodeQrc = async(str) => {
  if (!str) return '';
  if (!qrc_decode) {
    throw new Error('qrc_decode 模块未加载');
  }
  const buf = Buffer.from(str, 'hex');
  const decrypted = qrc_decode(buf, buf.length);
  return inflate(decrypted);
};

ipcMain.handle('tx-decode-lyric', async (event, { lrc, tlrc, rlrc }) => {
  try {
    const [lyric, tlyric, rlyric] = await Promise.all([
      decodeQrc(lrc),
      decodeQrc(tlrc),
      decodeQrc(rlrc)
    ]);
    return {
      success: true,
      lyric,
      tlyric,
      rlyric
    };
  } catch (error) {
    console.error('[main] QRC 解密失败:', error.message);
    return {
      success: false,
      error: error.message,
      lyric: '',
      tlyric: '',
      rlyric: ''
    };
  }
});
