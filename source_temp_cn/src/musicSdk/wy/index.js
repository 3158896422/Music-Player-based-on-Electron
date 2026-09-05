/**
 * 网易云音乐 SDK
 * 使用 NeteaseCloudMusicApi
 * npm: https://www.npmjs.com/package/NeteaseCloudMusicApi
 */

const axios = require('axios');

// 网易云音乐搜索
async function search(keyword, page = 1, limit = 30) {
  try {
    // 使用 NeteaseCloudMusicApi 搜索
    const cloudMusicApi = require('NeteaseCloudMusicApi');
    const result = await cloudMusicApi.search({
      keywords: keyword,
      page: page,
      limit: limit,
      type: 1  // 1: 单曲
    });

    const data = result.body;

    if (data.code !== 200 || !data.result || !data.result.songs) {
      throw new Error(data.message || '搜索失败');
    }

    // 获取所有歌曲ID
    const songIds = data.result.songs.map(song => song.id);

    // 使用 song_detail API 获取完整信息（包含封面）
    const detailResult = await cloudMusicApi.song_detail({
      ids: songIds.join(',')
    });

    const detailData = detailResult.body;

    // 创建 ID -> 封面URL 的映射
    const coverMap = {};
    if (detailData.songs) {
      detailData.songs.forEach(song => {
        if (song.al && song.al.picUrl) {
          coverMap[song.id] = song.al.picUrl;
        }
      });
    }

    const songs = data.result.songs.map(song => {
      const cover = coverMap[song.id] || null;
      const durationSec = song.duration || song.dt || 0;
      const durationStr = durationSec > 0 ? formatDuration(durationSec) : '';

      return {
        id: song.id,
        title: song.name,
        artist: song.artists ? song.artists.map(a => a.name).join('&') : '未知歌手',
        album: song.album ? song.album.name : '未知专辑',
        duration: durationStr,
        durationSec: Math.floor(durationSec / 1000),
        songmid: song.id,
        albummid: song.album ? song.album.id : null,
        source: 'wy',
        cover: cover
      };
    });

    return {
      list: songs,
      total: data.result.songCount || songs.length,
      source: 'wy'
    };
  } catch (error) {
    console.error('[网易云音乐] 搜索错误:', error.message);
    throw error;
  }
}

// 获取歌词
async function getLyric(songInfo) {
  try {
    const id = songInfo.id || songInfo.songmid;
    if (!id) {
      throw new Error('缺少歌曲 id');
    }

    console.log('[网易云音乐] 开始获取歌词，id:', id);

    // 使用网易云官方 API 获取歌词
    const url = `https://music.163.com/api/song/lyric?id=${id}&lv=1&type=1`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://music.163.com/'
      },
      timeout: 30000
    });

    const data = response.data;

    if (data.code !== 200) {
      throw new Error('获取歌词失败，code: ' + data.code);
    }

    // 检查是否有歌词
    if (!data.lrc || !data.lrc.lyric) {
      console.log('[网易云音乐] 未找到歌词');
      return {
        lyric: '[00:00.00] 暂无歌词',
        source: 'wy'
      };
    }

    console.log('[网易云音乐] 获取歌词成功');

    return {
      lyric: data.lrc.lyric,
      source: 'wy'
    };
  } catch (error) {
    console.error('[网易云音乐] 获取歌词错误:', error.message);
    return {
      lyric: null,
      source: 'wy'
    };
  }
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
