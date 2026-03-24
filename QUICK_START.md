# 快速使用指南

## 📋 重构总结

本次重构完成了以下目标：

1. ✅ **网易云音乐使用 NeteaseCloudMusicApi** - 更稳定、更官方
2. ✅ **移除酷我音乐** - 不再支持酷我音乐平台
3. ✅ **移除内置 URL 获取 SDK** - 完全依赖音源脚本获取 URL
4. ✅ **强制音源脚本获取 URL** - 播放和下载必须通过音源脚本

---

## 🎯 新的架构

### 搜索（使用官方 API）
```
musicSdk.searchMusic(keyword, page, limit, source)
  ↓
官方 API（QQ/网易云/酷狗）
  ↓
返回完整歌曲信息
```

### 播放/下载（必须通过音源脚本）
```
用户点击播放/下载
  ↓
检查是否有 URL
  ↓
没有 URL → 调用音源脚本
  ↓
传递完整的歌曲信息
  ↓
音源脚本返回 URL
  ↓
开始播放/下载
```

---

## 🔧 使用方法

### 1. 安装依赖
```bash
npm install
```

### 2. 启动应用
```bash
npm start
```

### 3. 导入音源脚本
1. 打开应用
2. 进入设置页面
3. 点击"导入音源"
4. 选择音源脚本文件（.js）
5. 确认导入

### 4. 搜索歌曲
1. 在搜索框输入关键词
2. 选择平台（QQ/网易云/酷狗）
3. 点击搜索
4. 查看搜索结果

### 5. 播放歌曲
1. 点击搜索结果中的歌曲
2. 系统会自动调用音源脚本获取 URL
3. 获取成功后开始播放

### 6. 下载歌曲
1. 点击歌曲旁边的下载按钮
2. 系统会自动调用音源脚本获取 URL
3. 获取成功后开始下载

---

## ⚠️ 重要提示

### 必须导入音源脚本
- 播放和下载功能**完全依赖**自定义音源脚本
- 如果没有导入音源脚本，会显示错误："音源脚本未加载，无法获取播放 URL"

### 音源脚本要求
音源脚本必须实现 `musicUrl` action：
```javascript
on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action === 'musicUrl') {
    const url = await getMusicUrl(info.musicInfo, info.type);
    return url;  // 返回字符串
  }
});
```

### 支持的音质
- `128k` - 标准音质
- `320k` - 高品质
- `flac` - 无损音质
- `flac24bit` - 母带级音质

---

## 📊 支持的平台

| 平台 | 标识 | 搜索 API | URL 获取 |
|------|------|---------|---------|
| QQ 音乐 | tx | 官方 API | 音源脚本 |
| 网易云音乐 | wy | NeteaseCloudMusicApi | 音源脚本 |
| 酷狗音乐 | kg | 官方 API | 音源脚本 |

---

## 🧪 测试

### 测试搜索功能
```bash
node test-search-integration.js
```

### 测试参数传递
```bash
node test-userapi-url.js
```

---

## 📚 相关文档

- [详细重构总结](./REFACTOR_SUMMARY_V2.md)
- [NeteaseCloudMusicApi 文档](https://www.npmjs.com/package/NeteaseCloudMusicApi)
- [洛雪音乐自定义音源规范](https://lxmusic.toside.cn/desktop/custom-source)

---

**更新时间**: 2026-03-22
**版本**: v2.0.0
