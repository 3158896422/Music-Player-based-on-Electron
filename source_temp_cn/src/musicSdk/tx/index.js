/**
 * QQ 音乐 SDK
 * 参考洛雪播放器实现
 */

const axios = require('axios');

// QQ 音乐搜索
async function search(keyword, page = 1, limit = 30) {
  try {
    const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    
    const body = {
      comm: {
        ct: 19,
        cv: 1859,
        uin: 0
      },
      req_1: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'music.search.SearchCgiService',
        param: {
          query: keyword,
          num_per_page: limit,
          page_num: page,
          search_type: 0,
          nqc_flag: 0
        }
      }
    };
    
    const response = await axios.post(url, body);
    const data = response.data;
    
    if (data.code !== 0 || data.req_1.code !== 0) {
      throw new Error('搜索失败');
    }
    
    const songs = data.req_1.data.body.song.list.map(song => ({
      id: song.mid,
      title: song.title,
      artist: song.singer.map(s => s.name).join('&'),
      album: song.album.title,
      duration: formatDuration(song.interval),
      songmid: song.mid,
      albummid: song.album.mid,
      singer: song.singer,
      source: 'tx',
      cover: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album.mid}.jpg`
    }));
    
    return {
      list: songs,
      total: data.req_1.data.body.song.sum,
      source: 'tx'
    };
  } catch (error) {
    console.error('[QQ 音乐] 搜索错误:', error.message);
    throw error;
  }
}

// 获取歌曲详情（获取 songID）
async function getSongDetail(songmid) {
  try {
    const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    
    const body = {
      comm: {
        ct: 19,
        cv: 1859,
        uin: 0
      },
      req: {
        module: 'music.pf_song_detail_svr',
        method: 'get_song_detail_yqq',
        param: {
          song_type: 0,
          song_mid: songmid
        }
      }
    };
    
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://y.qq.com/'
      },
      timeout: 30000
    });
    
    const data = response.data;
    
    if (data.code !== 0 || data.req.code !== 0) {
      throw new Error('获取歌曲详情失败');
    }
    
    const trackInfo = data.req.data.track_info;
    const songId = trackInfo.id || trackInfo.song?.id;
    
    if (!songId) {
      throw new Error('未找到 songID');
    }
    
    return { songId };
  } catch (error) {
    console.error('[QQ 音乐] 获取歌曲详情错误:', error.message);
    throw error;
  }
}

// 获取歌词
async function getLyric(songInfo) {
  try {
    const songmid = songInfo.songmid || songInfo.id;
    if (!songmid) {
      console.error('[QQ 音乐] 缺少 songmid:', songInfo);
      throw new Error('缺少歌曲 songmid');
    }

    console.log('[QQ 音乐] 开始获取歌词，songmid:', songmid);

    // 第一步：获取歌曲详情（获取 songID）
    let songId = songInfo.id;
    if (!songId || typeof songId !== 'number') {
      try {
        const detail = await getSongDetail(songmid);
        songId = detail.songId;
        console.log('[QQ 音乐] 获取到 songID:', songId);
      } catch (error) {
        console.error('[QQ 音乐] 获取 songID 失败，使用备用方案');
        songId = songmid;
      }
    }

    // 第二步：获取歌词（尝试获取普通 LRC 格式）
    const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    
    const body = {
      comm: {
        ct: 19,
        cv: 1859,
        uin: 0
      },
      req: {
        method: 'GetPlayLyricInfo',
        module: 'music.musichallSong.PlayLyricInfo',
        param: {
          format: 'json',
          crypt: 0,  // 不加密
          ct: 19,
          cv: 1873,
          interval: 0,
          lrc_t: 0,
          qrc: 0,    // 不获取 QRC
          qrc_t: 0,
          roma: 0,
          roma_t: 0,
          songID: songId,
          trans: 1,  // 获取翻译
          trans_t: 0,
          type: -1
        }
      }
    };
    
    console.log('[QQ 音乐] 请求歌词 API:', url);
    console.log('[QQ 音乐] 请求参数:', JSON.stringify(body, null, 2));

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const data = response.data;
    
    console.log('[QQ 音乐] 歌词响应:', data);
    
    if (data.code !== 0 || data.req.code !== 0) {
      console.error('[QQ 音乐] 歌词请求失败:', data);
      throw new Error('获取歌词失败');
    }
    
    const lyricData = data.req.data;
    
    // 检查是否有歌词
    if (!lyricData || !lyricData.lyric) {
      console.error('[QQ 音乐] 未找到歌词数据');
      throw new Error('未找到歌词');
    }
    
    // 获取 base64 编码的歌词
    const lrc = lyricData.lyric || '';
    const tlrc = lyricData.trans || '';
    
    console.log('[QQ 音乐] 歌词长度 - lrc:', lrc?.length, 'tlrc:', tlrc?.length);
    
    if (lrc) {
      try {
        // Base64 解码
        const decoded = Buffer.from(lrc, 'base64').toString('utf-8');
        console.log('[QQ 音乐] Base64 解码成功，歌词预览:', decoded.substring(0, 200));
        
        return {
          lyric: decoded,
          tlyric: tlrc ? Buffer.from(tlrc, 'base64').toString('utf-8') : '',
          source: 'tx'
        };
      } catch (e) {
        console.error('[QQ 音乐] base64 解码失败:', e.message);
        throw new Error('歌词解码失败');
      }
    }
    
    throw new Error('歌词处理失败');
  } catch (error) {
    console.error('[QQ 音乐] 获取歌词错误:', error.message);
    return {
      lyric: null,
      source: 'tx',
    };
  }
}

// 格式化时长（秒 -> MM:SS）
function formatDuration(seconds) {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  search,
  getLyric,
  getSongDetail
};
