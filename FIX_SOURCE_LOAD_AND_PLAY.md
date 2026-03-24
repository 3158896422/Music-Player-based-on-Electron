# 修复音源加载和播放问题

## 🐛 问题描述

### 问题 1: Axios 设置 Unsafe Headers 失败
```
Refused to set unsafe header "Referer"
Refused to set unsafe header "User-Agent"
```

**原因**: 在浏览器环境中，`Referer` 和 `User-Agent` 是禁止手动设置的"unsafe headers"。

### 问题 2: 音源脚本接口未就绪
```
获取播放 URL 失败：Error: 音源脚本接口未就绪
```

**原因**: `window.userApiRendererEvent` 没有被初始化，导致无法调用音源脚本获取 URL。

---

## ✅ 修复方案

### 1. 移除 Axios 的 Unsafe Headers

**文件**: [`src/musicSdk/tx/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/tx/index.js)

**修改前**:
```javascript
const headers = {
  'Referer': 'https://y.qq.com/portal/search.html',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const response = await axios.post(url, body, { headers });
```

**修改后**:
```javascript
const response = await axios.post(url, body);
```

**说明**: 移除手动设置的 headers，让 axios 自动处理。

---

### 2. 初始化 userApiRendererEvent

**文件**: [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js)

#### A. 导入并暴露到 window
```javascript
const userApiRendererEvent = require('./userApi/rendererEvent');
window.userApiRendererEvent = userApiRendererEvent;
```

#### B. 在 onMounted 中初始化
```javascript
onMounted(async () => {
  document.addEventListener('keydown', handleKeyDown);
  await loadSourcesFromStorage();
  
  // 初始化 userApiRendererEvent
  userApiRendererEvent.init();
  console.log('[app.js] userApiRendererEvent 已初始化');
});
```

---

### 3. 使用 userApiRendererEvent 加载音源

**文件**: [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js)

#### A. 修改 loadSourceScript 函数
```javascript
const loadSourceScript = async (source) => {
  try {
    // 如果点击的是当前已加载的音源，直接打开搜索界面
    if (currentSourceId.value === source.id && sourceManager.isSourceReady()) {
      currentView.value = 'sourceSearch';
      return;
    }

    // 使用 userApiRendererEvent 加载音源
    await userApiRendererEvent.loadApi(source.id, source);
    
    // 更新 sourceManager 状态
    sourceManager.currentSource = source;
    sourceManager.isReady = true;
    currentSourceId.value = source.id;
    
    // 打开搜索界面
    currentView.value = 'sourceSearch';
  } catch (error) {
    showAlert('加载音源失败：' + error.message);
  }
};
```

#### B. 修改 importSource 函数
```javascript
// 自动加载刚导入的音源
try {
  // 使用 userApiRendererEvent 加载音源
  await userApiRendererEvent.loadApi(sourceInfo.id, sourceInfo);
  
  // 更新 sourceManager 状态
  sourceManager.currentSource = sourceInfo;
  sourceManager.isReady = true;
  currentSourceId.value = sourceInfo.id;
  
  showAlert('音源导入并加载成功：' + sourceInfo.name);
} catch (error) {
  showAlert('音源导入成功，但加载失败：' + error.message);
}
```

---

## 🔄 完整工作流程

### 1. 应用启动
```
应用启动
    ↓
onMounted 执行
    ↓
加载已存储的音源列表
    ↓
初始化 userApiRendererEvent
    ↓
userApiRendererEvent.init() 注册 IPC 处理器
    ↓
等待用户操作
```

### 2. 导入音源
```
用户导入音源文件
    ↓
读取文件内容
    ↓
解析音源信息
    ↓
存储到 localStorage
    ↓
注册到 main.js (importedSourcesMap)
    ↓
调用 userApiRendererEvent.loadApi()
    ↓
userApiRendererEvent 调用 userApiMain.createWindow()
    ↓
创建音源窗口，注入 preload 脚本
    ↓
preload 脚本设置 global.lx
    ↓
音源脚本调用 lx.on('request', handler)
    ↓
更新 sourceManager 状态
    ↓
音源就绪，可以播放
```

### 3. 播放歌曲
```
用户点击播放
    ↓
检查歌曲是否有 URL
    ↓
没有 URL → 调用 sourceManager.request()
    ↓
sourceManager 检查 isReady
    ↓
调用 window.userApiRendererEvent.request()
    ↓
userApiRendererEvent 发送请求到音源窗口
    ↓
音源窗口调用 events.request()
    ↓
音源脚本处理请求，返回 URL
    ↓
URL 传递回 app.js
    ↓
开始播放
```

---

## 📝 关键代码对比

### 洛雪播放器的实现

**renderer/utils/musicSdk/api-source.js**:
```javascript
const getMusicUrl = (source, musicInfo, quality) => {
  return new Promise((resolve, reject) => {
    const api = apis(source);
    api.on(api.EVENT_NAMES.request, {
      source,
      action: 'musicUrl',
      info: {
        type: quality,
        musicInfo,
      },
    }, (data) => {
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.data);
      }
    });
  });
};
```

**关键点**:
1. 使用 `api.on()` 注册一次性事件监听器
2. 发送请求到音源脚本
3. 通过回调函数接收结果

### 我们的实现

**sourceManager.js**:
```javascript
async request(source, action, info) {
  if (!this.isReady) {
    throw new Error('音源脚本未加载');
  }

  // 通过 window.userApiRendererEvent 调用音源脚本
  if (!window.userApiRendererEvent || !window.userApiRendererEvent.request) {
    throw new Error('音源脚本接口未就绪');
  }

  const requestKey = `${action}_${Date.now()}_${source}`;
  const requestData = { source, action, info };

  const result = await window.userApiRendererEvent.request({
    requestKey,
    data: requestData
  });
  
  return result;
}
```

**关键点**:
1. 使用 `window.userApiRendererEvent.request()` 发送请求
2. 通过 Promise 接收结果
3. 使用 requestKey 标识请求

---

## ✅ 修复结果

- ✅ 不再出现 `Refused to set unsafe header` 错误
- ✅ 搜索功能正常工作
- ✅ `window.userApiRendererEvent` 正确初始化
- ✅ 音源脚本可以正常加载
- ✅ 播放和下载可以正常获取 URL
- ✅ 音源切换功能正常

---

## 🎯 与洛雪的区别

| 特性 | 洛雪播放器 | 我们的实现 |
|------|-----------|-----------|
| 事件注册 | `api.on(EVENT_NAMES.request, handler)` | `userApiRendererEvent.request()` |
| 回调方式 | 事件监听器 + 回调 | Promise |
| 初始化 | `api.init()` | `userApiRendererEvent.init()` |
| 加载音源 | `api.load()` | `userApiRendererEvent.loadApi()` |

**说明**: 我们的实现更简洁，使用 Promise 而非事件监听器，代码更易维护。

---

## 📚 相关文件

- [`app.js`](./app.js) - 主应用逻辑
- [`userApi/rendererEvent.js`](./userApi/rendererEvent.js) - 音源事件处理
- [`userApi/main.js`](./userApi/main.js) - 音源窗口管理
- [`userApi/renderer/search-preload.js`](./userApi/renderer/search-preload.js) - 音源 preload 脚本
- [`sourceManager.js`](./sourceManager.js) - 音源管理器

---

**修复日期**: 2026-03-22
**版本**: v3.0.2
**状态**: ✅ 已修复并测试
