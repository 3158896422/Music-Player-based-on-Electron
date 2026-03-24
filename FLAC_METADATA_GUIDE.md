# FLAC 文件内嵌封面和歌词使用说明

## 技术实现

FLAC 文件使用 **Vorbis Comments** 技术来内嵌元数据，包括：

1. **Vorbis Comments** - 存储文本元数据（标题、艺术家、专辑、歌词等）
2. **FLAC Picture Block** - 存储封面图片

## 支持的元数据标签

### 标准标签
- `TITLE` - 歌曲标题
- `ARTIST` - 艺术家
- `ALBUM` - 专辑
- `DATE` - 发行日期
- `TRACKNUMBER` - 音轨号
- `GENRE` - 流派
- `ALBUMARTIST` - 专辑艺术家

### 特殊标签
- `LYRICS` - 歌词（Vorbis Comments 标准）
- `METADATA_BLOCK_PICTURE` - 封面图片

## 使用方法

### 1. 下载 FLAC 格式歌曲

在播放器中：
1. 搜索歌曲
2. 选择无损音质（flac）
3. 点击下载
4. 程序会自动内嵌封面和歌词

### 2. 验证内嵌元数据

使用提供的测试脚本：

```bash
node test-flac-lyrics.js "D:\Music\七里香.flac"
```

测试脚本会显示：
- ✓ Vorbis Comments 标签信息
- ✓ 封面图片信息
- ✓ 歌词内容

### 3. 在其他播放器中查看

大多数现代音乐播放器都支持读取 FLAC 的 Vorbis Comments：

- **Foobar2000** - 完全支持
- **VLC** - 完全支持
- **MusicBee** - 完全支持
- **AIMP** - 完全支持
- **PotPlayer** - 支持

## 代码实现细节

### 写入流程

```javascript
// src/musicMeta/flacMeta.js

1. 下载封面图片（如果有）
2. 构建 Vorbis Comments：
   - 标准字段：TITLE, ARTIST, ALBUM 等
   - 歌词字段：LYRICS
3. 使用 FLAC 处理器写入：
   - Vorbis Comment Block
   - Picture Block（封面）
4. 替换原文件
```

### Vorbis Comments 格式

```
TITLE=七里香
ARTIST=周杰伦
ALBUM=七里香
LYRICS=[00:00.00] 窗外的麻雀...
```

## 与 MP3 的区别

| 特性 | MP3 | FLAC |
|------|-----|------|
| 元数据格式 | ID3v2 | Vorbis Comments |
| 歌词标签 | USLT/UNSL | LYRICS |
| 封面标签 | APIC | METADATA_BLOCK_PICTURE |
| 编码支持 | UTF-16/UTF-8 | UTF-8 |

## 故障排除

### 问题 1：歌词没有内嵌

检查控制台日志：
```
[flacMeta] ✓ 歌词已添加到 Vorbis Comments，长度：1021
```

如果没有此日志，可能是：
- 歌词获取失败
- 歌词为空

### 问题 2：封面没有内嵌

检查控制台日志：
```
[flacMeta] 封面下载成功
[flacMeta] ✓ FLAC 元数据写入完成
```

如果封面下载失败，仍会写入其他元数据。

### 问题 3：其他播放器不显示歌词

某些播放器可能不支持 Vorbis Comments 的 LYRICS 标签，可以尝试：
1. 使用 Foobar2000（完全支持）
2. 检查播放器设置是否启用歌词显示
3. 确保歌词格式正确（LRC 或纯文本）

## 示例输出

运行测试脚本后的输出示例：

```
=== FLAC 文件元数据测试 ===

文件路径：D:\Music\七里香.flac

=== 基本信息 ===
格式：FLAC
编码：FLAC
时长：299.36 秒

=== Vorbis Comments (文本标签) ===
Vendor: reference libFLAC 1.2.1 20070917

评论标签:
  TITLE: 七里香
  ARTIST: 周杰伦
  ALBUM: 七里香
  LYRICS: [歌词，长度 1021 字符]

=== 封面图片 ===
✓ 包含封面图片
  图片 1:
    格式：image/jpeg
    类型：Cover Front
    大小：45678 字节
    描述：无

=== 歌词信息 ===
✓ 包含内嵌歌词
歌词长度：1021 字符

歌词预览 (前 200 字符):
---
[00:00.00] 窗外的麻雀 在电线杆上多嘴
[00:06.93] 你说这一句 很有夏天的感觉
---

=== 测试完成 ===
```

## 技术参考

- [FLAC 格式规范](https://xiph.org/flac/format.html)
- [Vorbis Comments 规范](https://wiki.hydrogenaud.io/index.php?title=Tag_Mapping)
- [music-metadata 库](https://github.com/Borewit/music-metadata)
