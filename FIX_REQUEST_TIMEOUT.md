# 修复请求超时问题

## 🐛 问题描述

**错误信息**: `Request timeout`

**根本原因**: preload 中的 `trigger-request` 事件处理函数实现不正确，导致请求无法正确传递到音源脚本。

---

## ✅ 修复方案

### 关键问题

在 `search-preload.js` 中，`trigger-request` 事件处理函数：
1. 错误地重新打包了请求数据
2. 没有正确等待 Promise 返回
3. 参数传递方式不正确

### 参考洛雪官方实现

从洛雪测试工具 `sandbox-preload.js` 可以看到：

```javascript
ipcRenderer.on('trigger-request', async (event, reqId, data) => {
  if (!events.request) {
    ipcRenderer.send('sandbox-event', 'error', { reqId, msg: '脚本未注册请求处理程序' });
    return;
  }
  try {
    const response = await events.request(data);  // 直接传递 data
    ipcRenderer.send('sandbox-event', 'response', { reqId, response });
  } catch (err) {
    ipcRenderer.send('sandbox-event', 'error', { reqId, msg: err.message || err });
  }
});
```

### 修复后的实现

**文件**: [`userApi/renderer/search-preload.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/userApi/renderer/search-preload.js)

```javascript
ipcRenderer.on('trigger-request', async (event, reqId, data) => {
  console.log('[trigger-request] received:', reqId, data);

  // 检查是否有 request 处理器
  if (!events.request) {
    console.error('[trigger-request] No request handler registered');
    ipcRenderer.send('sandbox-event', 'error', { reqId, msg: '脚本未注册请求处理程序' });
    return;
  }

  try {
    console.log('[trigger-request] calling events.request with data:', data);

    // 直接传递 data，不重新打包（参考洛雪官方实现）
    const response = await events.request.call(global.lx, data);
    console.log('[trigger-request] events.request returned:', response);

    // 发送响应事件
    ipcRenderer.send('sandbox-event', 'response', { reqId, response });
  } catch (err) {
    console.error('[trigger-request] error:', err.message);
    ipcRenderer.send('sandbox-event', 'error', { reqId, msg: err.message || err });
  }
});
```

---

## 🔄 请求数据流

### 1. 从主窗口发送到音源窗口

```
app.js
    ↓
sourceManager.request()
    ↓
userApiRendererEvent.request()
    ↓
ipcRenderer.send('userApi_request', apiId, requestKey, data)
    ↓
main.js 接收 'userApi_request'
    ↓
userApiMain.sendRequest(apiId, requestKey, data)
    ↓
ipcRenderer.send('trigger-request', requestKey, data)
    ↓
sandbox 窗口接收 'trigger-request'
```

### 2. 从音源窗口返回响应

```
sandbox 窗口
    ↓
preload 脚本处理 'trigger-request'
    ↓
调用 events.request(data)
    ↓
音源脚本处理请求，返回 Promise
    ↓
preload 发送 'sandbox-event' (response)
    ↓
main.js 接收并转发
    ↓
userApiRendererEvent.request() Promise resolve
    ↓
app.js 获取 URL
```

---

## 📝 请求数据格式

### 洛雪测试工具使用的格式

```javascript
// 发送请求
ipcRenderer.send('test-request', scriptId, reqId, {
  action: 'musicUrl',
  source: 'tx',
  info: {
    type: '128k',
    musicInfo: {
      id: '0039MnYb0qxYhV',
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      songmid: '0039MnYb0qxYhV',
      source: 'tx',
      cover: '...'
    }
  }
});
```

### 我们的实现

```javascript
// app.js 中调用
sourceManager.request('tx', 'musicUrl', {
  type: '128k',
  musicInfo: song  // 歌曲信息对象
});
```

### 数据结构转换

| 字段 | 描述 |
|------|------|
| `action` | 请求动作，如 `musicUrl`、`search`、`lyric` |
| `source` | 平台标识，如 `tx`、`wy`、`kg` |
| `info.type` | 音质，如 `128k`、`320k`、`flac` |
| `info.musicInfo` | 歌曲信息对象 |

---

## 🎯 关键修复点

### 1. 直接传递 data

```javascript
// ❌ 错误：重新打包数据
const requestData = {
  source: data.source || 'custom',
  action: data.action || 'search',
  info: { keyword, page, type }
};
const result = events.request.call(global.lx, requestData);

// ✅ 正确：直接传递 data
const response = await events.request.call(global.lx, data);
```

### 2. 使用 async/await

```javascript
// ❌ 错误：没有等待 Promise
const result = events.request.call(global.lx, data);
result.then(...).catch(...);

// ✅ 正确：使用 async/await
const response = await events.request.call(global.lx, data);
ipcRenderer.send('sandbox-event', 'response', { reqId, response });
```

### 3. 错误处理

```javascript
// ✅ 正确：捕获所有异常
try {
  const response = await events.request.call(global.lx, data);
  ipcRenderer.send('sandbox-event', 'response', { reqId, response });
} catch (err) {
  ipcRenderer.send('sandbox-event', 'error', { reqId, msg: err.message || err });
}
```

---

## ✅ 修复结果

- ✅ 不再出现 `Request timeout` 错误
- ✅ 请求数据正确传递到音源脚本
- ✅ 响应正确返回到主窗口
- ✅ 播放和下载功能正常工作

---

## 📚 参考文档

- [洛雪测试工具 lx-source-tester](file:///D:/Trae%20CN/project/lx-source-tester/main.js)
- [洛雪 preload sandbox-preload.js](file:///D:/Trae%20CN/project/lx-source-tester/sandbox-preload.js)

---

**修复日期**: 2026-03-22
**版本**: v3.0.6
**状态**: ✅ 已修复
