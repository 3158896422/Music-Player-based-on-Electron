# 修复 BrowserWindow 错误

## 🐛 问题描述

**错误信息**: `BrowserWindow is not a constructor`

**错误位置**: `userApi/rendererEvent.js:67`

**原因**: `userApi/rendererEvent.js` 在渲染进程中被导入和运行，但它直接调用了 `userApiMain.createWindow()`，而 `createWindow` 函数使用了 `BrowserWindow` 类，这个类只能在 Electron 主进程中使用，不能在渲染进程中使用。

---

## ✅ 修复方案

### 问题分析

**错误的架构**:
```
渲染进程 (app.js)
    ↓
导入 userApi/rendererEvent.js
    ↓
调用 userApiRendererEvent.loadApi()
    ↓
直接调用 userApiMain.createWindow()  ❌
    ↓
需要使用 BrowserWindow（只能在主进程）
    ↓
报错：BrowserWindow is not a constructor
```

**正确的架构**:
```
渲染进程 (app.js)
    ↓
调用 userApiRendererEvent.loadApi()
    ↓
通过 IPC 调用主进程
    ↓
主进程处理 load-user-api 请求
    ↓
调用 userApiMain.createWindow()  ✅
    ↓
成功创建 BrowserWindow
```

---

### 1. 修改 userApi/rendererEvent.js

**修改前**:
```javascript
const { ipcMain } = require('electron');
const userApiMain = require('./main');

const loadApi = async (apiId, apiInfo) => {
  // ...
  await userApiMain.createWindow(userApi);  // ❌ 在渲染进程中调用主进程代码
};
```

**修改后**:
```javascript
const { ipcRenderer } = require('electron');

const loadApi = async (apiId, apiInfo) => {
  // ...
  // 通过 IPC 调用主进程加载音源
  const result = await ipcRenderer.invoke('load-user-api', apiInfo);
  
  if (!result.success) {
    throw new Error(result.error || '加载失败');
  }
};
```

**关键变化**:
- ✅ 使用 `ipcRenderer` 替代 `ipcMain`
- ✅ 移除对 `userApiMain` 的直接引用
- ✅ 通过 IPC 调用主进程加载音源

---

### 2. 在 main.js 中实现 IPC 处理器

**新增代码**:
```javascript
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
```

**说明**: 
- 在主进程中处理 `load-user-api` 请求
- 调用 `userApiMain.createWindow()` 创建音源窗口
- 返回成功/失败状态

---

### 3. 修改 sourceManager.js

**修改前**:
```javascript
async loadSource(sourceInfo) {
  // ...
  const result = await ipcRenderer.invoke('load-user-api-by-id', {
    sourceId: sourceInfo.id,
    name: sourceInfo.name
  });
  // ...
}
```

**修改后**:
```javascript
async loadSource(sourceInfo) {
  // ...
  // 通过 IPC 加载音源脚本
  const result = await ipcRenderer.invoke('load-user-api', sourceInfo);
  // ...
}
```

**说明**: 直接使用 `load-user-api` 接口，传递完整的 sourceInfo 对象。

---

## 🔄 完整工作流程

### 加载音源的正确流程

```
1. 用户点击音源
    ↓
2. app.js 调用 loadSourceScript(source)
    ↓
3. 调用 userApiRendererEvent.loadApi(source.id, source)
    ↓
4. userApiRendererEvent 通过 IPC 发送 'load-user-api' 请求
    ↓
5. main.js 接收请求，调用 userApiMain.createWindow(sourceInfo)
    ↓
6. userApiMain.createWindow() 创建 BrowserWindow
    ↓
7. 加载 preload 脚本
    ↓
8. preload 脚本设置 global.lx
    ↓
9. 音源脚本调用 lx.on('request', handler)
    ↓
10. 音源就绪，发送 'userApi_init' 事件
    ↓
11. userApiRendererEvent 接收事件，更新状态
    ↓
12. 音源可以正常使用
```

---

## 📝 修改的文件

### 1. [`userApi/rendererEvent.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/userApi/rendererEvent.js)
**关键修改**:
- ✅ 使用 `ipcRenderer` 替代 `ipcMain`
- ✅ 移除对 `userApiMain` 的直接引用
- ✅ 通过 IPC 调用主进程加载音源
- ✅ 简化事件处理逻辑

### 2. [`main.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/main.js)
**关键修改**:
- ✅ 实现 `load-user-api` IPC 处理器
- ✅ 在主进程中调用 `userApiMain.createWindow()`
- ✅ 移除不必要的 `load-user-api-by-id` 接口

### 3. [`sourceManager.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/sourceManager.js)
**关键修改**:
- ✅ 使用 `load-user-api` 接口
- ✅ 传递完整的 sourceInfo 对象

---

## 🎯 Electron 进程模型

### 主进程 (Main Process)
- ✅ 可以创建 `BrowserWindow`
- ✅ 可以访问所有 Node.js 和 Electron API
- ✅ 负责管理应用生命周期
- ✅ 处理 IPC 请求

### 渲染进程 (Renderer Process)
- ❌ 不能创建 `BrowserWindow`
- ✅ 可以访问部分 Node.js API（取决于配置）
- ✅ 负责渲染 UI
- ✅ 通过 IPC 与主进程通信

### 音源窗口 (Sandbox Window)
- ❌ 不能创建 `BrowserWindow`
- ✅ 运行在沙盒环境中
- ✅ 通过 preload 脚本提供有限的 API
- ✅ 执行第三方音源脚本

---

## ✅ 修复结果

- ✅ 不再出现 `BrowserWindow is not a constructor` 错误
- ✅ 音源加载流程正确
- ✅ 进程间通信正常
- ✅ 音源脚本可以正常加载和执行
- ✅ 播放和下载功能正常

---

## 📚 相关文档

- [Electron 进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)

---

**修复日期**: 2026-03-22
**版本**: v3.0.3
**状态**: ✅ 已修复并测试
