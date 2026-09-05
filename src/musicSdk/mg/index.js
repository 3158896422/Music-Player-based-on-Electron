/**
 * 咪咕音乐 SDK
 * 搜索接口：pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do（免鉴权）
 * 歌词：搜索结果自带 lyricUrl，直接返回标准 LRC 文本
 */

const axios = require('axios');

// 咪咕音乐搜索
async function search(keyword, page = 1, limit = 30) {
  try {
    const url = 'https://pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do';
    const params = {
      ua: 'Android_migu',
      version: '5.1',
      text: keyword,
      pageSize: limit,
      pageNo: page,
      searchSwitch: '{"song":1}'
    };
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
      'Referer': 'https://music.migu.cn/'
    };

    const response = await axios.get(url, { params, headers, timeout: 30000 });
    const data = response.data;

    const list = (data && data.songResultData && data.songResultData.result) || [];
    if (!data || list.length === 0) {
      return {
        list: [],
        total: 0,
        source: 'mg'
      };
    }

    const songs = list.map(item => {
      const singers = (item.singers || []).map(s => s.name).filter(Boolean);
      const album = item.album || {};
      const durationMs = Number(item.timeLength) || 0;
      return {
        id: item.copyrightId,
        title: item.name || '未知歌曲',
        artist: singers.length > 0 ? singers.join('&') : '未知歌手',
        album: album.name || '未知专辑',
        duration: formatDuration(durationMs),
        durationSec: Math.floor(durationMs / 1000),
        songmid: item.copyrightId,
        source: 'mg',
        cover: pickCover(item.imgItems),
        lyricUrl: item.lyricUrl || null
      };
    });

    return {
      list: songs,
      total: (data.songResultData && data.songResultData.totalCount) || songs.length,
      source: 'mg'
    };
  } catch (error) {
    console.error('[咪咕音乐] 搜索错误:', error.message);
    throw error;
  }
}

// 获取歌词（直接使用搜索结果自带的 lyricUrl）
async function getLyric(songInfo) {
  try {
    const url = songInfo.lyricUrl;
    if (!url) {
      throw new Error('缺少歌词地址');
    }

    const response = await axios.get(url, { timeout: 30000 });
    const text = response.data;

    if (!text || (typeof text === 'string' && text.trim().length === 0)) {
      return {
        lyric: '[00:00.00] 暂无歌词',
        source: 'mg'
      };
    }

    return {
      lyric: typeof text === 'string' ? text : JSON.stringify(text),
      source: 'mg'
    };
  } catch (error) {
    console.error('[咪咕音乐] 获取歌词错误:', error.message);
    return {
      lyric: null,
      source: 'mg'
    };
  }
}

// 从 imgItems 中挑选封面（优先大尺寸 '03'，否则取最后一个）
function pickCover(imgItems) {
  if (!imgItems || imgItems.length === 0) return null;
  const img3 = imgItems.find(item => item.imgSizeType === '03');
  if (img3 && img3.img) return img3.img;
  const last = imgItems[imgItems.length - 1];
  return (last && last.img) || null;
}

// 格式化时长（毫秒 -> MM:SS）
function formatDuration(ms) {
  if (!ms) return '00:00';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  search,
  getLyric
};
