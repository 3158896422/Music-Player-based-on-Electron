const axios = require('axios');

async function testQQMusicLyric() {
  // 使用搜索获取一个有效的歌曲
  console.log('=== 步骤 1: 搜索歌曲 ===');
  
  const searchUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
  const searchBody = {
    comm: {
      ct: 19,
      cv: 1859,
      uin: 0
    },
    req_1: {
      method: 'DoSearchForQQMusicDesktop',
      module: 'music.search.SearchCgiService',
      param: {
        query: '周杰伦 晴天',
        num_per_page: 1,
        page_num: 1,
        search_type: 0
      }
    }
  };
  
  try {
    const searchResponse = await axios.post(searchUrl, searchBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const searchData = searchResponse.data;
    console.log('搜索响应:', JSON.stringify(searchData, null, 2));
    
    if (searchData.code !== 0 || searchData.req_1?.code !== 0) {
      console.error('❌ 搜索失败');
      return;
    }
    
    const songList = searchData.req_1?.data?.body?.song?.list;
    if (!songList || songList.length === 0) {
      console.error('❌ 没有找到歌曲');
      return;
    }
    
    const song = songList[0];
    const songmid = song.mid;
    const songName = song.title;
    const singerName = song.singer.map(s => s.name).join('&');
    
    console.log(`✅ 找到歌曲：${songName} - ${singerName}, songmid: ${songmid}`);
    
    // 获取歌曲详情
    console.log('\n=== 步骤 2: 获取歌曲详情 ===');
    
    const musicInfoUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    const musicInfoBody = {
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
    
    const musicInfoResponse = await axios.post(musicInfoUrl, musicInfoBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const musicInfoData = musicInfoResponse.data;
    console.log('歌曲详情响应 code:', musicInfoData.code, 'req code:', musicInfoData.req?.code);
    
    const songId = musicInfoData?.req?.data?.track_info?.id;
    
    if (!songId) {
      console.error('❌ 无法获取 songID，使用 songmid 代替');
      // 有些歌曲可以直接用 songmid 作为 ID
    }
    
    console.log(`songId: ${songId || songmid}`);
    
    // 获取歌词
    console.log('\n=== 步骤 3: 获取歌词 ===');
    
    const lyricUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    const lyricBody = {
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
          crypt: 0,
          ct: 19,
          cv: 1873,
          interval: 0,
          lrc_t: 0,
          qrc: 0,
          qrc_t: 0,
          roma: 0,
          roma_t: 0,
          songID: songId || songmid,
          trans: 1,
          trans_t: 0,
          type: -1
        }
      }
    };
    
    const lyricResponse = await axios.post(lyricUrl, lyricBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const lyricData = lyricResponse.data;
    console.log('歌词响应 code:', lyricData.code, 'req code:', lyricData.req?.code);
    
    if (lyricData?.req?.code === 0) {
      const lrc = lyricData.req.data?.lyric || '';
      const tlrc = lyricData.req.data?.trans || '';
      
      if (lrc) {
        console.log('\n✅ 获取到歌词成功！');
        console.log('歌词长度:', lrc.length);
        
        // Base64 解码
        const decoded = Buffer.from(lrc, 'base64').toString('utf-8');
        console.log('\n解码后的歌词预览:');
        console.log('---');
        console.log(decoded.substring(0, 500));
        console.log('---');
        
        if (tlrc) {
          const tdecoded = Buffer.from(tlrc, 'base64').toString('utf-8');
          console.log('\n翻译歌词预览:');
          console.log('---');
          console.log(tdecoded.substring(0, 200));
          console.log('---');
        }
      } else {
        console.error('❌ 歌词内容为空');
      }
    } else {
      console.error(`❌ 请求失败：code = ${lyricData?.req?.code}`);
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testQQMusicLyric();
