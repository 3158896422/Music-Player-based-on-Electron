# 重构总结 - 音源脚本集成

## ✅ 完成的功能

### 1. 使用 NeteaseCloudMusicApi 替换网易云音乐 API
- ✅ 安装 `NeteaseCloudMusicApi` npm 包
- ✅ 修改 [`src/musicSdk/wy/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/wy/index.js) 使用官方 API
- ✅ 移除网易云音乐内置 URL 获取功能
- ✅ 保留搜索和歌词功能

### 2. 移除酷我音乐
- ✅ 删除 [`src/musicSdk/kw/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/kw/index.js)
- ✅ 从 SDK 入口移除酷我音乐引用
- ✅ 更新支持的音源列表

### 3. 移除内置获取 URL 的 SDK
- ✅ 移除 [`src/musicSdk/tx/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/tx/index.js) 的 `getMusicUrl` 函数
- ✅ 移除 [`src/musicSdk/kg/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/kg/index.js) 的 `getMusicUrl` 函数
- ✅ 移除 [`src/musicSdk/wy/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/wy/index.js) 的 `getMusicUrl` 函数
- ✅ 从 [`src/musicSdk/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/index.js) 移除 `getMusicUrl` 导出
- ✅ 保留搜索和歌词功能

### 4. 修改播放和下载逻辑
- ✅ 修改 [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js) 的 `downloadSourceSong` 函数
- ✅ 修改 [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js) 的 `playSourceSong` 函数
- ✅ 修改 [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js) 的 `playBuiltinSong` 函数
- ✅ 强制通过音源脚本获取 URL
- ✅ 移除内置 SDK 回退逻辑
- ✅ 在 requestKey 中加入平台标识

---

## 🎯 新的工作流程

### 搜索流程
```
用户输入搜索关键词
    ↓
调用 musicSdk.searchMusic(keyword, page, limit, source)
    ↓
使用官方 API 搜索（QQ/网易云/酷狗）
    ↓
返回完整的歌曲信息
    ↓
显示在搜索结果列表中
```

### 播放流程（必须通过音源脚本）
```
用户点击播放
    ↓
检查歌曲是否有 URL
    ↓
没有 URL？
    ↓
调用音源脚本获取 URL
   - 发送请求：{ source, action: 'musicUrl', info: { type, musicInfo } }
    ↓
音源脚本返回 URL
    ↓
获取到 URL，开始播放
```

### 下载流程（必须通过音源脚本）
```
用户点击下载
    ↓
检查歌曲是否有 URL
    ↓
没有 URL？
    ↓
调用音源脚本获取 URL
   - 发送请求：{ source, action: 'musicUrl', info: { type, musicInfo } }
    ↓
音源脚本返回 URL
    ↓
获取到 URL，开始下载
```

---

## 📝 修改的文件

### 1. [`src/musicSdk/wy/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/wy/index.js)
**修改内容**:
- 使用 `NeteaseCloudMusicApi` 进行搜索
- 使用 `NeteaseCloudMusicApi` 获取歌词
- 移除 `getMusicUrl` 函数

**关键代码**:
```javascript
// 使用 NeteaseCloudMusicApi 搜索
const cloudMusicApi = require('NeteaseCloudMusicApi');
const result = await cloudMusicApi.search({
  keywords: keyword,
  page: page,
  limit: limit,
  type: 1
});
```

### 2. [`src/musicSdk/tx/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/tx/index.js)
**修改内容**:
- 移除 `getMusicUrl` 函数
- 保留搜索和歌词功能

### 3. [`src/musicSdk/kg/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/kg/index.js)
**修改内容**:
- 移除 `getMusicUrl` 函数
- 保留搜索和歌词功能

### 4. [`src/musicSdk/index.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicSdk/index.js)
**修改内容**:
- 移除酷我音乐引用
- 移除 `getMusicUrl` 函数
- 更新支持的音源列表

**新的音源列表**:
```javascript
const sources = [
  { name: '酷狗音乐', id: 'kg' },
  { name: 'QQ 音乐', id: 'tx' },
  { name: '网易云音乐', id: 'wy' }
];
```

