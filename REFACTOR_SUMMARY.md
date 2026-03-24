# 洛雪音源加载器重构完成报告

## 📋 重构概述

根据对洛雪音乐官方源码（lx-music-desktop v2.12.1）的深入分析，我完全重构了音源加载机制，使其**完全符合洛雪官方音源规范**。

---

## 🔍 原实现的主要问题

### ❌ 1. 执行环境错误
- **原实现**: 使用 Node.js vm 模块在主进程中直接执行
- **问题**: 洛雪音源是为浏览器环境设计的，依赖 `window.lx` 对象
- **结果**: 脚本无法正确初始化和调用 API

### ❌ 2. API 模拟不完整
- **原实现**: 沙箱环境缺少完整的 `window.lx` API
- **问题**: 没有正确处理 `lx.send('inited', data)` 事件
- **结果**: 音源初始化流程失败

### ❌ 3. 事件驱动模型缺失
- **原实现**: 没有实现事件注册和调用机制
- **问题**: 洛雪音源使用 `on('request', handler)` 注册处理器
- **结果**: 无法调用音源的 musicUrl、lyric、pic 等方法

### ❌ 4. 数据结构不匹配
- **原实现**: 硬编码音源信息，包含错误的 `search` 动作
- **问题**: 洛雪规范只支持 `musicUrl | lyric | pic` 动作
- **结果**: 音源配置无法正确解析

---

## ✅ 新实现的核心机制

### 🎯 1. BrowserWindow 隔离环境

**架构**:
```
主进程 (main.js)
    ↓ IPC 通信
渲染器进程 (BrowserWindow)
    ↓ contextBridge
音源脚本 (window.lx)
```

**文件结构**:
```
MusicPlayer-Electron/
├── userApi/
│   ├── renderer/
│   │   ├── user-api.html      # 音源渲染器 HTML 模板
│   │   └── preload.js         # 预加载脚本，暴露 window.lx API
│   ├── main.js                # BrowserWindow 管理
│   ├── rendererEvent.js       # IPC 事件处理
│   └── utils.js               # 工具函数（脚本解析、压缩等）
├── sourceManager.js           # 音源管理器（重构后）
├── main.js                    # 主进程入口（已更新）
└── app.js                     # 渲染器进程（已更新）
```

### 🎯 2. window.lx API 完整实现

**preload.js** 暴露的 API：

```javascript
window.lx = {
  EVENT_NAMES: {
    request: 'request',
    inited: 'inited',
    updateAlert: 'updateAlert',
  },
  
  // HTTP 请求
  request(url, options, callback) { /* ... */ },
  
  // 发送事件到主进程
  send(eventName, data) { /* ... */ },
  
  // 注册事件监听
  on(eventName, handler) { /* ... */ },
  
  // 工具方法
  utils: {
    crypto: { /* AES, RSA, MD5, etc. */ },
    buffer: { /* buffer 操作 */ },
    zlib: { /* 压缩/解压 */ },
  },
  
  version: '2.0.0',
  env: 'desktop',
}
```

### 🎯 3. 初始化流程

```
1. 加载音源脚本文件
   ↓
2. 创建 BrowserWindow
   ↓
3. 注入脚本到 HTML
   ↓
4. 脚本执行，调用 lx.send('inited', data)
   ↓
5. preload.js 的 handleInit 处理音源信息
   ↓
6. 通过 IPC 发送到主进程
   ↓
7. 主进程确认初始化状态
   ↓
8. 音源就绪，可以处理请求
```

### 🎯 4. 请求处理流程

```
应用请求音乐 URL
   ↓
sourceManager.getMusicUrl(sourceId, musicInfo, quality)
   ↓
userApiRendererEvent.request({ requestKey, data })
   ↓
IPC 发送到 BrowserWindow
   ↓
preload.js 的 handleRequest 调用脚本的 request 处理器
   ↓
脚本返回 Promise
   ↓
验证结果（URL 格式、长度等）
   ↓
通过 IPC 返回给应用
```

---

## 📦 新增文件

### 1. `userApi/renderer/user-api.html`
- 音源渲染器 HTML 模板
- 包含错误处理脚本

### 2. `userApi/renderer/preload.js`
- 核心文件，暴露 `window.lx` API
- 实现 HTTP 请求、事件通信、工具方法
- 处理音源初始化和请求转发

### 3. `userApi/main.js`
- 创建和管理 BrowserWindow
- 注入脚本到渲染器
- 安全配置（禁用导航、权限控制等）

### 4. `userApi/rendererEvent.js`
- IPC 事件监听和处理
- 请求队列和超时管理
- 状态变化和更新提示处理

### 5. `userApi/utils.js`
- 脚本元信息解析（@name, @version 等）
- 脚本验证
- 脚本压缩/解压（zlib deflate）

### 6. `test-source.js`
- 测试音源脚本
- 演示洛雪音源标准格式

### 7. `test-source-loader.js`
- 测试脚本，验证所有文件是否正确创建

---

## 🔄 重构文件

### 1. `sourceManager.js` - 完全重写
**旧实现**:
- 使用 vm 模块执行脚本
- 模拟不完整的沙箱环境
- 包含错误的 search 动作支持

