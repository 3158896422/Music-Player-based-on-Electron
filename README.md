<div align="center">

# Music Player

**Apple Music 风格的跨平台本地音乐播放器**，基于 Electron + Vue 3 构建。

支持本地音乐管理、多平台在线音乐搜索播放、FLAC 无损元数据编辑、桌面歌词等丰富功能。

[![Electron](https://img.shields.io/badge/Electron-28.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.x-42B883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2.0-orange.svg)](https://github.com/3158896422/Music-Player-based-on-Electron/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

</div>

---

## 功能特性

| 功能 | 说明 |
| --- | --- |
| **本地音乐库** | 导入本地文件夹，自动扫描并读取 FLAC / MP3 / Ogg 元数据（标题、艺术家、专辑、封面、歌词） |
| **在线音乐** | 聚合多平台音源，在线搜索、试听、播放，支持 128k / 320k / FLAC 音质 |
| **推荐歌单** | 内置推荐歌单，一键发现好音乐 |
| **桌面歌词** | 独立桌面歌词窗口，可自由拖动、固定，支持 4K 高 DPI 缩放 |
| **音乐下载** | 支持将在线音乐下载为无损 FLAC 格式 |
| **元数据编辑** | 读写 FLAC / MP3 标签，嵌入封面图片与歌词 |
| **播放列表** | 我喜欢的、最近播放、自定义歌单，右键菜单管理 |
| **专辑 / 艺术家** | 按专辑、艺术家维度浏览本地音乐库 |
| **播放控制** | 顺序 / 随机 / 单曲循环播放模式，音量调节 |
| **界面主题** | 深色 / 浅色主题一键切换 |
| **系统托盘** | 支持托盘常驻、全局快捷键 |

## 支持的音乐平台

| 平台 | 标识 | 音质 |
| --- | --- | --- |
| QQ 音乐 | `tx` | 128k / 320k / FLAC |
| 网易云音乐 | `wy` | 128k / 320k / FLAC |
| 酷狗音乐 | `kg` | 128k / 320k / FLAC |

> 音源以插件形式动态加载（`MusicApi/`、`default-sources/`），可自行替换或新增音源插件。

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18 及以上版本
- Windows / macOS / Linux 桌面系统

### 方式一：一键启动（推荐）

```bash
git clone https://github.com/3158896422/Music-Player-based-on-Electron.git
cd Music-Player-based-on-Electron
start.bat
```

双击 `start.bat` 即可自动完成依赖安装（使用国内镜像加速）并启动应用。

### 方式二：手动安装运行

```bash
git clone https://github.com/3158896422/Music-Player-based-on-Electron.git
cd Music-Player-based-on-Electron

# 安装依赖（国内用户可加 --registry=https://registry.npmmirror.com）
npm install

# 启动应用
npm start
```

### 构建安装包

```bash
npm run build:win    # Windows 安装包
npm run build:mac    # macOS 安装包
npm run build:linux  # Linux 安装包
```

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 桌面框架 | Electron 28 |
| 前端框架 | Vue 3 |
| 状态管理 | Pinia |
| 音频元数据 | music-metadata、node-id3、node-taglib-sharp |
| 网络请求 | axios、needle、NeteaseCloudMusicApi |
| 构建打包 | electron-builder |

## 项目结构

```
Music-Player-based-on-Electron/
├── main.js                  # Electron 主进程（窗口、托盘、IPC）
├── app.js                   # 渲染进程逻辑（播放、音乐库、在线音乐）
├── renderer.js              # 渲染进程入口
├── sourceManager.js         # 音源插件管理器
├── desktop-lyric.js         # 桌面歌词窗口
├── index.html               # 主界面
├── styles.css               # 样式
├── start.bat                # 一键启动脚本
├── build.bat                # 构建脚本
├── src/
│   ├── musicSdk/            # 各平台音乐 SDK（kg / tx / wy）
│   └── musicMeta/           # FLAC / MP3 元数据读写与下载
├── userApi/                 # 用户音源 API 框架
├── MusicApi/                # 音源插件
├── default-sources/         # 默认音源
└── sources/                 # 内置音源
```

## 免责声明

本项目仅供技术学习和交流使用。在线音乐功能依赖第三方音源插件，请尊重各音乐平台的版权，遵守相关法律法规与平台服务条款，勿将本项目用于商业用途。

## 许可证

[MIT](LICENSE)
