/**
 * 测试内置搜索 API 和音源脚本集成
 */

const musicSdk = require('./src/musicSdk');

async function testSearchAndUrl() {
  console.log('=== 开始测试内置搜索 API 和音源脚本集成 ===\n');
  
  // 测试搜索
  console.log('1. 测试搜索功能...');
  const platforms = ['tx', 'wy', 'kg', 'kw'];
  
  for (const platform of platforms) {
    try {
      console.log(`\n测试 ${platform} 搜索...`);
      const result = await musicSdk.searchMusic('周杰伦 青花瓷', 1, 5, platform);
      
      if (result.list && result.list.length > 0) {
        const song = result.list[0];
        console.log(`✅ ${platform} 搜索成功:`);
        console.log(`   歌曲：${song.title} - ${song.artist}`);
        console.log(`   专辑：${song.album}`);
        console.log(`   时长：${song.duration}`);
        console.log(`   ID: ${song.songmid || song.id || song.hash}`);
        console.log(`   封面：${song.cover ? '有' : '无'}`);
        
        // 测试获取 URL
        console.log(`\n测试 ${platform} URL 获取...`);
        try {
          const urlData = await musicSdk.getMusicUrl(song, '128k');
          console.log(`✅ ${platform} URL 获取成功:`);
          console.log(`   URL 长度：${urlData.url?.length || 0}`);
          console.log(`   音质：${urlData.quality}`);
          console.log(`   平台：${urlData.source}`);
        } catch (error) {
          console.error(`❌ ${platform} URL 获取失败：`, error.message);
        }
      } else {
        console.log(`❌ ${platform} 未找到歌曲`);
      }
    } catch (error) {
      console.error(`❌ ${platform} 搜索失败：`, error.message);
    }
  }
  
  console.log('\n=== 测试完成 ===');
  console.log('\n说明：');
  console.log('1. 搜索功能使用官方 API');
  console.log('2. 获取 URL 时，如果安装了自定义音源脚本，会优先使用音源脚本');
  console.log('3. 如果音源脚本不可用，会回退到内置 SDK');
  console.log('4. 播放和下载功能会自动调用音源脚本获取 URL');
}

testSearchAndUrl().catch(console.error);
