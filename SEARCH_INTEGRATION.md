# 内置搜索 API 与音源脚本集成说明

## 📋 实现概述

本次更新实现了以下功能：
1. **使用官方 API 进行搜索**：通过 QQ、网易云、酷狗、酷我的官方 API 搜索歌曲
2. **完整的歌曲信息返回**：搜索结果包含歌曲 ID、歌手、专辑、封面等完整信息
3. **智能 URL 获取**：优先使用自定义音源脚本获取播放 URL，如果音源脚本不可用则回退到内置 SDK
4. **播放和下载集成**：播放和下载功能自动调用音源脚本获取 URL

---

## 🎯 工作流程

### 1. 搜索流程
```
用户输入搜索关键词
    ↓
调用 musicSdk.searchMusic(keyword, page, limit, source)
    ↓
使用官方 API 搜索（QQ/网易云/酷狗/酷我）
    ↓
返回完整的歌曲信息（包含 ID、歌手、专辑、封面等）
    ↓
显示在搜索结果列表中
```

### 2. 播放流程
```
用户点击播放
    ↓
检查歌曲是否有 URL
    ↓
如果没有 URL：
  1. 先尝试通过自定义音源脚本获取 URL
     - 发送请求：{ source, action: 'musicUrl', info: { type, musicInfo } }
  2. 如果音源脚本不可用，使用内置 SDK 获取 URL
    ↓
获取到 URL 后开始播放
```

### 3. 下载流程
```
用户点击下载
    ↓
检查歌曲是否有 URL
    ↓
如果没有 URL：
  1. 先尝试通过自定义音源脚本获取 URL
  2. 如果音源脚本不可用，使用内置 SDK 获取 URL
    ↓
使用获取到的 URL 进行下载
```

---

## 🔧 技术实现

### 1. 搜索 API（官方）

**QQ 音乐**:
```javascript
POST https://u.y.qq.com/cgi-bin/musicu.fcg
参数：
- comm: { ct: 19, cv: 1859, uin: 0 }
- req_1: { 
    method: 'DoSearchForQQMusicDesktop',
    module: 'music.search.SearchCgiService',
    param: { query, num_per_page, page_num, search_type: 0 }
  }
```

**网易云音乐**:
```javascript
GET https://apis.netstart.cn/music/search
参数：
- keywords: 搜索关键词
- page: 页码
- limit: 每页数量
- type: 1 (单曲)
```

**酷狗音乐**:
```javascript
GET http://mobilecdn.kugou.com/api/v3/search/song
参数：
- format: 'json'
- keyword: 搜索关键词
- page: 页码
- pagesize: 每页数量
- showtype: 1
```

**酷我音乐**:
```javascript
GET https://oiapi.net/api/Kuwo
参数：
- msg: 搜索关键词
- n: 1
- page: 页码
- limit: 每页数量
```

### 2. URL 获取（音源脚本优先）

**调用音源脚本**:
```javascript
window.userApiRendererEvent.request({
  requestKey: `play_${Date.now()}`,
  data: {
    source: 'tx',  // 平台标识
    action: 'musicUrl',
    info: {
      type: '128k',  // 音质
      musicInfo: {   // 完整的歌曲信息
        id, songmid, hash,
        title, artist, album,
        source, cover, ...
      }
    }
  }
})
```

**回退到内置 SDK**:
```javascript
musicSdk.getMusicUrl(songInfo, '128k')
```

---

## 📦 歌曲信息结构

搜索返回的完整歌曲信息：

```javascript
{
  // 基本信息
  id: '歌曲 ID',
  title: '歌曲名',
  artist: '歌手',
  album: '专辑名',
  duration: '时长 (MM:SS)',
  
  // 平台特定标识
  songmid: 'QQ 音乐 MID',
  hash: '酷狗音乐 Hash',
  rid: '酷我音乐 RID',
  
  // 元数据
  albummid: '专辑 ID',
  source: '平台标识 (tx/wy/kg/kw)',
  cover: '封面图片 URL',
  
  // 音质信息（可选）
  _types: {
    '128k': { hash: 'xxx' },
    '320k': { hash: 'xxx' }
  }
}
```

---

## 🎵 支持的音质

- `128k`: 标准音质
- `320k`: 高品质
- `flac`: 无损音质
- `flac24bit`: 母带级音质

---

## ✅ 功能测试

