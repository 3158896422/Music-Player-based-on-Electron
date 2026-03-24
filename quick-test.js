/**
 * 快速测试 SDK
 */

const musicSdk = require('./src/musicSdk');

async function quickTest() {
  console.log('测试酷狗音乐...');
  try {
    const kgResult = await musicSdk.searchMusic('周杰伦', 1, 1, 'kg');
    console.log('酷狗搜索结果:', kgResult.list?.[0]?.title);
    console.log('封面:', kgResult.list?.[0]?.cover);
    
    if (kgResult.list && kgResult.list.length > 0) {
      const song = kgResult.list[0];
      const urlData = await musicSdk.getMusicUrl(song, '128k');
      console.log('✅ 酷狗 URL 获取成功:', urlData.url ? '有 URL' : '无 URL');
    }
  } catch (error) {
    console.error('❌ 酷狗失败:', error.message);
  }
  
  console.log('\n测试网易云音乐...');
  try {
    const wyResult = await musicSdk.searchMusic('周杰伦', 1, 1, 'wy');
    console.log('网易云搜索结果:', wyResult.list?.[0]?.title);
    console.log('封面:', wyResult.list?.[0]?.cover);
    
    if (wyResult.list && wyResult.list.length > 0) {
      const song = wyResult.list[0];
      const urlData = await musicSdk.getMusicUrl(song, '128k');
      console.log('✅ 网易云 URL 获取成功:', urlData.url ? '有 URL' : '无 URL');
    }
  } catch (error) {
    console.error('❌ 网易云失败:', error.message);
  }
  
  console.log('\n测试 QQ 音乐...');
  try {
    const txResult = await musicSdk.searchMusic('周杰伦', 1, 1, 'tx');
    console.log('QQ 音乐搜索结果:', txResult.list?.[0]?.title);
    console.log('封面:', txResult.list?.[0]?.cover);
    
    if (txResult.list && txResult.list.length > 0) {
      const song = txResult.list[0];
      const urlData = await musicSdk.getMusicUrl(song, '128k');
      console.log('✅ QQ 音乐 URL 获取成功:', urlData.url ? '有 URL' : '无 URL');
    }
  } catch (error) {
    console.error('❌ QQ 音乐失败:', error.message);
  }
}

quickTest();