### 5. [`app.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/app.js)
**修改内容**:
- `downloadSourceSong`: 强制通过音源脚本获取 URL
- `playSourceSong`: 强制通过音源脚本获取 URL
- `playBuiltinSong`: 强制通过音源脚本获取 URL

**关键代码**:
```javascript
// 必须通过音源脚本获取 URL
if (!song.url && song.source) {
  try {
    if (window.userApiRendererEvent && window.userApiRendererEvent.request) {
      const urlData = await window.userApiRendererEvent.request({
        requestKey: `play_${Date.now()}_${song.source}`,
        data: {
          source: song.source,
          action: 'musicUrl',
          info: {
            type: '128k',
            musicInfo: song
          }
        }
      });
      song.url = urlData;
    } else {
      throw new Error('音源脚本未加载，无法获取播放 URL');
    }
  } catch (error) {
    showAlert('无法播放：获取音频 URL 失败 - ' + error.message);
    return;
  }
}
```

---

## 🔧 传递给音源脚本的参数格式

```javascript
{
  source: 'tx',  // 平台标识：tx, wy, kg
  action: 'musicUrl',
  info: {
    type: '128k',  // 音质：128k, 320k, flac, flac24bit
    musicInfo: {   // 完整的歌曲信息
      id: '歌曲 ID',
      songmid: 'QQ 音乐 MID',
      hash: '酷狗音乐 Hash',
      title: '歌曲名',
      artist: '歌手',
      album: '专辑名',
      duration: '时长',
      source: '平台标识',
      cover: '封面 URL'
    }
  }
}
```

---

## 📊 支持的音源平台

| 平台 | 标识 | 搜索 API | URL 获取 |
|------|------|---------|---------|
| QQ 音乐 | tx | 官方 API | 音源脚本 |
| 网易云音乐 | wy | NeteaseCloudMusicApi | 音源脚本 |
| 酷狗音乐 | kg | 官方 API | 音源脚本 |

---

## ⚠️ 重要注意事项

### 1. 必须导入自定义音源脚本
- 播放和下载功能**完全依赖**自定义音源脚本
- 如果没有导入音源脚本，会显示错误："音源脚本未加载，无法获取播放 URL"

### 2. 音源脚本必须实现 musicUrl action
```javascript
on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action === 'musicUrl') {
    const url = await getMusicUrl(info.musicInfo, info.type);
    return url;  // 返回字符串
  }
});
```

### 3. 音源脚本会收到完整的歌曲信息
- 包含歌曲 ID、songmid、hash 等平台特定标识
- 包含标题、歌手、专辑等元数据
- 包含封面 URL

### 4. 音源脚本必须返回 URL 字符串
- 返回格式：`'https://example.com/music.mp3'`
- 必须是 http/https 协议
- 不能返回对象或其他格式

---

## 🎵 测试流程

### 1. 测试搜索功能
```bash
node test-search-integration.js
```
测试各平台搜索功能是否正常

### 2. 测试参数传递
```bash
node test-userapi-url.js
```
测试传递给音源脚本的参数格式

### 3. 实际使用测试
1. 启动应用：`npm start`
2. 导入自定义音源脚本
3. 搜索歌曲
4. 点击播放或下载
5. 检查控制台日志和音源脚本日志

---

## 📚 相关文档

- [NeteaseCloudMusicApi 文档](https://www.npmjs.com/package/NeteaseCloudMusicApi)
- [QQ 音乐 API 文档](https://sansenjian.github.io/qq-music-api/api/music.html)
- [酷狗音乐 API 文档](https://gitee.com/guoqianqiang/cool-dog-music-api/)
- [洛雪音乐自定义音源规范](https://lxmusic.toside.cn/desktop/custom-source)

---

## 🚀 下一步优化建议

1. **增加音质选项**：支持 320k、flac、flac24bit 等更高音质
2. **优化歌词显示**：实现逐字歌词、翻译歌词
3. **添加收藏功能**：支持本地收藏和歌单管理
4. **提高 API 稳定性**：增加重试机制和备用 API
5. **完善错误提示**：区分音源脚本错误和网络错误

---

**重构日期**: 2026-03-22
**版本**: v2.0.0
**状态**: ✅ 已完成并测试
