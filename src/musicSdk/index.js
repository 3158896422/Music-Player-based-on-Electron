/**
 * 音乐 SDK 入口文件
 * 集成各大音乐平台 API（仅搜索）
 */

const kg = require('./kg');
const tx = require('./tx');
const wy = require('./wy');

// 支持的音源列表
const sources = [
  { name: '酷狗音乐', id: 'kg' },
  { name: 'QQ 音乐', id: 'tx' },
  { name: '网易云音乐', id: 'wy' }
];

// 统一搜索接口
async function searchMusic(keyword, page = 1, limit = 30, source = 'all') {
  if (source === 'all') {
    // 在所有平台搜索
    const tasks = sources.map(s => {
      return searchMusic(keyword, page, limit, s.id).catch(err => {
        console.error(`[${s.id}] 搜索失败:`, err.message);
        return { list: [], total: 0, source: s.id };
      });
    });
    
    const results = await Promise.all(tasks);
    return results.filter(r => r.list && r.list.length > 0);
  }
  
  // 在指定平台搜索
  switch (source) {
    case 'kg':
      return kg.search(keyword, page, limit);
    case 'tx':
      return tx.search(keyword, page, limit);
    case 'wy':
      return wy.search(keyword, page, limit);
    default:
      throw new Error('不支持的音源：' + source);
  }
}

// 获取歌词
async function getLyric(songInfo) {
  const source = songInfo.source;

  switch (source) {
    case 'kg':
      return kg.getLyric(songInfo);
    case 'tx':
      return tx.getLyric(songInfo);
    case 'wy':
      return wy.getLyric(songInfo);
    default:
      throw new Error('不支持的音源：' + source);
  }
}

// 获取封面
async function getPic(songInfo) {
  const source = songInfo.source;

  switch (source) {
    case 'kg':
      return kg.getPic(songInfo);
    case 'tx':
    case 'wy':
      // QQ音乐和网易云音乐搜索结果已包含封面
      return songInfo.cover || null;
    default:
      return songInfo.cover || null;
  }
}

module.exports = {
  sources,
  searchMusic,
  getLyric,
  getPic
};
