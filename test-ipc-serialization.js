/**
 * 测试 IPC 序列化问题
 */

// 模拟 Vue 响应式代理对象
function createVueProxy(obj) {
  return new Proxy(obj, {
    get(target, prop) {
      return target[prop];
    },
    has(target, prop) {
      return prop in target;
    }
  });
}

// 模拟 SourceManager 的 createCleanSongInfo 方法
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

async function testIPCSerialization() {
  console.log('=== 测试 IPC 序列化问题 ===\n');

  // 1. 创建模拟的歌曲数据
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

  // 2. 模拟 Vue 响应式代理对象
  const vueProxySong = createVueProxy(rawSong);

  console.log('原始歌曲信息:');
  console.log(JSON.stringify(rawSong, null, 2));
  console.log('\nVue 代理对象:');
  console.log('Type:', typeof vueProxySong);
  console.log('Keys:', Object.keys(vueProxySong));

  // 3. 测试 JSON.stringify
  console.log('\n测试 JSON.stringify:');
  try {
    const jsonString = JSON.stringify(vueProxySong);
    console.log('✅ JSON.stringify 成功:', jsonString.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ JSON.stringify 失败:', error.message);
  }

  // 4. 测试创建纯净对象
  console.log('\n创建纯净对象:');
  const cleanSong = createCleanSongInfo(vueProxySong);
  console.log('纯净对象:', JSON.stringify(cleanSong, null, 2));

  // 5. 测试 JSON.stringify 纯净对象
  console.log('\n测试 JSON.stringify 纯净对象:');
  try {
    const jsonString = JSON.stringify(cleanSong);
    console.log('✅ JSON.stringify 成功:', jsonString.length, '字符');
  } catch (error) {
    console.log('❌ JSON.stringify 失败:', error.message);
  }

  // 6. 模拟 IPC 传输
  console.log('\n模拟 IPC 传输:');
  try {
    // 模拟 ipcRenderer.invoke
    const result = JSON.parse(JSON.stringify({
      requestKey: 'musicUrl_123456_tx',
      data: {
        source: cleanSong.source,
        action: 'musicUrl',
        info: {
          type: '128k',
          musicInfo: cleanSong
        }
      }
    }));
    console.log('✅ IPC 数据准备成功:', JSON.stringify(result, null, 2).substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ IPC 数据准备失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
  console.log('\n结论:');
  console.log('1. Vue 响应式代理对象本身可以 JSON.stringify');
  console.log('2. 但通过 IPC 传递时，Electron 的结构化克隆算法可能会失败');
  console.log('3. 解决方案：创建纯净的普通对象，只包含基本类型');
  console.log('4. 使用 JSON.parse(JSON.stringify(obj)) 可以移除不可序列化的属性');
}

testIPCSerialization().catch(console.error);
