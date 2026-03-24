/**
 * 完整流程测试 - 检查所有 IPC 数据
 */

const musicSdk = require('./src/musicSdk');

// 创建纯净的歌曲信息对象
function createCleanSongInfo(song) {
  const serialized = JSON.stringify({
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
  });
  return JSON.parse(serialized);
}

// 检查对象是否可序列化
function checkSerializable(obj, name = '对象') {
  console.log(`\n检查 ${name}:`);
  console.log('  类型:', typeof obj);

  // 检查函数
  const hasFunction = Object.values(obj).some(v => typeof v === 'function');
  console.log('  包含函数:', hasFunction ? '❌ 是' : '✅ 否');

  // 检查 undefined
  const hasUndefined = Object.values(obj).some(v => v === undefined);
  console.log('  包含 undefined:', hasUndefined ? '❌ 是' : '✅ 否');

  // 检查 Symbol
  const hasSymbol = Object.values(obj).some(v => typeof v === 'symbol');
  console.log('  包含 Symbol:', hasSymbol ? '❌ 是' : '✅ 否');

  // 检查循环引用
  let hasCircular = false;
  try {
    JSON.stringify(obj);
    console.log('  可 JSON 序列化:', '✅ 是');
    return true;
  } catch (error) {
    console.log('  可 JSON 序列化:', '❌ 否 -', error.message);
    return false;
  }
}

async function testCompleteFlow() {
  console.log('=== 完整流程测试 ===\n');

  // 1. 测试搜索
  console.log('【步骤 1】测试搜索...');
  const result = await musicSdk.searchMusic('周杰伦', 1, 2, 'tx');

  if (!result.list || result.list.length === 0) {
    console.log('❌ 搜索失败');
    return;
  }

  const song = result.list[0];
  console.log('✅ 搜索成功:', song.title, '-', song.artist);
  console.log('  歌曲 keys:', Object.keys(song).join(', '));

  // 2. 检查歌曲对象
  console.log('\n【步骤 2】检查歌曲对象...');
  checkSerializable(song, '歌曲对象');

  // 3. 创建纯净歌曲信息
  console.log('\n【步骤 3】创建纯净歌曲信息...');
  const cleanSong = createCleanSongInfo(song);
  console.log('纯净歌曲信息:', JSON.stringify(cleanSong));
  checkSerializable(cleanSong, '纯净歌曲信息');

  // 4. 准备请求数据
  console.log('\n【步骤 4】准备请求数据...');
  const requestData = {
    source: cleanSong.source,
    action: 'musicUrl',
    info: {
      type: '128k',
      musicInfo: cleanSong
    }
  };
  console.log('请求数据:', JSON.stringify(requestData, null, 2));
  checkSerializable(requestData, '请求数据');

  // 5. 模拟 IPC 发送的数据结构
  console.log('\n【步骤 5】模拟 IPC 发送...');
  const ipcData = {
    requestKey: `musicUrl_${Date.now()}_${cleanSong.source}`,
    data: requestData
  };
  console.log('IPC 数据 requestKey:', ipcData.requestKey);
  console.log('IPC 数据 source:', ipcData.data.source);
  checkSerializable(ipcData, 'IPC 数据');

  // 6. 模拟完整的 IPC 调用
  console.log('\n【步骤 6】模拟完整的 IPC 调用...');
  console.log('ipcRenderer.send 参数:');
  console.log('  参数 1 (apiId):', 'source_123456', typeof 'source_123456');
  console.log('  参数 2 (requestKey):', ipcData.requestKey, typeof ipcData.requestKey);
  console.log('  参数 3 (data):', typeof ipcData.data);

  // 检查所有参数是否可序列化
  const allParams = ['source_123456', ipcData.requestKey, ipcData.data];
  let allSerializable = true;
  allParams.forEach((param, index) => {
    const result = checkSerializable(param, `参数 ${index + 1}`);
    if (!result) allSerializable = false;
  });

  console.log('\n=== 测试完成 ===');

  if (allSerializable) {
    console.log('✅ 所有数据都可以序列化，IPC 调用应该成功');
  } else {
    console.log('❌ 存在不可序列化的数据，需要修复');
  }
}

testCompleteFlow().catch(error => {
  console.error('\n❌ 测试失败:', error.message);
  console.error(error.stack);
});
