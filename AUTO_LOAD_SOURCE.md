# 音源自动加载功能说明

## 🎯 功能概述

实现了音源脚本的**自动加载**和**智能切换**功能：

1. **点击音源自动加载** - 点击左侧边栏的音源时，自动加载该音源脚本
2. **切换音源自动卸载** - 切换到另一个音源时，自动卸载上一个音源脚本
3. **单次加载一个音源** - 每次只允许加载一个音源脚本，避免冲突
4. **导入后自动加载** - 导入新音源后，自动加载该音源

---

## 📋 工作流程

### 1. 点击音源（例如：念心音源）

```
用户点击左侧边栏的"念心音源"
    ↓
调用 openSourceSearch(source)
    ↓
调用 loadSourceScript(source)
    ↓
检查是否是当前已加载的音源
    ↓
是 → 直接打开搜索界面
    ↓
否 → 调用 sourceManager.loadSource(source)
    ↓
sourceManager 检查是否有音源在运行
    ↓
有 → 先调用 unloadSource() 卸载上一个音源
    ↓
加载新的音源脚本
    ↓
打开搜索界面
```

### 2. 切换到另一个音源（例如：全豆要音源）

```
用户点击"全豆要音源"
    ↓
调用 loadSourceScript(source)
    ↓
检测到与当前音源不同
    ↓
调用 sourceManager.unloadSource() 卸载念心音源
    ↓
调用 sourceManager.loadSource() 加载全豆要音源
    ↓
打开搜索界面
```

### 3. 播放/下载歌曲

```
用户点击播放/下载
    ↓
检查歌曲是否有 URL
    ↓
没有 URL → 调用 sourceManager.request()
    ↓
sourceManager 检查音源是否就绪
    ↓
就绪 → 通过 window.userApiRendererEvent 调用音源脚本
    ↓
音源脚本返回 URL
    ↓
开始播放/下载
```

---

## 🔧 核心代码

### 1. SourceManager 类（sourceManager.js）

```javascript
class SourceManager {
  constructor() {
    this.currentSource = null;
    this.isReady = false;
  }

  // 加载音源脚本
  async loadSource(sourceInfo) {
    // 如果已有音源在运行，先卸载
    if (this.currentSource) {
      await this.unloadSource();
    }

    // 通过 IPC 加载音源脚本
    const result = await ipcRenderer.invoke('load-user-api', sourceInfo);
    
    if (result.success) {
      this.currentSource = sourceInfo;
      this.isReady = true;
      return true;
    }
  }

  // 卸载当前音源
  async unloadSource() {
    if (!this.currentSource) return;

    // 通过 IPC 卸载音源脚本
    await ipcRenderer.invoke('unload-user-api', this.currentSource.id);
    
    this.currentSource = null;
    this.isReady = false;
  }

  // 请求音源脚本获取 URL
  async request(source, action, info) {
    if (!this.isReady) {
      throw new Error('音源脚本未加载');
    }

    // 通过 window.userApiRendererEvent 调用音源脚本
    const result = await window.userApiRendererEvent.request({
      requestKey: `${action}_${Date.now()}_${source}`,
      data: { source, action, info }
    });
    
    return result;
  }
}
```

### 2. app.js 中的加载逻辑

```javascript
// 加载音源脚本（用于切换音源）
const loadSourceScript = async (source) => {
  try {
    // 如果点击的是当前已加载的音源，直接打开搜索界面
    if (currentSourceId.value === source.id && sourceManager.isSourceReady()) {
      currentView.value = 'sourceSearch';
      searchQuery.value = '';
      sourceSearchResults.value = [];
      return;
    }

    // 加载新的音源脚本（会自动卸载上一个）
    await sourceManager.loadSource(source);
    currentSourceId.value = source.id;
    
    // 打开搜索界面
    currentView.value = 'sourceSearch';
    searchQuery.value = '';
    sourceSearchResults.value = [];
    
    console.log('[app.js] 音源切换成功:', source.name);
  } catch (error) {
    console.error('[app.js] 加载音源失败:', error.message);
    showAlert('加载音源失败：' + error.message);
  }
};

// 打开音源搜索（点击音源时调用）
const openSourceSearch = async (source) => {
  await loadSourceScript(source);
};
```

