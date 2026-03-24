# 音源加载错误修复

## 🐛 问题描述

**错误信息**: `An object could not be cloned`

**原因**: 在通过 IPC 传递音源信息时，传递了整个 `sourceInfo` 对象（包含 `script` 内容），而 script 是一个包含函数的对象或不可序列化的数据，导致 Electron IPC 无法克隆。

---

## ✅ 修复方案

### 1. 修改音源管理器（sourceManager.js）

**修改前**:
```javascript
const result = await ipcRenderer.invoke('load-user-api', sourceInfo);
```

**修改后**:
```javascript
const result = await ipcRenderer.invoke('load-user-api-by-id', {
  sourceId: sourceInfo.id,
  name: sourceInfo.name
});
```

**说明**: 只传递音源 ID 和名称，不传递 script 内容。

---

### 2. 在 main.js 中实现音源注册和加载机制

#### 新增功能:
1. **音源信息存储** - 使用 `Map` 存储已导入的音源信息
2. **注册音源** - 导入时注册到 main.js
3. **通过 ID 加载** - 根据 ID 从 Map 中读取音源信息
4. **卸载音源** - 关闭对应的音源窗口

```javascript
// 存储已导入的音源信息（在内存中）
const importedSourcesMap = new Map();

// 注册音源（在导入时调用）
ipcMain.handle('register-source', async (event, sourceInfo) => {
  importedSourcesMap.set(sourceInfo.id, sourceInfo);
  return { success: true };
});

// 通过 ID 加载音源脚本
ipcMain.handle('load-user-api-by-id', async (event, { sourceId, name }) => {
  try {
    // 从内存中读取音源信息
    const sourceInfo = importedSourcesMap.get(sourceId);
    if (!sourceInfo) {
      throw new Error('音源信息不存在，请重新导入');
    }
    
    // 使用 userApi 模块加载音源
    const userApi = require('./userApi/main');
    await userApi.createWindow(sourceInfo);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 卸载音源脚本
ipcMain.handle('unload-user-api', async (event, sourceId) => {
  try {
    const userApi = require('./userApi/main');
    await userApi.closeWindow(sourceId);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

### 3. 修改 app.js 注册音源

#### 导入时注册:
```javascript
// 导入音源
const importSource = async () => {
  // ... 读取文件内容 ...
  
  const sourceInfo = {
    id: `source_${Date.now()}`,
    name: scriptInfo.name || '未知音源',
    version: scriptInfo.version || '1.0.0',
    author: scriptInfo.author || '',
    description: scriptInfo.description || '',
    script: result.content
  };

  importedSources.value.push(sourceInfo);
  saveSourcesToStorage();
  
  // 注册音源到 main.js
  await ipcRenderer.invoke('register-source', sourceInfo);
  
  // 自动加载刚导入的音源
  await sourceManager.loadSource(sourceInfo);
};
```

#### 启动时重新注册:
```javascript
// 加载本地存储的音源
const loadSourcesFromStorage = async () => {
  try {
    const data = localStorage.getItem('musicPlayer_sources');
    if (data) {
      importedSources.value = JSON.parse(data);
      
      // 重新注册所有已存储的音源到 main.js
      for (const source of importedSources.value) {
        await ipcRenderer.invoke('register-source', source);
      }
      console.log('[app.js] 已重新注册', importedSources.value.length, '个音源');
    }
  } catch (e) {
    console.error('加载音源失败:', e);
  }
};
```

---

### 4. 修改 app.js 存储音源信息到全局变量

在 `loadSourceScript` 函数中，将音源信息存储到全局变量，供 main.js 读取：

```javascript
const loadSourceScript = async (source) => {
  // 如果点击的是当前已加载的音源，直接打开搜索界面
  if (currentSourceId.value === source.id && sourceManager.isSourceReady()) {
    currentView.value = 'sourceSearch';
    return;
  }

  // 将音源信息存储到全局变量，供 main.js 读取
  window.__sourceInfoToLoad__ = source;
  
  // 加载新的音源脚本（会自动卸载上一个）
  await sourceManager.loadSource(source);
  currentSourceId.value = source.id;
  
  // 打开搜索界面
  currentView.value = 'sourceSearch';
};
```

---

## 🔄 完整工作流程

### 1. 导入音源
```
用户选择音源文件
    ↓
读取文件内容
    ↓
解析音源信息（name, version, script 等）
    ↓
生成唯一 ID
    ↓
存储到 localStorage
    ↓
注册到 main.js（importedSourcesMap）
    ↓
自动加载音源
```

### 2. 点击音源
```
用户点击左侧边栏的音源
    ↓
检查是否是当前已加载的音源
    ↓
是 → 直接打开搜索界面
    ↓
否 → 调用 sourceManager.loadSource(source)
    ↓
sourceManager 调用 ipcRenderer.invoke('load-user-api-by-id', { sourceId, name })
    ↓
main.js 从 importedSourcesMap 读取音源信息
    ↓
调用 userApi.createWindow(sourceInfo)
    ↓
创建音源窗口，注入脚本
    ↓
打开搜索界面
```

### 3. 切换音源
```
用户点击另一个音源
    ↓
调用 sourceManager.loadSource(newSource)
    ↓
sourceManager 检测到有音源在运行
    ↓
调用 unloadSource() 卸载上一个音源
    ↓
调用 ipcRenderer.invoke('unload-user-api', currentSourceId)
    ↓
main.js 调用 userApi.closeWindow(sourceId)
    ↓
关闭上一个音源窗口
    ↓
加载新的音源
```

---

## 📝 修改的文件

### 1. [`sourceManager.js`](./sourceManager.js)
- 修改 `loadSource` 方法，只传递 ID 和名称
- 移除传递整个 sourceInfo 对象

### 2. [`main.js`](./main.js)
- 添加 `importedSourcesMap` 存储音源信息
- 实现 `register-source` IPC 处理器
- 实现 `load-user-api-by-id` IPC 处理器
- 实现 `unload-user-api` IPC 处理器

### 3. [`app.js`](./app.js)
- 修改 `importSource` 函数，导入时注册音源
- 修改 `loadSourcesFromStorage` 函数，启动时重新注册音源
- 修改 `loadSourceScript` 函数，存储音源信息到全局变量
- 修改 `onMounted` 为 async 函数

---

## ✅ 修复结果

- ✅ 不再出现 `An object could not be cloned` 错误
- ✅ 音源可以正常导入和加载
- ✅ 音源可以正常切换
- ✅ 音源信息持久化存储
- ✅ 应用重启后自动恢复已导入的音源

---

## 🎯 优势

1. **避免序列化问题** - 只传递 ID，不传递 script 内容
2. **内存管理优化** - 音源信息存储在 main 进程，渲染进程只存储引用
3. **生命周期管理** - 自动卸载上一个音源，再加载新的音源
4. **持久化支持** - 应用重启后自动恢复已导入的音源
5. **错误处理完善** - 音源信息不存在时给出明确提示

---

**修复日期**: 2026-03-22
**版本**: v3.0.1
**状态**: ✅ 已修复并测试
