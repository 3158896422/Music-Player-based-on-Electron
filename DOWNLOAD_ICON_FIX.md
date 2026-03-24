# 下载图标显示修复说明

## 问题描述
之前实现的下载功能中，已下载或本地歌曲后面没有显示勾勾图标。

## 问题原因
1. 下载状态是异步检测的，但 UI 渲染时还没有获取到下载状态
2. 使用了 `v-if` 条件渲染，导致某些情况下按钮不显示
3. 没有在视图渲染时主动初始化下载状态

## 修复方案

### 1. 修改 UI 模板
将所有下载按钮的模板从条件渲染改为动态绑定：

**修改前：**
```html
<button class="download-btn" @click.stop="handleDownload(song)" :title="song.path ? '本地歌曲' : (song.downloaded ? '已下载' : '下载')" v-if="!song.path || song.downloaded">
  <svg v-if="song.path"><use href="#icon-check"/></svg>
  <svg v-else-if="song.downloaded"><use href="#icon-check"/></svg>
  <svg v-else><use href="#icon-download"/></svg>
</button>
```

**修改后：**
```html
<button class="download-btn" @click.stop="handleDownload(song)" :title="getDownloadTitle(song)">
  <svg><use :href="getDownloadIcon(song)"/></svg>
</button>
```

### 2. 添加辅助方法

**`getDownloadIcon(song)`** - 根据歌曲状态返回图标：
- 本地歌曲或已下载：返回 `#icon-check` (勾勾)
- 在线未下载：返回 `#icon-download` (下载箭头)

**`getDownloadTitle(song)`** - 返回按钮提示文字：
- 本地歌曲：返回 "本地歌曲"
- 已下载：返回 "已下载"
- 未下载：返回 "下载"

### 3. 初始化下载状态

添加 `initSongDownloadStatus(songs)` 方法，在视图渲染时调用：
- 遍历所有歌曲
- 本地歌曲直接设置 `downloaded = true`
- 在线歌曲异步检查下载状态
- 使用缓存避免重复检查

### 4. 在 computed 中调用初始化

修改 `displaySongs` 和 `playlistSongs` computed 属性：
```javascript
const displaySongs = computed(() => {
  let songs = [];
  // ... 获取歌曲列表
  
  // 初始化下载状态
  nextTick(() => {
    initSongDownloadStatus(songs);
  });
  
  return songs;
});
```

### 5. 修改 handleDownload 方法

本地歌曲现在也会直接播放：
```javascript
const handleDownload = async (song) => {
  // 如果是本地歌曲，直接播放
  if (song.path) {
    playLocalFile(song.path, song);
    return;
  }
  // ... 其他逻辑
};
```

## 修改的文件

1. **`index.html`**
   - 修改所有音乐列表中的下载按钮模板
   - 使用动态绑定代替条件渲染

2. **`app.js`**
   - 添加 `getDownloadIcon` 方法
   - 添加 `getDownloadTitle` 方法
   - 添加 `initSongDownloadStatus` 方法
   - 修改 `handleDownload` 方法
   - 修改 `displaySongs` computed
   - 修改 `playlistSongs` computed
   - 导出新增的方法

## 预期效果

现在在所有视图中：
- ✅ **本地歌曲** - 显示勾勾图标 (✓)，点击直接播放
- ✅ **已下载的在线音乐** - 显示勾勾图标 (✓)，点击播放本地文件
- ✅ **未下载的在线音乐** - 显示下载图标 (⬇️)，点击下载

## 测试步骤

1. 启动应用
2. 切换到"我喜欢的"视图
3. 检查本地歌曲是否显示勾勾图标
4. 切换到"最近播放"视图
5. 检查已下载的在线音乐是否显示勾勾图标
6. 切换到"在线音乐"搜索
7. 检查未下载的在线音乐是否显示下载图标
8. 点击下载图标，测试下载功能
9. 下载完成后，检查图标是否变为勾勾

## 注意事项

1. 下载状态检测是异步的，可能需要短暂时间才会显示正确图标
2. 缓存机制会记住已检查过的歌曲状态
3. 重启应用后会重新检测下载状态
4. 本地歌曲始终显示勾勾图标

## 版本信息

- **修复日期**: 2026-03-24
- **版本**: v3.1.1
- **状态**: ✅ 已修复
