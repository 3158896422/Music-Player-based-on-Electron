# 修复 userApiMain is not defined 错误

## 🐛 问题描述

**错误信息**: `userApiMain is not defined`

**错误位置**: `userApi/rendererEvent.js:91`

**原因**: 在之前的修复中，我们移除了 `userApiMain` 的引用，但在 `request` 函数中还有一处使用了 `userApiMain.sendRequest()`。

---

## ✅ 修复方案

### 问题分析

**错误代码**:
```javascript
// userApi/rendererEvent.js
const request = async ({ requestKey, data }) => {
  // ...
  userApiMain.sendRequest(userApi.id, requestKey, data);  // ❌ userApiMain 未定义
};
```

**正确的做法**:
通过 IPC 发送请求到主进程，由主进程调用 `userApiMain.sendRequest()`。

---

### 1. 修改 userApi/rendererEvent.js

**修改前**:
```javascript
const request = async ({ requestKey, data }) => {
  return new Promise((resolve, reject) => {
    // ...
    userApiMain.sendRequest(userApi.id, requestKey, data);  // ❌
  });
};
```

**修改后**:
```javascript
const request = async ({ requestKey, data }) => {
  return new Promise((resolve, reject) => {
    // ...
    // 通过 IPC 发送请求到主进程
    ipcRenderer.send('userApi_request', userApi.id, requestKey, data);  // ✅
  });
};
```

---

### 2. 在 main.js 中添加 IPC 处理器

**新增代码**:
```javascript
// 处理音源请求（发送请求到音源窗口）
ipcMain.on('userApi_request', (event, apiId, requestKey, data) => {
  const userApi = require('./userApi/main');
  userApi.sendRequest(apiId, requestKey, data);
});
```

**说明**: 
- 主进程接收 `userApi_request` 事件
- 调用 `userApiMain.sendRequest()` 发送请求到音源窗口
- 音源窗口的 preload 脚本会触发 `trigger-request` 事件

---

## 🔄 完整的请求流程

### 播放歌曲时的 URL 获取流程

```
1. 用户点击播放
    ↓
2. app.js 调用 playBuiltinSong(song)
    ↓
3. 调用 sourceManager.request()
    ↓
4. 调用 window.userApiRendererEvent.request()
    ↓
5. userApiRendererEvent 发送 'userApi_request' IPC 事件
    ↓
6. main.js 接收事件，调用 userApiMain.sendRequest()
    ↓
7. 发送到音源窗口的 'trigger-request' 事件
    ↓
8. preload 脚本触发 events.request()
    ↓
9. 音源脚本处理请求，返回 URL
    ↓
10. URL 通过 'userApi_response' 事件返回
    ↓
11. 最终返回到 playBuiltinSong，开始播放
```

---

## 📝 修改的文件

### 1. [`userApi/rendererEvent.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/userApi/rendererEvent.js)
**关键修改**:
- ✅ 移除 `userApiMain.sendRequest()` 调用
- ✅ 通过 `ipcRenderer.send('userApi_request')` 发送请求

### 2. [`main.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/main.js)
**关键修改**:
- ✅ 添加 `userApi_request` IPC 处理器
- ✅ 调用 `userApiMain.sendRequest()` 发送请求到音源窗口

---

## 🎯 进程间通信架构

### 渲染进程 → 主进程 → 音源窗口

```
渲染进程 (app.js)
    ↓
调用 userApiRendererEvent.request()
    ↓
发送 'userApi_request' IPC 事件
    ↓
主进程 (main.js)
    ↓
调用 userApiMain.sendRequest()
    ↓
发送 'trigger-request' 事件到音源窗口
    ↓
音源窗口 (sandbox)
    ↓
preload 触发 events.request()
    ↓
音源脚本处理并返回结果
```

### 音源窗口 → 主进程 → 渲染进程

```
音源窗口 (sandbox)
    ↓
发送 'sandbox-event' (response)
    ↓
主进程 (main.js)
    ↓
转发 'userApi_response' 事件
    ↓
渲染进程 (userApi/rendererEvent.js)
    ↓
Promise resolve，返回结果
    ↓
app.js 获取到 URL
```

---

## ✅ 修复结果

- ✅ 不再出现 `userApiMain is not defined` 错误
- ✅ 请求流程正确
- ✅ 播放和下载可以正常获取 URL
- ✅ 进程间通信完整

---

## 📚 完整的 IPC 事件列表

| 事件名称 | 方向 | 用途 |
|---------|------|------|
| `load-user-api` | 渲染 → 主 | 加载音源脚本 |
| `unload-user-api` | 渲染 → 主 | 卸载音源脚本 |
| `userApi_request` | 渲染 → 主 | 发送请求到音源 |
| `userApi_response` | 主 → 渲染 | 返回请求结果 |
| `userApi_init` | 主 → 渲染 | 音源初始化完成 |
| `trigger-request` | 主 → 音源 | 触发音源请求 |
| `sandbox-event` | 音源 → 主 | 音源事件（响应/错误） |

---

## 🎯 Electron IPC 最佳实践

### ✅ 推荐做法
1. **明确进程边界** - 主进程代码只能在主进程运行
2. **使用 IPC 通信** - 进程间通过 IPC 传递消息
3. **避免直接引用** - 渲染进程不要直接引用主进程模块
4. **使用 invoke/handle** - 需要返回结果时使用 invoke/handle
5. **使用 send/on** - 单向通知使用 send/on

### ❌ 错误做法
1. **跨进程调用** - 在渲染进程调用主进程函数
2. **直接 require** - 渲染进程 require 主进程模块
3. **共享变量** - 试图通过全局变量共享数据
4. **忽略错误处理** - 不处理 IPC 请求失败

---

**修复日期**: 2026-03-22
**版本**: v3.0.4
**状态**: ✅ 已修复并测试