### 3. 播放和下载函数

```javascript
// 播放音源歌曲
const playSourceSong = async (song) => {
  if (!song.url && song.source) {
    try {
      // 使用 sourceManager 请求音源脚本获取 URL
      const urlData = await sourceManager.request(song.source, 'musicUrl', {
        type: '128k',
        musicInfo: song
      });
      song.url = urlData;
    } catch (error) {
      showAlert('无法播放：获取音频 URL 失败 - ' + error.message);
      return;
    }
  }
  // ... 播放逻辑
};

// 下载音源歌曲
const downloadSourceSong = async (song) => {
  if (!song.url && song.source) {
    try {
      // 使用 sourceManager 请求音源脚本获取 URL
      const urlData = await sourceManager.request(song.source, 'musicUrl', {
        type: '128k',
        musicInfo: song
      });
      song.url = urlData;
    } catch (error) {
      showAlert('无法下载：获取音频 URL 失败 - ' + error.message);
      return;
    }
  }
  // ... 下载逻辑
};
```

---

## ✅ 使用方式

### 1. 导入音源
1. 进入设置页面
2. 点击"选择文件"按钮
3. 选择音源脚本文件（.js）
4. 导入成功后会**自动加载**该音源

### 2. 切换音源
1. 点击左侧边栏的音源名称
2. 系统会**自动卸载**上一个音源
3. **自动加载**当前点击的音源
4. 打开搜索界面

### 3. 播放/下载
- 点击搜索结果中的歌曲即可播放
- 系统会**自动调用**当前加载的音源脚本获取 URL
- 无需手动操作

---

## 📊 状态管理

### SourceManager 状态

| 状态 | 说明 |
|------|------|
| `currentSource` | 当前加载的音源信息 |
| `isReady` | 音源脚本是否就绪 |

### app.js 状态

| 状态 | 说明 |
|------|------|
| `importedSources` | 已导入的音源列表 |
| `currentSourceId` | 当前选中的音源 ID |
| `sourceSearchResults` | 当前音源的搜索结果 |

---

## ⚠️ 注意事项

### 1. 音源脚本要求
音源脚本必须符合洛雪音乐自定义音源规范：
- 实现 `musicUrl` action
- 通过 `window.lx.on('request', handler)` 注册处理器
- 通过 `window.lx.send('inited', data)` 发送初始化事件

### 2. 平台支持
音源脚本必须声明支持的平台：
```javascript
send(EVENT_NAMES.inited, {
  sources: {
    tx: { name: 'QQ 音乐', type: 'music', actions: ['musicUrl'] },
    wy: { name: '网易云', type: 'music', actions: ['musicUrl'] },
    kg: { name: '酷狗', type: 'music', actions: ['musicUrl'] }
  }
});
```

### 3. 错误处理
- 如果音源脚本未加载，会显示"音源脚本未加载"错误
- 如果音源脚本不支持某平台，会显示"当前音源不支持 xx 平台"
- 如果获取 URL 失败，会显示具体的错误信息

---

## 🚀 优势

1. **自动化** - 无需手动加载/卸载音源
2. **智能切换** - 自动管理音源脚本的生命周期
3. **资源优化** - 每次只加载一个音源，节省内存
4. **用户友好** - 点击即用，操作简单
5. **错误处理** - 完善的错误提示和回退机制

---

## 📝 相关文件

- [`sourceManager.js`](./sourceManager.js) - 音源管理器核心
- [`app.js`](./app.js) - 前端逻辑
- [`userApi/rendererEvent.js`](./userApi/rendererEvent.js) - 音源脚本通信
- [`userApi/main.js`](./userApi/main.js) - 音源窗口管理

---

**更新时间**: 2026-03-22
**版本**: v3.0.0
**状态**: ✅ 已完成并测试
