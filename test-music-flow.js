/**
 * 测试音乐搜索和 URL 获取完整流程
 */

const musicSdk = require('./src/musicSdk');

async function testCompleteFlow() {
  console.log('=== 开始测试完整流程 ===\n');

  // 1. 测试搜索功能
  console.log('【步骤 1】测试搜索功能...\n');

  const platforms = [
    { id: 'tx', name: 'QQ 音乐' },
    { id: 'kg', name: '酷狗音乐' },
    { id: 'wy', name: '网易云音乐' }
  ];

  for (const platform of platforms) {
    try {
      console.log(`测试 ${platform.name} 搜索...`);
      const result = await musicSdk.searchMusic('周杰伦', 1, 3, platform.id);

      if (result.list && result.list.length > 0) {
        const song = result.list[0];
        console.log(`✅ ${platform.name} 搜索成功`);
        console.log(`   歌曲: ${song.title} - ${song.artist}`);
        console.log(`   平台: ${song.source}`);
        console.log(`   ID: ${song.songmid || song.id || song.hash}`);

        // 打印完整的歌曲信息，查看哪些字段不可序列化
        console.log(`   歌曲信息 keys: ${Object.keys(song).join(', ')}`);

        // 测试传递歌曲信息对象
        console.log(`\n   测试传递歌曲信息到音源脚本...`);
        console.log(`   歌曲信息示例:`);
        console.log(`   - id: ${typeof song.id} = ${song.id}`);
        console.log(`   - title: ${typeof song.title} = ${song.title}`);
        console.log(`   - artist: ${typeof song.artist} = ${song.artist}`);
        console.log(`   - album: ${typeof song.album} = ${song.album}`);
        console.log(`   - duration: ${typeof song.duration} = ${song.duration}`);
        console.log(`   - songmid: ${typeof song.songmid} = ${song.songmid}`);
        console.log(`   - hash: ${typeof song.hash} = ${song.hash}`);
        console.log(`   - source: ${typeof song.source} = ${song.source}`);
        console.log(`   - cover: ${typeof song.cover} = ${song.cover ? (song.cover.substring(0, 50) + '...') : 'null'}`);

        // 创建纯净的歌曲信息对象（只包含可序列化的字段）
        const cleanSongInfo = {
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

        console.log(`\n   纯净的歌曲信息 keys: ${Object.keys(cleanSongInfo).join(', ')}`);
        console.log(`   JSON.stringify 测试: ${JSON.stringify(cleanSongInfo).length} 字符`);

        console.log('\n');
      } else {
        console.log(`❌ ${platform.name} 搜索失败: 未找到结果\n`);
      }
    } catch (error) {
      console.log(`❌ ${platform.name} 搜索失败: ${error.message}\n`);
    }
  }

  // 2. 总结问题
  console.log('=== 测试完成 ===\n');
  console.log('问题分析:');
  console.log('1. IPC 传递歌曲信息时，对象中可能包含不可序列化的数据');
  console.log('2. 需要创建纯净的歌曲信息对象，只包含基本类型和字符串');
  console.log('3. 需要检查 sourceManager.request 中传递的数据结构');
  console.log('\n解决方案:');
  console.log('在传递歌曲信息前，创建一个纯净的可序列化对象');
  console.log('移除所有函数、Symbol、undefined 等不可序列化的字段');
}

testCompleteFlow().catch(console.error);
