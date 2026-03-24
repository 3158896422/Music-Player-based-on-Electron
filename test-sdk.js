/**
 * SDK 测试脚本
 * 测试各大音乐平台的搜索和播放功能
 */

const musicSdk = require('./src/musicSdk');

async function testSearch() {
  console.log('\n=== 开始测试音乐搜索 ===\n');
  
  const keyword = '周杰伦';
  
  // 测试单个平台
  console.log('测试 QQ 音乐搜索...');
  try {
    const txResult = await musicSdk.searchMusic(keyword, 1, 5, 'tx');
    console.log('✅ QQ 音乐搜索成功:', txResult.list?.length || 0, '首歌曲');
    if (txResult.list && txResult.list.length > 0) {
      console.log('  示例:', txResult.list[0].title, '-', txResult.list[0].artist);
    }
  } catch (error) {
    console.error('❌ QQ 音乐搜索失败:', error.message);
  }
  
  console.log('\n测试酷狗音乐搜索...');
  try {
    const kgResult = await musicSdk.searchMusic(keyword, 1, 5, 'kg');
    console.log('✅ 酷狗音乐搜索成功:', kgResult.list?.length || 0, '首歌曲');
    if (kgResult.list && kgResult.list.length > 0) {
      console.log('  示例:', kgResult.list[0].title, '-', kgResult.list[0].artist);
    }
  } catch (error) {
    console.error('❌ 酷狗音乐搜索失败:', error.message);
  }
  
  console.log('\n测试酷我音乐搜索...');
  try {
    const kwResult = await musicSdk.searchMusic(keyword, 1, 5, 'kw');
    console.log('✅ 酷我音乐搜索成功:', kwResult.list?.length || 0, '首歌曲');
    if (kwResult.list && kwResult.list.length > 0) {
      console.log('  示例:', kwResult.list[0].title, '-', kwResult.list[0].artist);
    }
  } catch (error) {
    console.error('❌ 酷我音乐搜索失败:', error.message);
  }
  
  console.log('\n测试网易云音乐搜索...');
  try {
    const wyResult = await musicSdk.searchMusic(keyword, 1, 5, 'wy');
    console.log('✅ 网易云音乐搜索成功:', wyResult.list?.length || 0, '首歌曲');
    if (wyResult.list && wyResult.list.length > 0) {
      console.log('  示例:', wyResult.list[0].title, '-', wyResult.list[0].artist);
    }
  } catch (error) {
    console.error('❌ 网易云音乐搜索失败:', error.message);
  }
}

async function testMusicUrl() {
  console.log('\n=== 开始测试获取播放 URL ===\n');
  
  // 先搜索一首歌
  console.log('搜索歌曲...');
  const searchResult = await musicSdk.searchMusic('周杰伦 青花瓷', 1, 1, 'tx');
  
  if (searchResult.list && searchResult.list.length > 0) {
    const song = searchResult.list[0];
    console.log('找到歌曲:', song.title, '-', song.artist);
    
    try {
      console.log('获取播放 URL...');
      const urlResult = await musicSdk.getMusicUrl(song, '128k');
      console.log('✅ 获取 URL 成功:', urlResult.url ? '有 URL' : '无 URL');
      console.log('  URL 长度:', urlResult.url?.length || 0);
    } catch (error) {
      console.error('❌ 获取 URL 失败:', error.message);
    }
  } else {
    console.log('❌ 未找到歌曲');
  }
}

async function testLyric() {
  console.log('\n=== 开始测试获取歌词 ===\n');
  
  // 先搜索一首歌
  console.log('搜索歌曲...');
  const searchResult = await musicSdk.searchMusic('周杰伦 青花瓷', 1, 1, 'tx');
  
  if (searchResult.list && searchResult.list.length > 0) {
    const song = searchResult.list[0];
    console.log('找到歌曲:', song.title, '-', song.artist);
    
    try {
      console.log('获取歌词...');
      const lyricResult = await musicSdk.getLyric(song);
      console.log('✅ 获取歌词成功');
      console.log('  歌词前 100 字:', lyricResult.lyric?.substring(0, 100));
    } catch (error) {
      console.error('❌ 获取歌词失败:', error.message);
    }
  } else {
    console.log('❌ 未找到歌曲');
  }
}

async function runAllTests() {
  try {
    await testSearch();
    await testMusicUrl();
    await testLyric();
    
    console.log('\n=== 所有测试完成 ===\n');
  } catch (error) {
    console.error('测试过程出错:', error);
  }
}

// 运行测试
runAllTests();
