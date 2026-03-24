/**
 * 完整的集成测试 - 模拟整个流程
 */

const musicSdk = require('./src/musicSdk');
const { ipcRenderer } = require('electron');

// 模拟音源脚本
const mockSourceScript = `
const { ipcRenderer } = require('electron');

global.lx = {
  EVENT_NAMES: {
    request: 'request',
    inited: 'inited',
    updateAlert: 'updateAlert',
  },
  async request(url, options, callback) {
    console.log('[Mock] lx.request called:', url);
    callback.call(this, null, { statusCode: 200, body: { url: 'https://example.com/test.mp3' } }, { url: 'https://example.com/test.mp3' });
  },
  send(eventName, data) {
    console.log('[Mock] lx.send called:', eventName, data);
    ipcRenderer.send('sandbox-event', eventName, data);
    return Promise.resolve();
  },
  on(eventName, handler) {
    console.log('[Mock] lx.on called:', eventName);
    if (eventName === this.EVENT_NAMES.request) {
      this._requestHandler = handler;
    }
    return Promise.resolve();
  },
  utils: {},
  currentScriptInfo: { name: 'Test Source', version: '1.0.0' },
  version: '2.0.0',
  env: 'desktop'
};

ipcRenderer.send('preload-ready');
console.log('[Mock] Preload script loaded');
`;

// 模拟 SourceManager
class TestSourceManager {
  constructor() {
    this.currentSource = null;
    this.isReady = false;
  }

  createCleanSongInfo(song) {
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

  setReady(source) {
    this.currentSource = source;
    this.isReady = true;
    console.log('[TestSourceManager] 音源已就绪:', source.name);
  }

  async request(source, action, info) {
    if (!this.isReady) {
      throw new Error('音源脚本未加载');
    }

    // 创建纯净的歌曲信息对象
    const cleanInfo = {
      type: info.type,
      musicInfo: info.musicInfo ? this.createCleanSongInfo(info.musicInfo) : null
    };

    const requestKey = `${action}_${Date.now()}_${source}`;
    const requestData = {
      source,
      action,
      info: cleanInfo
    };

    console.log('[TestSourceManager] 发送请求:', {
      requestKey,
      source,
      action,
      info: cleanInfo
    });

    // 模拟 IPC 调用
    console.log('[TestSourceManager] 准备 IPC 数据...');

    // 检查数据结构
    console.log('[TestSourceManager] requestData 是 plain object:', JSON.stringify(requestData) !== '{}');

    // 尝试 JSON.stringify
    try {
      const jsonStr = JSON.stringify(requestData);
      console.log('[TestSourceManager] ✅ JSON.stringify 成功:', jsonStr.length, '字符');
    } catch (error) {
      console.log('[TestSourceManager] ❌ JSON.stringify 失败:', error.message);
    }

    // 模拟异步返回
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 模拟音源返回的 URL
        resolve('https://example.com/test.mp3');
      }, 100);
    });
  }
}

async function testCompleteFlow() {
  console.log('=== 完整集成测试 ===\n');

  const testManager = new TestSourceManager();

  // 1. 测试搜索
  console.log('【步骤 1】测试搜索...\n');
  try {
    const result = await musicSdk.searchMusic('周杰伦', 1, 3, 'tx');
    if (result.list && result.list.length > 0) {
      const song = result.list[0];
      console.log('✅ 搜索成功:', song.title, '-', song.artist);
      console.log('   歌曲信息 keys:', Object.keys(song).join(', '));

      // 2. 模拟加载音源
      console.log('\n【步骤 2】模拟加载音源...\n');
      testManager.setReady({
        id: 'source_123',
        name: '测试音源',
        script: mockSourceScript  // 这是一个字符串
      });

      // 3. 测试请求 URL
      console.log('\n【步骤 3】测试请求 URL...\n');
      try {
        const url = await testManager.request('tx', 'musicUrl', {
          type: '128k',
          musicInfo: song
        });
        console.log('✅ 获取 URL 成功:', url);
      } catch (error) {
        console.log('❌ 获取 URL 失败:', error.message);
      }

    } else {
      console.log('❌ 搜索失败: 未找到结果');
    }
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
  }

  console.log('\n=== 测试完成 ===');
}

testCompleteFlow().catch(console.error);
