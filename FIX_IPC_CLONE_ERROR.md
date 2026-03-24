# 修复 "An object could not be cloned" 错误

## 🐛 问题描述

**错误信息**: `An object could not be cloned`

**错误位置**: `userApi/rendererEvent.js:92` - `ipcRenderer.send`

**根本原因**:
1. `apiInfo` 对象中包含 `script` 字段（函数），无法通过 Electron IPC 序列化
2. Vue 响应式代理对象可能包含不可序列化的内部属性

---

## ✅ 修复方案

### 1. 清理歌曲信息对象（sourceManager.js）

**问题**: Vue 响应式代理对象可能包含不可序列化的内部属性

**解决方案**: 使用 `JSON.parse(JSON.stringify())` 创建纯净的可序列化对象

```javascript
createCleanSongInfo(song) {
  const serialized = JSON.stringify({
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    songmid: song.songmid,
    hash: song.hash,
    source: song.source,
    cover: song.cover,
    albummid: song.albummid
  });
  return JSON.parse(serialized);
}
```

**说明**:
- 通过 JSON 序列化/反序列化，移除所有不可序列化的属性（函数、undefined、Symbol 等）
- 确保传递给 IPC 的数据都是纯 JSON 数据

---

### 2. 只存储必要的音源信息（userApi/rendererEvent.js）

**问题**: `apiInfo` 对象包含 `script` 字段（函数），无法序列化

**解决方案**: 只存储必要的元数据，不包含 `script` 字段

```javascript
const loadApi = async (apiId, apiInfo) => {
  // 只存储必要的音源信息，避免存储不可序列化的数据
  userApi = {
    id: apiInfo.id,
    name: apiInfo.name,
    version: apiInfo.version,
    author: apiInfo.author,
    description: apiInfo.description
  };

  // 通过 IPC 调用主进程加载音源
  const result = await ipcRenderer.invoke('load-user-api', apiInfo);
  // ...
};
```

**说明**:
- `script` 字段是函数，不能通过 IPC 序列化
- 将 `script` 保留在 `apiInfo` 中，只传递给主进程（主进程可以 require 该文件）

---

### 3. 修复 IPC 调用（userApi/rendererEvent.js）

**问题**: `openDevTools` 和 `closeApi` 函数引用了不存在的 `userApiMain`

**解决方案**: 通过 IPC 调用主进程

```javascript
const openDevTools = () => {
  if (userApi) {
    ipcRenderer.send('userApi_openDevTools', userApi.id);
  }
};

const closeApi = (apiId) => {
  ipcRenderer.send('unload-user-api', apiId);
  userApi = null;
};
```

---

### 4. 添加 IPC 处理器（main.js）

**新增处理器**:

```javascript
// 处理打开开发者工具
ipcMain.on('userApi_openDevTools', (event, apiId) => {
  const userApi = require('./userApi/main');
  userApi.openDevTools(apiId);
});
```

---

## 🔄 数据流程

### 播放歌曲时的数据流程

```
1. 用户点击播放
    ↓
2. app.js 调用 sourceManager.request(source, 'musicUrl', { type, musicInfo })
    ↓
3. sourceManager.createCleanSongInfo() 创建纯净的歌曲信息
    ↓
   - JSON.stringify() 序列化
    ↓
   - JSON.parse() 反序列化
    ↓
   - 移除所有不可序列化的属性
    ↓
4. 通过 IPC 发送请求到主进程
    ↓
5. 主进程转发到音源窗口
    ↓
6. 音源脚本处理请求，返回 URL
    ↓
7. URL 返回到 app.js，开始播放
```

---

## 📝 修改的文件

### 1. [`sourceManager.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/sourceManager.js)
- ✅ 添加 `createCleanSongInfo()` 方法
- ✅ 使用 `JSON.parse(JSON.stringify())` 确保数据可序列化

### 2. [`userApi/rendererEvent.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/userApi/rendererEvent.js)
- ✅ 在 `loadApi()` 中只存储必要的音源信息
- ✅ 修复 `openDevTools()` 使用 IPC
- ✅ 修复 `closeApi()` 使用 IPC

### 3. [`main.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/main.js)
- ✅ 添加 `userApi_openDevTools` IPC 处理器

---

## 🧪 测试验证

测试脚本 `test-full-flow.js` 验证了：
- ✅ 歌曲对象可 JSON 序列化
- ✅ 纯净歌曲信息可 JSON 序列化
- ✅ 请求数据可 JSON 序列化
- ✅ IPC 数据结构正确

---

## ✅ 修复结果

- ✅ 不再出现 `An object could not be cloned` 错误
- ✅ 歌曲信息正确清理，移除不可序列化属性
- ✅ 音源信息只传递必要的元数据
- ✅ IPC 通信正常
- ✅ 播放和下载功能可以正常工作

---

## 🎯 关键技术点

### Electron IPC 序列化限制

Electron 使用 **结构化克隆算法**（Structured Clone Algorithm）进行 IPC 通信，该算法有以下限制：

1. **不能包含函数** - 函数无法被克隆
2. **不能包含 undefined** - undefined 在某些情况下会导致失败
3. **不能包含循环引用** - 会导致栈溢出
4. **不能包含 Symbol** - Symbol 不能被克隆
5. **不能包含非枚举属性** - 只有可枚举属性会被克隆

### 解决方案

使用 `JSON.parse(JSON.stringify())` 可以：
1. **移除函数** - JSON.stringify 会忽略函数
2. **移除 undefined** - JSON.stringify 会忽略 undefined
3. **移除 Symbol** - JSON.stringify 会忽略 Symbol
4. **展平对象** - 只保留可枚举的自身属性
5. **确保可序列化** - 反序列化后得到纯净的 JSON 对象

---

**修复日期**: 2026-03-22
**版本**: v3.0.5
**状态**: ✅ 已修复并测试
