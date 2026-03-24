# FLAC 艺术家格式修复

## 🔍 问题分析

### 正确的艺术家格式
```
梨冻紧&Wiz_H 张子豪
```

### 可能的问题
1. **&符号编码问题** - `&` 符号可能被错误编码
2. **performers 字段类型** - 应该是数组而不是字符串
3. **原始数据问题** - 下载时传递的 artist 值本身就不对

## ✅ 修复内容

### 1. 修复 performers 字段类型

**修改前**:
```javascript
tag.performers = meta.artist  // 字符串
```

**修改后**:
```javascript
tag.performers = [meta.artist]  // 数组
```

### 2. 添加详细日志

现在会记录：
- artist 字段的类型
- artist 字段的长度
- 原始 artist 值

## 🔍 调试步骤

### 1. 下载网易云音乐 FLAC

下载一首歌曲，查看控制台日志：

```
[flacMeta] meta 信息: {
  title: '罗生门',
  artist: '梨冻紧&Wiz_H 张子豪',
  artistType: 'string',
  artistLength: 13,
  album: '罗生门',
  hasAPIC: true,
  hasLyrics: true
}
```

### 2. 检查写入的字段

```
[flacMeta] 写入艺术家：梨冻紧&Wiz_H 张子豪
[flacMeta] 写入专辑艺术家：梨冻紧&Wiz_H 张子豪
[flacMeta] 写入表演者：梨冻紧&Wiz_H 张子豪
```

### 3. 使用检查脚本验证

```bash
node check-flac-artist.js "D:\QQMusic\Music\罗生门 - 梨冻紧&Wiz_H 张子豪.flac"
```

## 📊 字段对比

| 字段 | 正确的值 | 错误的值 |
|------|---------|---------|
| ARTIST | 梨冻紧&Wiz_H 张子豪 | (空或其他格式) |
| ALBUMARTIST | 梨冻紧&Wiz_H 张子豪 | (空或其他格式) |
| PERFORMER | 梨冻紧&Wiz_H 张子豪 | (空或其他格式) |

## 🎯 验证标准

使用 Foobar2000 或其他工具查看 FLAC 文件属性：

**正确的显示**:
```
参与创作的艺术家：梨冻紧&Wiz_H 张子豪
唱片集艺术家：梨冻紧&Wiz_H 张子豪
```

**错误的显示**:
```
参与创作的艺术家：(空) 或 格式错误
唱片集艺术家：(空) 或 格式错误
```

## 📝 修改的文件

[`src/musicMeta/flacMeta.js`](file:///d:/Trae%20CN/project/Music_Player/MusicPlayer-Electron/src/musicMeta/flacMeta.js)

**关键修改**:
1. Line 39: `tag.performers = [meta.artist]` - 使用数组
2. Line 94-95: 添加 artistType 和 artistLength 日志

## 🔧 后续优化

如果问题仍然存在，可能需要：
1. 检查下载时传递的 artist 值
2. 检查网易云音乐 API 返回的 artist 格式
3. 考虑使用 Vorbis Comments 原生方式写入

---

**修复时间**: 2026-03-24  
**修复内容**: performers 字段改为数组格式  
**状态**: ⏳ 待验证
