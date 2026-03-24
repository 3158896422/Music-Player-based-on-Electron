/**
 * 测试歌曲信息传递给音源脚本获取 URL
 */

console.log('=== 开始测试歌曲信息传递给音源脚本获取 URL ===\n');

// 模拟歌曲信息
const mockSongInfo = {
  id: '123456',
  songmid: 'M500123456',
  hash: 'A1B2C3D4E5',
  title: '测试歌曲',
  artist: '测试歌手',
  album: '测试专辑',
  duration: '03:59',
  source: 'tx',  // 平台标识
  cover: 'https://example.com/cover.jpg'
};

console.log('模拟歌曲信息:');
console.log(JSON.stringify(mockSongInfo, null, 2));

console.log('\n=== 测试流程 ===');
console.log('1. 搜索功能由 musicSdk 提供（使用官方 API）');
console.log('2. 播放/下载时必须通过音源脚本获取 URL');
console.log('3. 传递给音源脚本的参数格式:');
console.log(JSON.stringify({
  source: mockSongInfo.source,
  action: 'musicUrl',
  info: {
    type: '128k',
    musicInfo: mockSongInfo
  }
}, null, 2));

console.log('\n=== 支持的音源平台 ===');
console.log('- QQ 音乐 (tx)');
console.log('- 网易云音乐 (wy)');
console.log('- 酷狗音乐 (kg)');

console.log('\n=== 注意事项 ===');
console.log('1. 必须先导入自定义音源脚本');
console.log('2. 音源脚本必须实现 musicUrl action');
console.log('3. 音源脚本会收到完整的歌曲信息');
console.log('4. 音源脚本必须返回 URL 字符串');

console.log('\n=== 测试完成 ===');