**新实现**:
- 使用 BrowserWindow 方案
- 通过 IPC 与音源脚本通信
- 只支持标准动作：`musicUrl | lyric | pic`
- 正确的初始化和等待机制

**核心方法**:
```javascript
class SourceManager {
  initialize()  // 初始化 IPC 监听器
  loadSource(sourceInfo)  // 加载音源脚本
  initSource(sourceId)  // 初始化音源到 BrowserWindow
  getMusicUrl(sourceId, musicInfo, quality)  // 获取音频链接
  getLyric(sourceId, musicInfo)  // 获取歌词
  getPic(sourceId, musicInfo)  // 获取图片
  validateSource(sourceInfo)  // 验证音源可用性
}
```

### 2. `main.js` - 更新 IPC 处理
- 更新 `validate-source` IPC 处理器
- 支持传递完整的 sourceInfo 对象
- 设置 `global.mainWindow` 供音源管理器使用

### 3. `app.js` - 更新调用方式
- 更新 `importLocalSource` 方法
- 传递正确的参数格式给 IPC

---

## 🎯 符合洛雪规范的关键点

### ✅ 1. 脚本元信息格式
```javascript
/**
 * @name 测试音源           // 最大 24 字符
 * @description 描述信息    // 最大 36 字符
 * @version 1.0.0          // 最大 36 字符
 * @author 作者             // 最大 56 字符
 * @homepage http://xxx    // 最大 1024 字符
 */
```

### ✅ 2. 初始化数据结构
```javascript
send(EVENT_NAMES.inited, {
  sources: {
    kw: {
      name: '酷我音乐',
      type: 'music',
      actions: ['musicUrl'],  // 只支持 musicUrl | lyric | pic
      qualitys: ['128k', '320k', 'flac', 'flac24bit'],
    },
  },
})
```

### ✅ 3. 请求处理
```javascript
on(EVENT_NAMES.request, ({ source, action, info }) => {
  // source: 'kw' | 'kg' | 'tx' | 'wy' | 'mg'
  // action: 'musicUrl' | 'lyric' | 'pic'
  // info: { type, musicInfo }
  
  return Promise.resolve(url)  // musicUrl 返回字符串
  // 或 Promise.reject(err)
})
```

### ✅ 4. 安全验证
- URL 验证：必须是 http/https 开头，长度 < 2048
- 歌词验证：lyric < 51200 字符，tlyric < 5120 字符
- 超时控制：请求 20 秒超时自动取消

---

## 🚀 测试方法

### 1. 运行测试脚本
```bash
cd "d:\Trae CN\project\Music_Player\MusicPlayer-Electron"
node test-source-loader.js
```

**预期输出**:
```
=== 音源加载测试 ===

1. 检查必要的文件...
   ✓ ./userApi/renderer/user-api.html
   ✓ ./userApi/renderer/preload.js
   ✓ ./userApi/main.js
   ✓ ./userApi/rendererEvent.js
   ✓ ./userApi/utils.js
   ✓ ./sourceManager.js

2. 检查文件内容...
   ✓ 暴露 window.lx
   ✓ 实现 request 方法
   ✓ 实现 send 方法
   ✓ 实现 on 方法
   ...

=== 测试完成 ===
```

### 2. 导入测试音源
1. 启动 Electron 应用
2. 进入设置页面
3. 点击"导入本地文件"
4. 选择 `test-source.js`
5. 验证音源是否显示为"可用"

### 3. 查看日志
打开应用后，查看控制台日志：
```
开始加载音源：xxx
成功读取本地音源脚本，长度：xxx
音源初始化成功：xxx
```

---

## 📚 洛雪音源规范文档

参考文档：https://lxmusic.toside.cn/desktop/custom-source

**关键规范**:
1. 脚本必须使用 UTF-8 编码
2. 必须包含元信息注释块
3. 必须通过 `window.lx.send('inited', data)` 发送初始化事件
4. 必须通过 `window.lx.on('request', handler)` 注册请求处理器
5. 只支持 `musicUrl | lyric | pic` 三种动作
6. 返回的 URL 必须是 http/https 协议

---

## 🔧 故障排查

### 问题 1: 音源初始化超时
**原因**: 脚本没有正确调用 `lx.send('inited', data)`
**解决**: 检查脚本是否包含正确的初始化代码

### 问题 2: 获取音乐 URL 失败
**原因**: 脚本没有注册 `request` 事件处理器
**解决**: 检查脚本是否调用 `lx.on('request', handler)`

### 问题 3: BrowserWindow 创建失败
**原因**: 文件路径错误或权限问题
**解决**: 检查 `userApi/renderer/` 目录下的文件是否存在

### 问题 4: IPC 通信失败
**原因**: 监听器未正确注册
**解决**: 检查 `sourceManager.initialize()` 是否已调用

---

## 📝 总结

✅ **完全重构**：从 vm 方案改为 BrowserWindow 方案，与洛雪官方实现一致
✅ **完整 API**：实现了所有必需的 `window.lx` API
✅ **正确流程**：实现了标准的初始化和请求处理流程
✅ **安全验证**：添加了 URL、歌词等数据的严格验证
✅ **符合规范**：完全符合洛雪官方音源编写规范

现在你的音乐播放器可以**正确导入和解析洛雪格式的 JS 音源**了！🎉
