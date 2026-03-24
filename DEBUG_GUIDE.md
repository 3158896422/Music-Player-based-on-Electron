# 音源导入调试指南

## 问题诊断步骤

### 1. 启动应用并查看控制台日志

启动 Electron 应用后，打开开发者工具查看主进程控制台日志。

### 2. 导入音源文件

在设置页面导入本地音源文件（如 `test-source.js`）

### 3. 查看日志输出

应该看到以下日志序列：

```
开始初始化音源：xxx
脚本信息解析成功：{ name: 'xxx', version: '1.0.0', ... }
加载音源 API 到 BrowserWindow：xxx
开始创建音源 BrowserWindow：xxx
读取 user-api.html
创建 BrowserWindow，preload：xxx
加载 HTML 并注入脚本
HTML 加载完成
BrowserWindow ready-to-show，发送初始化环境
收到 user-api-init 事件：{ status: true, message: undefined, data: {...} }
发送状态变化：{ status: true, apiInfo: {...} }
收到音源状态变化：{ status: true, apiInfo: {...} }
音源初始化成功：xxx
```

### 4. 常见错误及解决方案

#### 错误 1：global.mainWindow 未设置
**现象**: 控制台显示 `global.mainWindow 未设置!`
**解决**: 检查 main.js 中是否正确设置了 `global.mainWindow = mainWindow`

#### 错误 2：文件不存在
**现象**: `ENOENT: no such file or directory, open '...\user-api.html'`
**解决**: 检查 `userApi/renderer/` 目录下文件是否存在

#### 错误 3：初始化超时
**现象**: `初始化超时`
**原因**: 音源脚本没有调用 `lx.send('inited', data)`
**解决**: 检查音源脚本是否正确实现了初始化

#### 错误 4：脚本解析失败
**现象**: `无效的自定义源文件`
**原因**: 脚本缺少元信息注释块
**解决**: 确保脚本包含 `/** ... */` 格式的注释

### 5. 手动测试 test-source.js

使用提供的测试音源文件进行测试：

```javascript
/**
 * @name 测试音源
 * @description 用于测试洛雪音源加载功能
 * @version 1.0.0
 * @author Test
 */

const { EVENT_NAMES, request, on, send } = window.lx

const sources = {
  kw: {
    name: '测试酷我音乐',
    type: 'music',
    actions: ['musicUrl'],
    qualitys: ['128k', '320k'],
  }
}

on(EVENT_NAMES.request, ({ source, action, info }) => {
  console.log('收到请求:', source, action, info)
  
  return new Promise((resolve, reject) => {
    if (action === 'musicUrl') {
      resolve('https://test.example.com/music.mp3')
    } else {
      reject(new Error('不支持的操作'))
    }
  })
})

send(EVENT_NAMES.inited, {
  sources: sources,
})

console.log('测试音源已初始化')
```

### 6. 检查 IPC 通信

在渲染器进程（app.js）的控制台中输入：

```javascript
// 检查是否能接收到状态变化
const { ipcRenderer } = require('electron')
ipcRenderer.on('user-api-status-change', (event, data) => {
  console.log('收到状态变化:', data)
})
```

### 7. 验证 BrowserWindow 创建

检查是否成功创建了 BrowserWindow：

```javascript
// 在主进程控制台
console.log('BrowserWindow:', browserWindow)
```

## 预期行为

1. 导入音源文件后，应该显示"验证中..."
2. 几秒钟后，状态变为"可用"
3. 控制台显示"音源初始化成功"
4. 搜索歌曲时可以正常使用音源

## 仍然失败？

如果按照以上步骤仍然失败，请提供：

1. 完整的控制台日志
2. 导入的音源文件内容
3. 错误截图
