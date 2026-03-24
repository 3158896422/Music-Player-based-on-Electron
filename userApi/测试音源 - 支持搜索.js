/**
 * @name 测试音源 - 支持搜索
 * @description 用于测试搜索功能的示例音源
 * @version 1.0.0
 * @author Test
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx;

// 模拟音乐数据
const mockMusicData = [
  {
    id: '1',
    title: '测试歌曲 1',
    artist: '歌手 A',
    album: '专辑 1',
    duration: '03:45',
    cover: ''
  },
  {
    id: '2',
    title: '测试歌曲 2',
    artist: '歌手 B',
    album: '专辑 2',
    duration: '04:20',
    cover: ''
  },
  {
    id: '3',
    title: '周杰伦 - 测试歌曲',
    artist: '周杰伦',
    album: '测试专辑',
    duration: '05:10',
    cover: ''
  }
];

// 注册 request 处理器 - 必须返回 Promise
on(EVENT_NAMES.request, ({ source, action, info }) => {
  console.log('收到请求:', source, action, info);
  
  return new Promise((resolve, reject) => {
    switch (action) {
      case 'search':
        // 处理搜索请求
        const keyword = info.keyword || '';
        const page = info.page || 1;
        const type = info.type || 'music';
        
        console.log('搜索:', keyword, page, type);
        
        // 简单模拟搜索结果
        const results = mockMusicData.filter(song => {
          return song.title.includes(keyword) || song.artist.includes(keyword);
        });
        
        console.log('搜索结果:', results);
        resolve(results);
        break;
        
      case 'musicUrl':
        // 处理获取音乐 URL 请求
        const musicInfo = info.musicInfo;
        const quality = info.type;
        
        console.log('获取音乐 URL:', musicInfo, quality);
        
        // 返回一个示例 URL（这里使用一个示例音频文件）
        resolve('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
        break;
        
      case 'lyric':
        // 处理获取歌词请求
        resolve({
          lyric: '[00:00.00] 测试歌词\n[00:05.00] 这是示例歌词',
          tlyric: '',
          rlyric: '',
          lxlyric: ''
        });
        break;
        
      case 'pic':
        // 处理获取封面图片请求
        resolve('https://via.placeholder.com/300x300?text=Music');
        break;
        
      default:
        reject(new Error('不支持的操作：' + action));
    }
  });
});

// 发送初始化事件
send(EVENT_NAMES.inited, {
  sources: {
    kw: {
      name: '测试音源',
      type: 'music',
      actions: ['search', 'musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac']
    },
    kg: {
      name: '测试音源',
      type: 'music',
      actions: ['search', 'musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac']
    },
    tx: {
      name: '测试音源',
      type: 'music',
      actions: ['search', 'musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac']
    },
    wy: {
      name: '测试音源',
      type: 'music',
      actions: ['search', 'musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac']
    },
    mg: {
      name: '测试音源',
      type: 'music',
      actions: ['search', 'musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac']
    }
  }
});

console.log('测试音源初始化完成');
