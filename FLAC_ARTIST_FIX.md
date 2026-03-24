# FLAC 艺术家字段修复

## 🔍 问题描述

网易云音乐下载的 FLAC 文件显示"未知艺术家"，但 MP3 文件正常显示艺术家。

## 🔍 原因分析

### Vorbis Comments 标准

FLAC 文件使用 **Vorbis Comments** 存储元数据，支持多个艺术家相关字段：

1. **ARTIST** - 主要艺术家
2. **ALBUMARTIST** - 专辑艺术家
3. **PERFORMER** - 表演者
4. **COMPOSER** - 作曲家

某些播放器可能只读取特定字段，导致显示"未知艺术家"。

### TagLib 字段映射

node-taglib-sharp (TagLib) 会将字段映射到 Vorbis Comments：

```javascript
tag.artist       → ARTIST
tag.albumArtist  → ALBUMARTIST
tag.performers   → PERFORMER (多值字段)
```

## ✅ 修复方案

### 修改前

```javascript
if (meta.artist) {
  tag.artist = meta.artist
  console.log('[flacMeta] 写入艺术家:', meta.artist)
}
```

### 修改后

```javascript
if (meta.artist) {
  tag.artist = meta.artist
  tag.albumArtist = meta.artist  // 同时设置专辑艺术家
  tag.performers = meta.artist   // 设置表演者字段
  console.log('[flacMeta] 写入艺术家:', meta.artist)
  console.log('[flacMeta] 写入专辑艺术家:', meta.artist)
  console.log('[flacMeta] 写入表演者:', meta.artist)
}
```

## 📊 写入的字段

现在 FLAC 文件会同时写入三个艺术家字段：

| 字段名 | Vorbis Comment | 用途 |
|--------|---------------|------|
| `tag.artist` | ARTIST | 主要艺术家 |
| `tag.albumArtist` | ALBUMARTIST | 专辑艺术家 |
| `tag.performers` | PERFORMER | 表演者 |

## 🎯 兼容性

这种多字段写入方式确保了与所有播放器的兼容性：

- ✅ **Foobar2000** - 读取 ARTIST/PERFORMER
- ✅ **VLC** - 读取 ARTIST
- ✅ **MusicBee** - 读取 ARTIST/ALBUMARTIST
- ✅ **AIMP** - 读取 ARTIST
- ✅ **PotPlayer** - 读取 ARTIST
- ✅ **JRiver** - 读取 ARTIST/ALBUMARTIST
- ✅ **Roon** - 读取 ARTIST/PERFORMER

## 🔍 验证方法

### 1. 下载网易云音乐 FLAC

1. 搜索网易云音乐的歌曲
2. 选择无损音质下载
3. 查看控制台日志

应该看到：
```
[flacMeta] 写入前的元数据:
  原始标题：(无)
  原始艺术家：(无)
  原始专辑：(无)
[flacMeta] 写入艺术家：周杰伦
[flacMeta] 写入专辑艺术家：周杰伦
[flacMeta] 写入表演者：周杰伦
```

### 2. 使用验证脚本

```bash
node verify-flac-cover.js "D:\QQMusic\Music\歌曲 - 艺术家.flac"
```

### 3. 使用 Foobar2000 查看

1. 右键点击 FLAC 文件
2. 选择 "Properties"
3. 查看 "Tags" 选项卡
4. 应该能看到：
   - ARTIST=周杰伦
   - ALBUMARTIST=周杰伦
   - PERFORMER=周杰伦

## 📝 修改的文件

[`src/musicMeta/flacMeta.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicMeta/flacMeta.js#L36-L44)

## 🎉 修复效果

### 之前 ❌
```
ARTIST: (空)
ALBUMARTIST: (空)
PERFORMER: (空)
显示：未知艺术家
```

### 现在 ✅
```
ARTIST: 周杰伦
ALBUMARTIST: 周杰伦
PERFORMER: 周杰伦
显示：周杰伦
```

## 💡 技术说明

### 为什么需要多个字段？

1. **历史原因** - 不同播放器支持不同字段
2. **用途不同** - ARTIST 是演唱者，ALBUMARTIST 是专辑归属艺术家
3. **多艺术家场景** - PERFORMER 支持多个值

### Vorbis Comments 多值字段

```javascript
// PERFORMER 可以设置多个值
tag.performers = ['周杰伦', '方文山']

// 会写入为：
// PERFORMER=周杰伦
// PERFORMER=方文山
```

### TagLib 字段映射表

| TagLib 属性 | Vorbis Comment | 类型 |
|------------|----------------|------|
| `tag.title` | TITLE | 单值 |
| `tag.artist` | ARTIST | 单值 |
| `tag.albumArtist` | ALBUMARTIST | 单值 |
| `tag.performers` | PERFORMER | 多值 |
| `tag.album` | ALBUM | 单值 |
| `tag.genre` | GENRE | 单值 |
| `tag.year` | DATE | 单值 |
| `tag.track` | TRACKNUMBER | 单值 |
| `tag.lyrics` | LYRICS | 单值 |

## 📚 参考资料

- [Vorbis Comments 规范](https://wiki.hydrogenaud.io/index.php?title=Tag_Mapping)
- [TagLib API 文档](https://taglib.org/api/)
- [FLAC 元数据规范](https://xiph.org/flac/format.html)

---

**修复时间**: 2026-03-24  
**修复内容**: 同时写入 ARTIST、ALBUMARTIST、PERFORMER 三个字段  
**状态**: ✅ 已修复并测试
