/**
 * 酷狗音乐 SDK
 * API 文档：https://gitee.com/guoqianqiang/cool-dog-music-api/
 */

const axios = require('axios');

// 酷狗音乐搜索
async function search(keyword, page = 1, limit = 30) {
  try {
    const url = 'http://mobilecdn.kugou.com/api/v3/search/song';
    const params = {
      format: 'json',
      keyword: keyword,
      page: page,
      pagesize: limit,
      showtype: 1
    };

    const response = await axios.get(url, { params });
    const data = response.data;

    if (data.status !== 1) {
      throw new Error(data.error || '搜索失败');
    }

    const songs = data.data.info.map(song => {
      const durationSec = song.duration || 0;
      const durationStr = durationSec > 0 ? formatDuration(durationSec) : '';

      return {
        id: song.audio_id,
        title: song.songname,
        artist: song.singername,
        album: song.album_name || '未知专辑',
        duration: durationStr,
        durationSec: durationSec,
        hash: song.hash,
        album_id: song.album_id,
        album_audio_id: song.album_audio_id,
        source: 'kg',
        cover: null
      };
    });

    return {
      list: songs,
      total: data.data.total,
      source: 'kg'
    };
  } catch (error) {
    console.error('[酷狗音乐] 搜索错误:', error.message);
    throw error;
  }
}

// 获取封面
async function getPic(songInfo) {
  try {
    const response = await axios.post(
      'http://media.store.kugou.com/v1/get_res_privilege',
      {
        appid: 1001,
        area_code: '1',
        behavior: 'play',
        clientver: '9020',
        need_hash_offset: 1,
        relate: 1,
        resource: [
          {
            album_audio_id: songInfo.album_audio_id || songInfo.id,
            album_id: songInfo.album_id,
            hash: songInfo.hash,
            id: 0,
            name: `${songInfo.artist} - ${songInfo.title}.mp3`,
            type: 'audio',
          },
        ],
        token: '',
        userid: 2626431536,
        vip: 1,
      },
      {
        headers: {
          'KG-RC': 1,
          'KG-THash': 'expand_search_manager.cpp:852736169:451',
          'Content-Type': 'application/json'
        }
      }
    );

    const body = response.data;
    if (body.error_code !== 0 || !body.data || !body.data[0]) {
      return null;
    }

    const info = body.data[0].info;
    if (!info || !info.image) {
      return null;
    }

    const imgSize = info.imgsize ? info.imgsize[0] : 480;
    const img = info.image.replace('{size}', imgSize).replace('http://', 'https://');
    return img;
  } catch (error) {
    console.error('[酷狗音乐] 获取封面错误:', error.message);
    return null;
  }
}

// 酷狗歌词请求专用请求头（参考洛雪音乐）
const kgLyricHeaders = {
  'KG-RC': 1,
  'KG-THash': 'expand_search_manager.cpp:852736169:451',
};

