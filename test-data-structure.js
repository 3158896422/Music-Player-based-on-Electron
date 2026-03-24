/**
 * 完整流程测试 - 验证数据结构
 */

const musicSdk = require('./src/musicSdk');

// 创建纯净的歌曲信息对象
function createCleanSongInfo(song) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    songmid: song.songmid,
    hash: song.hash,
    source: song.source,
    cover: song.cover,
    albummid: song.albummid
  };
}

// 验证数据结构
function validateDataStructure() {
  console.log('=== 验证数据结构 ===\n');

  // 模拟歌曲对象（可能包含不可枚举属性）
  const rawSong = {
    id: '0039MnYb0qxYhV',
    title: '晴天',
    artist: '周杰伦',
    album: '叶惠美',
    duration: '04:29',
    songmid: '0039MnYb0qxYhV',
    albummid: '0039MnYb0qxYhV',
    source: 'tx',
    cover: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000039MnYb0qxYhV.jpg'
  };

  // 模拟 Vue 响应式对象（可能有隐藏属性）
  const vueSong = {
    __v_isRef: true,
    __isRef: true,
    ...rawSong
  };

  console.log('原始歌曲对象 keys:', Object.keys(vueSong));
  console.log('歌曲对象可枚举属性:', Object.keys(vueSong).filter(k => !k.startsWith('__')));

  // 创建纯净对象
  const cleanSong = createCleanSongInfo(vueSong);
  console.log('纯净对象:', cleanSong);

  // 验证 JSON 序列化
  try {
    const json = JSON.stringify(cleanSong);
    console.log('\n✅ JSON 序列化成功:', json.length, '字符');
  } catch (error) {
    console.log('\n❌ JSON 序列化失败:', error.message);
  }

  // 验证 IPC 数据结构
  const requestData = {
    source: cleanSong.source,
    action: 'musicUrl',
    info: {
      type: '128k',
      musicInfo: cleanSong
    }
  };

  try {
    const json = JSON.stringify(requestData);
    console.log('✅ IPC 数据结构序列化成功:', json.length, '字符');
  } catch (error) {
    console.log('❌ IPC 数据结构序列化失败:', error.message);
  }

  console.log('\n=== 数据结构验证完成 ===');
}

async function testSearchAndPrepare() {
  console.log('=== 测试搜索并准备数据结构 ===\n');

  try {
    // 测试搜索
    const result = await musicSdk.searchMusic('周杰伦', 1, 2, 'tx');

    if (result.list && result.list.length > 0) {
      const song = result.list[0];

      console.log('搜索到的歌曲:');
      console.log('  标题:', song.title);
      console.log('  歌手:', song.artist);
      console.log('  平台:', song.source);
      console.log('  ID:', song.songmid || song.id);
      console.log('  Keys:', Object.keys(song).join(', '));

      // 创建纯净的歌曲信息
      const cleanSong = createCleanSongInfo(song);
      console.log('\n创建的纯净歌曲信息:');
      console.log('  Keys:', Object.keys(cleanSong).join(', '));

      // 验证可以序列化
      try {
        const json = JSON.stringify(cleanSong);
        console.log('\n✅ 歌曲信息可以 JSON 序列化:', json.length, '字符');
      } catch (error) {
        console.log('\n❌ 歌曲信息序列化失败:', error.message);
      }

      // 准备请求数据
      const requestData = {
        source: cleanSong.source,
        action: 'musicUrl',
        info: {
          type: '128k',
          musicInfo: cleanSong
        }
      };

      console.log('\n请求数据结构:');
      console.log(JSON.stringify(requestData, null, 2));

      // 验证可以序列化
      try {
        const json = JSON.stringify(requestData);
        console.log('\n✅ 请求数据可以序列化');
      } catch (error) {
        console.log('\n❌ 请求数据序列化失败:', error.message);
      }

    } else {
      console.log('❌ 未找到歌曲');
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
}

// 运行测试
validateDataStructure();
console.log('\n');
testSearchAndPrepare().catch(console.error);