### 测试结果

**搜索功能**:
- ✅ QQ 音乐：搜索正常，封面显示正常
- ✅ 酷狗音乐：搜索正常，封面显示正常
- ⚠️ 网易云音乐：偶尔网络错误
- ⚠️ 酷我音乐：API 返回不稳定

**URL 获取**:
- ✅ QQ 音乐：URL 获取正常
- ✅ 酷狗音乐：URL 获取正常
- ⚠️ 网易云音乐：依赖第三方 API
- ⚠️ 酷我音乐：依赖官方 API 稳定性

**音源脚本集成**:
- ✅ 优先调用音源脚本
- ✅ 音源脚本不可用时自动回退
- ✅ 播放和下载功能正常工作

---

## 🚀 使用方法

### 1. 搜索歌曲

```javascript
// 搜索所有平台
const results = await musicSdk.searchMusic('周杰伦 青花瓷', 1, 30, 'all');

// 搜索特定平台
const txResult = await musicSdk.searchMusic('周杰伦', 1, 30, 'tx');
const wyResult = await musicSdk.searchMusic('周杰伦', 1, 30, 'wy');
```

### 2. 播放歌曲

```javascript
// 前端调用（自动处理 URL 获取）
await playBuiltinSong(song);

// 或直接使用 SDK
const urlData = await musicSdk.getMusicUrl(song, '128k');
const audio = new Audio(urlData.url);
audio.play();
```

### 3. 下载歌曲

```javascript
// 前端调用（自动处理 URL 获取）
await downloadSourceSong(song);
```

---

## 📝 音源脚本开发指南

如果你想开发自定义音源脚本，需要实现以下功能：

### 必需的 action

```javascript
on(EVENT_NAMES.request, ({ source, action, info }) => {
  switch (action) {
    case 'musicUrl':
      // 获取播放 URL
      const url = await getMusicUrl(info.musicInfo, info.type);
      return url;  // 返回字符串
    
    case 'lyric':
      // 获取歌词
      return { lyric: '...', source };
    
    case 'pic':
      // 获取封面
      return '图片 URL';
  }
});
```

### 接收的参数

```javascript
{
  source: 'tx',  // 平台标识
  action: 'musicUrl',
  info: {
    type: '128k',  // 音质
    musicInfo: {   // 完整的歌曲信息
      id: '歌曲 ID',
      songmid: 'M500...',
      hash: 'A1B2...',
      title: '歌曲名',
      artist: '歌手',
      album: '专辑',
      source: 'tx',
      cover: '封面 URL'
    }
  }
}
```

### 返回格式

- **musicUrl**: 返回字符串（http/https URL）
- **lyric**: 返回对象 `{ lyric: '歌词文本', source: '平台' }`
- **pic**: 返回字符串（图片 URL）

---

## 🔍 故障排查

### 问题 1: 搜索失败
- 检查网络连接
- 检查 API 是否可用
- 查看控制台错误信息

### 问题 2: 无法获取 URL
- 检查音源脚本是否加载
- 查看音源脚本日志
- 检查歌曲信息是否完整

### 问题 3: 播放失败
- 检查 URL 是否有效
- 查看浏览器控制台错误
- 尝试其他音质

---

## 📊 优势

1. **官方 API 搜索**：搜索结果准确、完整
2. **智能 URL 获取**：优先使用音源脚本，保证音质和稳定性
3. **自动回退机制**：音源脚本不可用时自动使用内置 SDK
4. **完整歌曲信息**：支持封面、歌词等元数据
5. **多平台支持**：支持 QQ、网易云、酷狗、酷我

---

## 🎯 下一步优化

1. 增加更多音质选项
2. 优化歌词显示
3. 添加收藏功能
4. 支持更多音乐平台
5. 提高 API 稳定性

---

## 📚 相关文档

- [QQ 音乐 API 文档](https://sansenjian.github.io/qq-music-api/api/music.html)
- [网易云音乐 API 文档](https://apis.netstart.cn/music/#/)
- [酷狗音乐 API 文档](https://gitee.com/guoqianqiang/cool-dog-music-api/)
- [酷我音乐 API 文档](https://oiapi.net/index/doc?id=79)
- [洛雪音乐自定义音源规范](https://lxmusic.toside.cn/desktop/custom-source)

---

**更新时间**: 2026-03-22
**版本**: v1.0.0