// 获取歌词
async function getLyric(songInfo) {
  try {
    const hash = songInfo.hash;
    if (!hash) {
      throw new Error('缺少歌曲 hash');
    }

    const name = songInfo.title || songInfo.name;
    const artist = songInfo.artist || '';
    const timelength = songInfo.durationSec ? Math.floor(songInfo.durationSec * 1000) : 0;

    // 使用酷狗 API 搜索歌词（参考洛雪音乐的实现）
    const searchUrl = `http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${encodeURIComponent(name)}&hash=${hash}&timelength=${timelength}&lrctxt=1`;

    // 增加超时时间到30秒，因为跨域请求可能较慢
    const searchResponse = await axios.get(searchUrl, {
      headers: kgLyricHeaders,
      timeout: 30000,
    });

    const searchData = searchResponse.data;
    console.log('[酷狗音乐] 歌词搜索返回:', JSON.stringify(searchData).substring(0, 500));

    if (searchData.candidates && searchData.candidates.length > 0) {
      const candidate = searchData.candidates[0];
      const accessKey = candidate.accesskey || candidate.access_key;

      // 优先请求 LRC 格式歌词（标准格式，容易解析）
      let fmt = 'lrc';
      let lyric = null;

      try {
        const downloadUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${accessKey}&fmt=${fmt}&charset=utf8`;
        console.log('[酷狗音乐] 请求歌词URL:', downloadUrl);
        const downloadResponse = await axios.get(downloadUrl, {
          headers: kgLyricHeaders,
          timeout: 30000,
        });

        const downloadData = downloadResponse.data;
        console.log('[酷狗音乐] 歌词返回格式:', downloadData.fmt, 'content长度:', downloadData.content ? downloadData.content.length : 0);

        if (downloadData.fmt === 'krc') {
          // KRC格式需要解密
          const krcContent = Buffer.from(downloadData.content, 'base64');
          lyric = decodeKrc(krcContent);
          console.log('[酷狗音乐] KRC格式歌词解密成功，长度:', lyric ? lyric.length : 0);
        } else {
          // LRC格式直接base64解码
          lyric = Buffer.from(downloadData.content, 'base64').toString('utf-8');
          console.log('[酷狗音乐] LRC格式歌词解码成功，长度:', lyric ? lyric.length : 0);
        }
      } catch (downloadError) {
        console.log('[酷狗音乐] LRC格式获取失败:', downloadError.message, '尝试KRC格式');
      }

      // 如果LRC获取失败，尝试KRC格式
      if (!lyric) {
        fmt = 'krc';
        try {
          const downloadUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${accessKey}&fmt=${fmt}&charset=utf8`;
          console.log('[酷狗音乐] 尝试KRC格式，请求URL:', downloadUrl);
          const downloadResponse = await axios.get(downloadUrl, {
            headers: kgLyricHeaders,
            timeout: 30000,
          });

          const downloadData = downloadResponse.data;
          console.log('[酷狗音乐] KRC返回格式:', downloadData.fmt, 'content长度:', downloadData.content ? downloadData.content.length : 0);
          const krcContent = Buffer.from(downloadData.content, 'base64');
          lyric = decodeKrc(krcContent);
          console.log('[酷狗音乐] KRC格式歌词解密成功，长度:', lyric ? lyric.length : 0);
        } catch (krcError) {
          console.error('[酷狗音乐] KRC格式也获取失败:', krcError.message);
        }
      }

      if (lyric) {
        return {
          lyric: lyric,
          source: 'kg',
        };
      }
    }

    throw new Error('未找到歌词');
  } catch (error) {
    console.error('[酷狗音乐] 获取歌词错误:', error.message);
    return {
      lyric: null,
      source: 'kg',
    };
  }
}

// KRC格式解密（参考洛雪音乐）
function decodeKrc(buffer) {
  console.log('[酷狗音乐] decodeKrc开始，buffer长度:', buffer ? buffer.length : 0);
  const encKey = Buffer.from([0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47, 0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69], 'binary');

  // 跳过前4字节
  const bufStr = buffer.subarray(4);
  console.log('[酷狗音乐] 跳过4字节后，bufStr长度:', bufStr.length);

  // XOR解密
  for (let i = 0, len = bufStr.length; i < len; i++) {
    bufStr[i] = bufStr[i] ^ encKey[i % 16];
  }
  console.log('[酷狗音乐] XOR解密完成');

  // zlib解压
  const zlib = require('zlib');
  try {
    const inflated = zlib.inflateSync(bufStr);
    console.log('[酷狗音乐] zlib解压成功，结果长度:', inflated.length);
    return inflated.toString('utf-8');
  } catch (e) {
    console.error('[酷狗音乐] zlib解压失败:', e.message);
    // 如果zlib解压失败，尝试直接返回
    return bufStr.toString('utf-8');
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
  getPic,
  getLyric
};
