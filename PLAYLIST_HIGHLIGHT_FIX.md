# 播放列表本地音乐高亮修复

## 问题描述

在最近播放和自建歌单界面，当播放到本地音乐时，播放列表里那首歌不会高亮显示，但在线歌曲会正常高亮。

## 问题原因

`isPlaylistItemPlaying` 函数在处理本地音乐时的逻辑不完整：

**修复前的代码：**
```javascript
const isPlaylistItemPlaying = (song, index) => {
  // 如果是本地音乐（有 path）
  if (song.path) {
    return currentPlayContext.value === 'library' && currentSongIndex.value >= 0 && 
           musicFiles.value[currentSongIndex.value]?.path === song.path;
  }
  // ... 其他逻辑
};
```

**问题：**
- 只检查了 `currentPlayContext.value === 'library'` 的情况
- 没有处理从 `favorites`、`recent`、`playlist` 上下文播放本地音乐的情况
- 导致在这些列表中播放本地音乐时，无法正确匹配高亮状态

## 修复方案

### 完善本地音乐的高亮判断逻辑

**修复后的代码：**
```javascript
const isPlaylistItemPlaying = (song, index) => {
  // 如果是本地音乐（有 path）
  if (song.path) {
    // 检查是否正在播放本地音乐
    if (currentPlayContext.value === 'library') {
      return currentSongIndex.value >= 0 && 
             musicFiles.value[currentSongIndex.value]?.path === song.path;
    }
    // 如果是从 favorites/recent/playlist 播放的本地音乐
    if (['favorites', 'recent', 'playlist'].includes(currentPlayContext.value)) {
      // 检查索引是否匹配
      if (currentContextIndex.value === index) {
        // 再检查是否是同一首歌
        const currentSong = currentContextSongs.value[currentContextIndex.value];
        return currentSong && currentSong.path === song.path;
      }
      return false;
    }
    // 如果是 builtin 上下文播放的本地音乐
    if (currentPlayContext.value === 'builtin') {
      if (currentBuiltinSong.value && currentBuiltinSong.value.path === song.path) {
        return true;
      }
    }
    return false;
  }
  // ... 在线音乐逻辑
};
```

### 修复逻辑说明

1. **本地音乐库上下文 (`library`)**
   - 使用原有的逻辑：检查 `currentSongIndex` 和 `musicFiles` 数组

2. **播放列表上下文 (`favorites`/`recent`/`playlist`)**
   - 检查 `currentContextIndex` 是否与列表索引匹配
   - 再检查当前播放的歌曲 path 是否与列表项的 path 匹配
   - 双重确认确保高亮正确

3. **在线音乐上下文 (`builtin`)**
   - 检查 `currentBuiltinSong.value.path` 是否与列表项的 path 匹配

## 修改的文件

- **`app.js`** - 修改 `isPlaylistItemPlaying` 函数

## 测试场景

### 场景 1：最近播放列表
1. 打开"最近播放"视图
2. 播放列表中的本地音乐
3. ✅ 播放列表中高亮显示当前播放的歌曲

### 场景 2：自建歌单
1. 打开自建歌单
2. 播放歌单中的本地音乐
3. ✅ 播放列表中高亮显示当前播放的歌曲

### 场景 3：我喜欢的
1. 打开"我喜欢的"视图
2. 播放列表中的本地音乐
3. ✅ 播放列表中高亮显示当前播放的歌曲

### 场景 4：在线音乐
1. 在任何列表中播放在线音乐
2. ✅ 播放列表中高亮显示当前播放的歌曲（原有功能保持正常）

## 技术细节

### 播放上下文说明

- **`library`**: 本地音乐库视图
- **`favorites`**: 我喜欢的音乐视图
- **`recent`**: 最近播放视图
- **`playlist`**: 自建歌单视图
- **`builtin`**: 在线音乐播放上下文

### 索引说明

- **`currentSongIndex`**: 本地音乐库 (`musicFiles`) 中的播放索引
- **`currentContextIndex`**: 当前播放上下文 (`currentContextSongs`) 中的播放索引

### 匹配优先级

1. 首先判断歌曲类型（本地/在线）
2. 然后根据播放上下文选择匹配逻辑
3. 最后通过 path 或唯一标识 (hash/id/songmid) 确认匹配

## 优势

1. **全面覆盖** - 支持所有播放上下文的本地音乐高亮
2. **准确匹配** - 使用 path 进行精确匹配，避免误判
3. **保持兼容** - 不影响原有的在线音乐高亮逻辑
4. **逻辑清晰** - 代码结构清晰，易于维护

## 版本信息

- **修复日期**: 2026-03-24
- **版本**: v3.1.3
- **状态**: ✅ 已修复
