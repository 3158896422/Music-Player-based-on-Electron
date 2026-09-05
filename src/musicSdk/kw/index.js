/**
 * 酷我音乐 SDK
 * 搜索接口：kuwo.cn/search/searchMusicBykeyWord（免鉴权）
 * 歌词接口：m.kuwo.cn/newh5/singles/songinfoandlrc（需 Android UA）
 */

const axios = require('axios');

// 酷我音乐搜索（网络错误时自动重试一次）
async function search(keyword, page = 1, limit = 30) {
  try {
    return await fetchSearch(keyword, page, limit);
  } catch (error) {
    console.warn('[酷我音乐] 搜索失败，重试一次:', error.message);
    return fetchSearch(keyword, page, limit);
  }
}

async function fetchSearch(keyword, page = 1, limit = 30) {
  try {
    const url = 'https://kuwo.cn/search/searchMusicBykeyWord';
    const params = {
      vipver: 1,
      client: 'kt',
      ft: 'music',
      cluster: 0,
      strategy: 2012,
      encoding: 'utf8',
      rformat: 'json',
      mobi: 1,
      issubtitle: 1,
      show_copyright_off: 1,
      pn: Math.max(page - 1, 0),
      rn: limit,
      all: keyword
    };
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const response = await axios.get(url, { params, headers, timeout: 30000 });
    const data = response.data;

    if (!data || !data.abslist) {
      return { list: [], total: 0, source: 'kw' };
    }

    const songs = data.abslist.map(item => {
      const rawRid = item.MUSICRID || '';
      const rid = rawRid.replace(/^MUSIC_/, '');
      const durationSec = Number(item.DURATION) || 0;
      return {
        id: rid,
        rid: rid,
        title: item.SONGNAME || '未知歌曲',
        artist: item.ARTIST || '未知歌手',
        album: item.ALBUM || '未知专辑',
        duration: formatDuration(durationSec * 1000),
        durationSec: durationSec,
        songmid: rid,
        source: 'kw',
        cover: null
      };
    });

    return {
      list: songs,
      total: data.TOTAL || songs.length,
      source: 'kw'
    };
  } catch (error) {
    console.error('[酷我音乐] 搜索错误:', error.message);
    throw error;
  }
}

// 获取歌词
async function getLyric(songInfo) {
  try {
    const id = songInfo.rid || songInfo.id;
    if (!id) {
      throw new Error('缺少歌曲 id');
    }

    const url = `https://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${id}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
      'Referer': 'https://m.kuwo.cn/'
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    const data = response.data;

    if (!data || !data.data || !data.data.lrclist) {
      throw new Error('获取歌词失败');
    }

    // lrclist -> LRC 文本（time 单位：秒）
    const lines = data.data.lrclist.map(item => {
      const time = Number(item.time) || 0;
      const min = Math.floor(time / 60);
      const sec = Math.floor(time % 60);
      const ms = Math.floor((time - Math.floor(time)) * 100);
      return `[${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]${item.lineLyric || ''}`;
    });

    if (lines.length === 0) {
      return {
        lyric: '[00:00.00] 暂无歌词',
        source: 'kw'
      };
    }

    return {
      lyric: lines.join('\n'),
      source: 'kw'
    };
  } catch (error) {
    console.error('[酷我音乐] 获取歌词错误:', error.message);
    return {
      lyric: null,
      source: 'kw'
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
