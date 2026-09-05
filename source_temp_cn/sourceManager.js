/**
 * 音源管理器
 * 负责加载、卸载和切换音源脚本
 */

const { ipcRenderer } = require('electron');

class SourceManager {
  constructor() {
    this.currentSource = null;
    this.isReady = false;
  }

  /**
   * 创建纯净的歌曲信息对象（可序列化）
   * 使用 JSON.parse(JSON.stringify()) 确保所有属性都是可序列化的基本类型
   * @param {Object} song - 歌曲对象
   */
  createCleanSongInfo(song) {
    // 先通过 JSON 序列化/反序列化移除不可序列化的属性
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

  /**
   * 加载音源脚本
   * @param {Object} sourceInfo - 音源信息（包含 script 内容）
   */
  async loadSource(sourceInfo) {
    try {
      // 如果已有音源在运行，先卸载
      if (this.currentSource) {
        await this.unloadSource();
      }

      // 通过 IPC 加载音源脚本
      const result = await ipcRenderer.invoke('load-user-api', sourceInfo);

      if (result.success) {
        this.currentSource = sourceInfo;
        this.isReady = true;
        return true;
      } else {
        this.currentSource = null;
        this.isReady = false;
        throw new Error(result.error || '音源加载失败');
      }
    } catch (error) {
      this.currentSource = null;
      this.isReady = false;
      throw error;
    }
  }

  /**
   * 卸载当前音源
   */
  async unloadSource() {
    try {
      if (!this.currentSource) {
        return;
      }

      // 通过 IPC 卸载音源脚本
      const result = await ipcRenderer.invoke('unload-user-api', this.currentSource.id);

      this.currentSource = null;
      this.isReady = false;

      return result;
    } catch (error) {
      this.currentSource = null;
      this.isReady = false;
      throw error;
    }
  }

  /**
   * 切换音源（先卸载再加载）
   * @param {Object} newSourceInfo - 新的音源信息
   */
  async switchSource(newSourceInfo) {
    await this.loadSource(newSourceInfo);
  }

  /**
   * 获取当前加载的音源
   */
  getCurrentSource() {
    return this.currentSource;
  }

  /**
   * 检查音源是否就绪
   */
  isSourceReady() {
    return this.isReady && this.currentSource !== null;
  }

  /**
   * 请求音源脚本获取 URL
   * @param {string} source - 平台标识（tx/wy/kg）
   * @param {string} action - 动作（musicUrl/lyric/pic）
   * @param {Object} info - 请求信息
   */
  async request(source, action, info) {
    if (!this.isReady) {
      throw new Error('音源脚本未加载');
    }

    // 检查当前音源是否支持该平台
    if (this.currentSource && this.currentSource.sources) {
      const platformSupport = this.currentSource.sources[source];
      if (!platformSupport) {
        throw new Error(`当前音源不支持 ${source} 平台`);
      }
    }

    // 通过 window.userApiRendererEvent 调用音源脚本
    if (!window.userApiRendererEvent || !window.userApiRendererEvent.request) {
      throw new Error('音源脚本接口未就绪');
    }

    // 创建纯净的歌曲信息对象，避免 Vue 响应式代理对象导致序列化失败
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

    try {
      const result = await window.userApiRendererEvent.request({
        requestKey,
        data: requestData
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

// 创建单例
const sourceManager = new SourceManager();

module.exports = sourceManager;
