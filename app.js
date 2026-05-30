const { createApp, ref, computed, onMounted, onUnmounted, nextTick, watch } = Vue;
const { ipcRenderer } = require('electron');
const path = require('path');
const musicSdk = require('./src/musicSdk');
const sourceManager = require('./sourceManager');

// 导入 userApiRendererEvent 并暴露到 window
const userApiRendererEvent = require('./userApi/rendererEvent');
window.userApiRendererEvent = userApiRendererEvent;

const app = createApp({
  setup() {
    const musicFiles = ref([]);
    const currentSongIndex = ref(-1);
    const selectedSongIndex = ref(-1);
    const isPlaying = ref(false);
    const playMode = ref(0);
    const currentTime = ref(0);
    const totalTime = ref(0);
    const volume = ref(100);
    const showFullscreen = ref(false);
    const isExitingFullscreen = ref(false);
    const currentView = ref('library');
    const spectrumCanvas = ref(null);
    const waveScale = ref(0);
    const waveOpacity = ref(0.8);
    const waveDuration = ref(2);
    const sidebar = ref(null);
    const isResizing = ref(false);
    const minSidebarWidth = 200;
    const maxSidebarWidth = 400;
    const currentAlbum = ref(null);
    const currentArtist = ref(null);
    const showAlbumDetail = ref(false);
    const showArtistDetail = ref(false);
    const showPlaylist = ref(false);
    const currentTheme = ref('dark');
    const favorites = ref([]);
    const recentlyPlayed = ref([]);
    
    // 播放上下文
    const currentPlayContext = ref('library'); // library, album, artist, favorites, recent, builtin
    const currentContextSongs = ref([]);
    const currentContextIndex = ref(-1);
    const currentBuiltinSong = ref(null);
    
    // 歌词相关
    const showSubtitles = ref(false);
    const lyricsContainer = ref(null);
    const lyricsContent = ref(null);
    const lyricsLines = ref([]);
    const currentLyricIndex = ref(-1);
    let lyricsScrollSensitivity = 3.0; // 滚轮灵敏度，数值越大滚动越快
    let lastUserLyricsActionTime = 0; // 用户最后一次操作歌词栏的时间戳
    let autoScrollTimer = null; // 自动滚动计时器
    
    // 歌单相关
    const playlists = ref([]);
    const currentPlaylistId = ref(null);
    const showCreatePlaylistModal = ref(false);
    const isEditingPlaylist = ref(false);
    const newPlaylistName = ref('');
    const newPlaylistDescription = ref('');
    const newPlaylistNameInput = ref(null);
    const editingPlaylistId = ref(null);
    const showPlaylistContextMenuVisible = ref(false);
    const playlistContextMenuStyle = ref({});
    const currentPlaylistForMenu = ref(null);
    const showMoreMenuVisible = ref(false);
    const showAlertModal = ref(false);
    const alertTitle = ref('提示');
    const alertMessage = ref('');
    const showConfirmModal = ref(false);
    const confirmTitle = ref('确认');
    const confirmMessage = ref('');
    let confirmCallback = null;
    const showQualitySelectModal = ref(false);
    const qualitySelectSong = ref(null);
    let qualitySelectCallback = null;
    const showImportTypeModal = ref(false);
    const settings = ref({
      theme: 'dark',
      defaultPlayMode: 0,
      autoPlayNext: true,
      defaultVolume: 100,
      playQuality: '320k'
    });

    // 监听设置变化，自动保存
    watch(settings, (newSettings) => {
      localStorage.setItem('musicPlayer_settings', JSON.stringify(newSettings));
      applyThemeSetting();
      playMode.value = parseInt(newSettings.defaultPlayMode);
      volume.value = newSettings.defaultVolume;
    }, { deep: true });

    // 加载保存的设置
    const loadSettings = () => {
      const saved = localStorage.getItem('musicPlayer_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          settings.value = { ...settings.value, ...parsed };
          applyThemeSetting();
          playMode.value = parseInt(settings.value.defaultPlayMode);
          volume.value = settings.value.defaultVolume;
        } catch (e) {
          console.error('加载设置失败:', e);
        }
      }
    };
    const showDeleteMenuVisible = ref(false);
    const showAddToPlaylistMenuVisible = ref(false);
    const showSongDetailModal = ref(false);
    const moreMenuStyle = ref({});
    const deleteMenuStyle = ref({});
    const addToPlaylistMenuStyle = ref({});
    const currentSongForMenu = ref(null);

    // 音源相关
    const importedSources = ref([]);
    const currentSourceId = ref(null);
    const searchQuery = ref('');
    const sourceSearchResults = ref([]);
    const isSearching = ref(false);
    let sourceSandbox = null;
    
    // 异步播放操作取消令牌
    let pendingPlayToken = { cancelled: false };
    
    // 状态栏焦点跟踪 - 用于控制空格键是否触发播放暂停
    const isPlayerBarFocused = ref(false);
    
    // 加载默认音源
    const loadDefaultSources = async () => {
      try {
        const path = require('path');
        const defaultSourcesPath = path.join(__dirname, 'default-sources');
        
        const fs = require('fs');
        if (!fs.existsSync(defaultSourcesPath)) {
          console.log('[app.js] 默认音源目录不存在:', defaultSourcesPath);
          return;
        }

        const files = fs.readdirSync(defaultSourcesPath);
        console.log('[app.js] 默认音源目录文件列表:', files);
        let hasNewSources = false;

        for (const file of files) {
          if (!file.endsWith('.js')) continue;

          const filePath = path.join(defaultSourcesPath, file);
          console.log('[app.js] 处理默认音源文件:', filePath);

          try {
            const result = await ipcRenderer.invoke('read-source-file', filePath);
            if (!result.success) {
              console.error('[app.js] 读取默认音源文件失败:', file, result.error);
              continue;
            }

            const content = result.content;
            const fileName = path.basename(file, '.js');
            let scriptInfo = { name: fileName };
            try {
              scriptInfo = parseScriptInfo(content);
            } catch (e) {
              console.log('[app.js] 解析脚本信息失败，使用文件名:', e.message);
            }

            const sourceName = scriptInfo.name || fileName;
            const existingSource = importedSources.value.find(s => s.name === sourceName);
            if (existingSource) {
              console.log('[app.js] 默认音源已存在，跳过:', sourceName);
              continue;
            }

            const sourceInfo = {
              id: `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: sourceName,
              version: scriptInfo.version || '1.0.0',
              author: scriptInfo.author || '',
              description: scriptInfo.description || '',
              script: content,
              filePath: filePath,
              type: 'default'
            };

            importedSources.value.push(sourceInfo);
            hasNewSources = true;

            try {
              await ipcRenderer.invoke('register-source', sourceInfo);
              console.log('[app.js] 默认音源注册成功:', sourceInfo.name);
            } catch (error) {
              console.error('[app.js] 注册默认音源失败:', sourceInfo.name, error.message);
            }
          } catch (error) {
            console.error('[app.js] 处理默认音源文件失败:', file, error.message);
          }
        }

        if (hasNewSources) {
          saveSourcesToStorage();
          console.log('[app.js] 默认音源已保存到本地存储');
        } else {
          console.log('[app.js] 没有新的默认音源需要添加');
        }
      } catch (error) {
        console.error('[app.js] 加载默认音源失败:', error.message);
      }
    };
    
    // 内置音源搜索相关
    const builtinSearchSource = ref('all'); // all, kg, tx, kw, wy
    const isBuiltinSearching = ref(false);
    const builtinSearchResults = ref([]);
    
    let audio = null;
    let audioContext = null;
    let analyser = null;
    let source = null;
    let animationId = null;
    let previousVolume = 100;
    let shuffledIndices = [];
    let recentlyPlayedIndices = []; // 最近播放的索引
    const downloadStatusCache = new Map(); // 缓存下载状态

    const currentSong = computed(() => {
      if (currentPlayContext.value === 'builtin') {
        return currentBuiltinSong.value;
      }
      // 如果是从歌单播放在线歌曲（没有 path），从 currentContextSongs 中获取
      if (['favorites', 'recent', 'playlist'].includes(currentPlayContext.value)) {
        if (currentContextIndex.value >= 0 && currentContextIndex.value < currentContextSongs.value.length) {
          const song = currentContextSongs.value[currentContextIndex.value];
          // 在线歌曲没有 path 属性
          if (song && !song.path) {
            return song;
          }
        }
      }
      if (currentSongIndex.value >= 0 && currentSongIndex.value < musicFiles.value.length) {
        return musicFiles.value[currentSongIndex.value];
      }
      return null;
    });

    // 判断播放列表中的歌曲是否正在播放
    const isPlaylistItemPlaying = (song, index) => {
      // 如果是本地音乐（有 path）
      if (song.path) {
        // 检查是否正在播放本地音乐
        if (currentPlayContext.value === 'library') {
          return currentSongIndex.value >= 0 && 
                 musicFiles.value[currentSongIndex.value]?.path === song.path;
        }
        // 如果是从 favorites/recent/playlist 播放的本地音乐
        if (['favorites', 'recent', 'playlist'].includes(currentPlayContext.value)) {
          // 检查索引是否匹配
          if (currentContextIndex.value === index) {
            // 再检查是否是同一首歌
            const currentSong = currentContextSongs.value[currentContextIndex.value];
            return currentSong && currentSong.path === song.path;
          }
          return false;
        }
        // 如果是 builtin 上下文播放的本地音乐
        if (currentPlayContext.value === 'builtin') {
          if (currentBuiltinSong.value && currentBuiltinSong.value.path === song.path) {
            return true;
          }
        }
        return false;
      }
      // 如果是在线歌曲（没有 path），统一从 builtin 上下文判断
      if (currentPlayContext.value === 'builtin') {
        // 检查是否是当前播放的歌曲
        if (currentBuiltinSong.value) {
          // 通过 hash、id 或 songmid 匹配
          if (song.hash && currentBuiltinSong.value.hash && song.hash === currentBuiltinSong.value.hash) return true;
          if (song.id && currentBuiltinSong.value.id && song.id === currentBuiltinSong.value.id) return true;
          if (song.songmid && currentBuiltinSong.value.songmid && song.songmid === currentBuiltinSong.value.songmid) return true;
          return song.title === currentBuiltinSong.value.title && song.artist === currentBuiltinSong.value.artist;
        }
        return false;
      }
      // 如果是从 favorites/recent/playlist 播放的在线歌曲（理论上不应该出现，因为在线歌曲现在都使用 builtin 上下文）
      if (['favorites', 'recent', 'playlist'].includes(currentPlayContext.value)) {
        if (currentContextIndex.value === index) {
          const currentSong = currentContextSongs.value[currentContextIndex.value];
          if (!currentSong) return false;
          if (song.hash && currentSong.hash && song.hash === currentSong.hash) return true;
          if (song.id && currentSong.id && song.id === currentSong.id) return true;
          if (song.songmid && currentSong.songmid && song.songmid === currentSong.songmid) return true;
          return song.title === currentSong.title && song.artist === currentSong.artist;
        }
        return false;
      }
      return false;
    };

    const progress = computed(() => {
      if (totalTime.value > 0) {
        return (currentTime.value / totalTime.value) * 100;
      }
      return 0;
    });

    const playModeText = computed(() => {
      const texts = ['随机播放', '列表循环', '单曲循环'];
      return texts[playMode.value];
    });

    const isShuffle = computed(() => playMode.value === 0);
    const repeatMode = computed(() => playMode.value === 2 ? 2 : playMode.value === 1 ? 1 : 0);

    const volumeIcon = computed(() => {
      if (volume.value === 0) return 'mute';
      if (volume.value < 50) return 'low';
      return 'normal';
    });

    const displaySongs = computed(() => {
      let songs = [];
      if (showAlbumDetail.value) {
        songs = currentAlbum.value ? currentAlbum.value.songs : [];
      } else if (showArtistDetail.value) {
        songs = currentArtist.value ? currentArtist.value.songs : [];
      } else if (currentView.value === 'albums') {
        songs = groupByAlbum();
      } else if (currentView.value === 'artists') {
        songs = groupByArtist();
      } else if (currentView.value === 'favorites') {
        songs = favorites.value;
      } else if (currentView.value === 'recent') {
        songs = recentlyPlayed.value;
      } else if (currentView.value === 'playlist' && currentPlaylistId.value) {
        const playlist = playlists.value.find(p => p.id === currentPlaylistId.value);
        songs = playlist ? playlist.songs : [];
      } else {
        songs = musicFiles.value;
      }
      
      // 初始化下载状态
      nextTick(() => {
        initSongDownloadStatus(songs);
      });
      
      return songs;
    });

    const playlistSongs = computed(() => {
      // 根据当前播放上下文显示相应的歌曲列表
      const songs = currentContextSongs.value;
      
      // 初始化下载状态
      nextTick(() => {
        initSongDownloadStatus(songs);
      });
      
      return songs;
    });

    const playlistTitle = computed(() => {
      // 根据当前播放上下文显示相应的标题
      if (currentPlayContext.value === 'album' && currentAlbum.value) {
        return `专辑 - ${currentAlbum.value.albumName}`;
      } else if (currentPlayContext.value === 'artist' && currentArtist.value) {
        return `艺术家 - ${currentArtist.value.artistName}`;
      } else if (currentPlayContext.value === 'favorites') {
        return '我喜欢的';
      } else if (currentPlayContext.value === 'recent') {
        return '最近播放';
      } else {
        return '本地音乐';
      }
    });

    const pageTitle = computed(() => {
      if (showAlbumDetail.value && currentAlbum.value) {
        return currentAlbum.value.albumName;
      } else if (showArtistDetail.value && currentArtist.value) {
        return currentArtist.value.artistName;
      } else if (currentView.value === 'playlist' && currentPlaylistId.value) {
        const playlist = playlists.value.find(p => p.id === currentPlaylistId.value);
        return playlist ? playlist.name : '歌单';
      } else if (currentView.value === 'settings') {
        return '设置';
      } else if (currentView.value === 'sourceSearch') {
        const source = importedSources.value.find(s => s.id === currentSourceId.value);
        return source ? `搜索 - ${source.name}` : '在线音乐搜索';
      }
      const titles = {
        'library': '本地音乐',
        'albums': '专辑',
        'artists': '艺术家',
        'favorites': '我喜欢的',
        'recent': '最近播放'
      };
      return titles[currentView.value] || '本地音乐';
    });

    const groupByAlbum = () => {
      const albums = {};
      
      // 分组音乐文件
      musicFiles.value.forEach(song => {
        const albumName = song.album || '无专辑';
        if (!albums[albumName]) {
          albums[albumName] = [];
        }
        albums[albumName].push(song);
      });
      
      // 转换为数组并排序
      const albumList = Object.entries(albums).map(([albumName, songs]) => {
        // 找到专辑中第一个有封面的歌曲
        const firstSongWithCover = songs.find(song => song.cover);
        return {
          albumName,
          songs,
          cover: firstSongWithCover ? firstSongWithCover.cover : null
        };
      });
      
      // 排序：无专辑放最后，其他按拼音排序
      albumList.sort((a, b) => {
        if (a.albumName === '无专辑') return 1;
        if (b.albumName === '无专辑') return -1;
        return a.albumName.localeCompare(b.albumName, 'zh-CN');
      });
      
      return albumList;
    };

    const groupByArtist = () => {
      const artists = {};
      
      // 分组音乐文件
      musicFiles.value.forEach(song => {
        const artistName = song.artist || '无艺术家';
        if (!artists[artistName]) {
          artists[artistName] = [];
        }
        artists[artistName].push(song);
      });
      
      // 转换为数组并排序
      const artistList = Object.entries(artists).map(([artistName, songs]) => ({
        artistName,
        songs
      }));
      
      // 排序：无艺术家放最后，其他按拼音排序
      artistList.sort((a, b) => {
        if (a.artistName === '无艺术家') return 1;
        if (b.artistName === '无艺术家') return -1;
        return a.artistName.localeCompare(b.artistName, 'zh-CN');
      });
      
      return artistList;
    };

    const minimizeWindow = () => ipcRenderer.send('window-minimize');
    const maximizeWindow = () => ipcRenderer.send('window-maximize');
    const closeWindow = () => ipcRenderer.send('window-close');

    const formatTime = (seconds) => {
      if (!seconds && seconds !== 0) return '--:--';
      if (typeof seconds === 'string') {
        const parts = seconds.split(':');
        if (parts.length === 2) {
          const mins = parseInt(parts[0], 10);
          const secs = parseInt(parts[1], 10);
          if (!isNaN(mins) && !isNaN(secs)) {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        }
        return seconds || '--:--';
      }
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const importMusic = async () => {
      showImportTypeModal.value = true;
    };

    const selectImportType = async (type) => {
      showImportTypeModal.value = false;
      
      let result;
      
      if (type === 'file') {
        // 用户选择导入文件
        result = await ipcRenderer.invoke('select-file-dialog');
      } else {
        // 用户选择导入文件夹
        result = await ipcRenderer.invoke('select-folder-dialog');
      }
      
      if (result && result.length > 0) {
        const files = await ipcRenderer.invoke('scan-music-folder', result);
        
        if (files.length > 0) {
          // 累加新文件夹的歌曲，避免重复
          const existingPaths = new Set(musicFiles.value.map(s => s.path));
          const newFiles = files.filter(s => !existingPaths.has(s.path));
          
          if (newFiles.length > 0) {
            musicFiles.value = [...musicFiles.value, ...newFiles];
            generateShuffledIndices();
            
            // 保存导入路径到本地存储
            await saveImportedPathsToStorage();
          } else {
            showAlert('该文件夹的歌曲已全部导入');
          }
        } else {
          showAlert('未找到音乐文件');
        }
      }
    };

    const generateShuffledIndices = () => {
      shuffledIndices = [...Array(musicFiles.value.length).keys()];
      for (let i = shuffledIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
      }
    };

    const playSong = (index, context = 'library', contextSongs = null) => {
      let song;
      
      if (context === 'library') {
        if (index < 0 || index >= musicFiles.value.length) return;
        song = musicFiles.value[index];
        currentSongIndex.value = index;
        currentPlayContext.value = 'library';
        currentContextSongs.value = musicFiles.value;
        currentContextIndex.value = index;
      } else if (context === 'album' && contextSongs) {
        if (index < 0 || index >= contextSongs.length) return;
        song = contextSongs[index];
        // 找到在完整列表中的索引
        const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
        if (fullIndex === -1) return;
        currentSongIndex.value = fullIndex;
        currentPlayContext.value = 'album';
        currentContextSongs.value = contextSongs;
        currentContextIndex.value = index;
      } else if (context === 'artist' && contextSongs) {
        if (index < 0 || index >= contextSongs.length) return;
        song = contextSongs[index];
        // 找到在完整列表中的索引
        const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
        if (fullIndex === -1) return;
        currentSongIndex.value = fullIndex;
        currentPlayContext.value = 'artist';
        currentContextSongs.value = contextSongs;
        currentContextIndex.value = index;
      } else if (context === 'favorites') {
        if (index < 0 || index >= favorites.value.length) return;
        song = favorites.value[index];
        if (!song.path) {
          currentPlayContext.value = 'favorites';
          currentContextSongs.value = [...favorites.value];
          currentContextIndex.value = index;
          playBuiltinSong(song);
          return;
        }
        const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
        if (fullIndex === -1) return;
        currentSongIndex.value = fullIndex;
        currentPlayContext.value = 'favorites';
        currentContextSongs.value = [...favorites.value];
        currentContextIndex.value = index;
      } else if (context === 'recent') {
        if (index < 0 || index >= recentlyPlayed.value.length) return;
        song = recentlyPlayed.value[index];
        if (!song.path) {
          currentPlayContext.value = 'recent';
          currentContextSongs.value = [...recentlyPlayed.value];
          currentContextIndex.value = index;
          playBuiltinSong(song);
          return;
        }
        const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
        if (fullIndex === -1) return;
        currentSongIndex.value = fullIndex;
        currentPlayContext.value = 'recent';
        currentContextSongs.value = [...recentlyPlayed.value];
        currentContextIndex.value = index;
      } else if (context === 'playlist' && contextSongs) {
        if (index < 0 || index >= contextSongs.length) return;
        song = contextSongs[index];
        if (!song.path) {
          currentPlayContext.value = 'playlist';
          currentContextSongs.value = contextSongs;
          currentContextIndex.value = index;
          playBuiltinSong(song);
          return;
        }
        // 找到在完整列表中的索引
        const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
        if (fullIndex === -1) return;
        currentSongIndex.value = fullIndex;
        currentPlayContext.value = 'playlist';
        currentContextSongs.value = contextSongs;
        currentContextIndex.value = index;
      } else if (context === 'builtin' && contextSongs) {
        // 处理从 builtin 上下文切换到本地音乐的情况
        if (index < 0 || index >= contextSongs.length) return;
        song = contextSongs[index];
        // 检查是否是本地音乐（有 path）
        if (song.path) {
          // 找到在完整列表中的索引
          const fullIndex = musicFiles.value.findIndex(s => s.path === song.path);
          if (fullIndex === -1) return;
          currentSongIndex.value = fullIndex;
          // 切换到适当的上下文
          // 尝试确定原始上下文
          let originalContext = 'library';
          // 检查是否来自收藏列表
          if (favorites.value.some(s => s.path === song.path)) {
            originalContext = 'favorites';
          }
          // 检查是否来自最近播放列表
          else if (recentlyPlayed.value.some(s => s.path === song.path)) {
            originalContext = 'recent';
          }
          // 检查是否来自歌单
          else {
            for (const playlist of playlists.value) {
              if (playlist.songs.some(s => s.path === song.path)) {
                originalContext = 'playlist';
                break;
              }
            }
          }
          currentPlayContext.value = originalContext;
          currentContextSongs.value = contextSongs;
          currentContextIndex.value = index;
        } else {
          // 在线音乐：使用 playBuiltinSong 函数播放
          playBuiltinSong(song);
          return;
        }
      } else {
        return;
      }
      
      if (audio) {
        audio.src = '';
        audio.load();
        audio.onerror = null;
        audio.onended = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.ontimeupdate = null;
        audio.onloadedmetadata = null;
        audio = null;
      }

      // 清空在线歌曲信息，确保切换到本地音乐时不会受到影响
      currentBuiltinSong.value = null;

      audio = new Audio(song.path);
      audio.volume = volume.value / 100;
      
      audio.onloadedmetadata = () => {
        totalTime.value = audio.duration;
      };
      
      audio.ontimeupdate = () => {
        currentTime.value = audio.currentTime;
        updateCurrentLyric();
      };
      
      audio.onended = () => {
        if (playMode.value === 2) {
          audio.currentTime = 0;
          audio.play();
        } else if (settings.value.autoPlayNext) {
          nextSong();
        }
      };
      
      audio.play();
      isPlaying.value = true;
      
      // 只有在非最近播放列表中选择歌曲时才更新最近播放列表
      if (context !== 'recent') {
        // 更新最近播放列表
        updateRecentlyPlayed(song);
      }
      
      // 更新最近播放的索引
      if (playMode.value === 0) { // 只在随机播放模式下更新
        // 移除已存在的相同索引
        const existingIndex = recentlyPlayedIndices.indexOf(currentContextIndex.value);
        if (existingIndex > -1) {
          recentlyPlayedIndices.splice(existingIndex, 1);
        }
        // 添加到最近播放列表的开头
        recentlyPlayedIndices.unshift(currentContextIndex.value);
        // 限制最近播放列表的长度为5
        if (recentlyPlayedIndices.length > 5) {
          recentlyPlayedIndices = recentlyPlayedIndices.slice(0, 5);
        }
      }
      
      // 优先使用内嵌歌词，如果没有则使用外部字幕文件
      if (song.lyrics) {
        // 解析内嵌歌词（假设为LRC格式）
        try {
          parseLyrics(song.lyrics);
          showSubtitles.value = true;
        } catch (e) {
          console.error('解析内嵌歌词失败:', e);
          showSubtitles.value = false;
        }
      } else if (song.subtitle) {
        // 解析外部字幕文件
        loadLyricsFile(song.subtitle);
      } else {
        showSubtitles.value = false;
      }
      
      initSpectrum();
    };

    const togglePlay = () => {
      if (currentPlayContext.value === 'builtin') {
        if (audio) {
          if (isPlaying.value) {
            audio.pause();
            isPlaying.value = false;
          } else {
            audio.play();
            isPlaying.value = true;
            if (showFullscreen.value) {
              initSpectrum();
            }
          }
        }
        return;
      }

      // 如果是在线歌曲（从 recent/favorites/playlist 播放），使用 builtin 逻辑
      if (currentContextSongs.value.length > 0 && currentContextIndex.value >= 0) {
        const currentSong = currentContextSongs.value[currentContextIndex.value];
        if (currentSong && !currentSong.path) {
          // 在线歌曲
          if (audio) {
            if (isPlaying.value) {
              audio.pause();
              isPlaying.value = false;
            } else {
              audio.play();
              isPlaying.value = true;
              if (showFullscreen.value) {
                initSpectrum();
              }
            }
          }
          return;
        }
      }

      if (musicFiles.value.length === 0) return;

      if (currentSongIndex.value === -1) {
        playSong(0);
      } else {
        if (isPlaying.value) {
          audio.pause();
          isPlaying.value = false;
        } else {
          audio.play();
          isPlaying.value = true;
          if (showFullscreen.value) {
            initSpectrum();
          }
        }
      }
    };

    const getRandomSongIndex = () => {
      const songCount = currentContextSongs.value.length;
      if (songCount === 0) return -1;
      if (songCount === 1) return 0;
      
      // 根据歌曲数量调整最近播放列表的长度
      const historyLength = Math.min(5, Math.max(2, Math.floor(songCount * 0.3)));
      
      // 确保最近播放列表不超过历史长度
      if (recentlyPlayedIndices.length > historyLength) {
        recentlyPlayedIndices = recentlyPlayedIndices.slice(0, historyLength);
      }
      
      // 构建权重数组
      const weights = [];
      for (let i = 0; i < songCount; i++) {
        if (i === currentContextIndex.value) {
          // 当前歌曲权重为0，避免重复播放
          weights.push(0);
        } else if (recentlyPlayedIndices.includes(i)) {
          // 最近播放的歌曲权重较低
          const position = recentlyPlayedIndices.indexOf(i);
          // 位置越靠前，权重越低
          weights.push(1 / (position + 2));
        } else {
          // 未播放过的歌曲权重较高
          weights.push(2);
        }
      }
      
      // 计算权重总和
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      
      // 基于权重随机选择
      let random = Math.random() * totalWeight;
      for (let i = 0; i < songCount; i++) {
        random -= weights[i];
        if (random <= 0) {
          return i;
        }
      }
      
      // 防止极端情况下没有选中
      return Math.floor(Math.random() * songCount);
    };

    const previousSong = () => {
      if (currentPlayContext.value === 'builtin') {
        playBuiltinPrev();
        return;
      }

      if (currentContextSongs.value.length === 0) return;

      let newIndex;

      if (playMode.value === 0) {
        newIndex = getRandomSongIndex();
      } else {
        newIndex = currentContextIndex.value - 1;
        if (newIndex < 0) newIndex = currentContextSongs.value.length - 1;
      }

      playSong(newIndex, currentPlayContext.value, currentContextSongs.value);
    };

    const nextSong = () => {
      if (currentPlayContext.value === 'builtin') {
        playBuiltinNext();
        return;
      }

      if (currentContextSongs.value.length === 0) return;

      let newIndex;

      if (playMode.value === 0) {
        newIndex = getRandomSongIndex();
      } else {
        newIndex = currentContextIndex.value + 1;
        if (newIndex >= currentContextSongs.value.length) newIndex = 0;
      }

      playSong(newIndex, currentPlayContext.value, currentContextSongs.value);
    };

    const togglePlayMode = () => {
      playMode.value = (playMode.value + 1) % 3;
      if (playMode.value === 0) {
        generateShuffledIndices();
      }
    };

    const seekTo = (value) => {
      if (audio && audio.duration) {
        audio.currentTime = (value / 100) * audio.duration;
      }
    };

    const setVolume = (value) => {
      volume.value = parseInt(value);
      if (audio) {
        audio.volume = volume.value / 100;
      }
    };

    const toggleMute = () => {
      if (volume.value > 0) {
        previousVolume = volume.value;
        volume.value = 0;
      } else {
        volume.value = previousVolume;
      }
      if (audio) {
        audio.volume = volume.value / 100;
      }
    };

    const getSongIndex = (albumName, songIndex) => {
      let index = 0;
      for (const song of musicFiles.value) {
        const currentAlbum = song.album || '无专辑';
        if (currentAlbum === albumName) {
          if (songIndex === 0) {
            return index;
          }
          songIndex--;
        }
        index++;
      }
      return -1;
    };

    const getSongIndexByArtist = (artistName, songIndex) => {
      let index = 0;
      for (const song of musicFiles.value) {
        const currentArtist = song.artist || '无艺术家';
        if (currentArtist === artistName) {
          if (songIndex === 0) {
            return index;
          }
          songIndex--;
        }
        index++;
      }
      return -1;
    };

    const startResizing = (event) => {
      isResizing.value = true;
      document.addEventListener('mousemove', resizeSidebar);
      document.addEventListener('mouseup', stopResizing);
    };

    const resizeSidebar = (event) => {
      if (!isResizing.value || !sidebar.value) return;
      
      const containerRect = sidebar.value.parentElement.getBoundingClientRect();
      let newWidth = event.clientX - containerRect.left;
      
      // 限制最小和最大宽度
      newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
      
      sidebar.value.style.width = `${newWidth}px`;
    };

    const stopResizing = () => {
      isResizing.value = false;
      document.removeEventListener('mousemove', resizeSidebar);
      document.removeEventListener('mouseup', stopResizing);
    };

    const openAlbumDetail = (album) => {
      currentAlbum.value = album;
      showAlbumDetail.value = true;
    };

    const openArtistDetail = (artist) => {
      currentArtist.value = artist;
      showArtistDetail.value = true;
    };

    const backToAlbums = () => {
      showAlbumDetail.value = false;
      currentAlbum.value = null;
    };

    const backToArtists = () => {
      showArtistDetail.value = false;
      currentArtist.value = null;
    };

    const togglePlaylist = () => {
      // 如果还没有设置播放上下文，根据当前播放状态设置默认的播放列表
      if (currentContextSongs.value.length === 0) {
        if (currentPlayContext.value === 'builtin' && currentBuiltinSong.value) {
          // 正在播放在线歌曲，但还没有设置播放列表（可能是直接播放的）
          // 尝试在搜索结果中查找当前歌曲
          const songIndex = builtinSearchResults.value.findIndex(s => {
            if (s.hash && currentBuiltinSong.value.hash && s.hash === currentBuiltinSong.value.hash) return true;
            if (s.id && currentBuiltinSong.value.id && s.id === currentBuiltinSong.value.id) return true;
            if (s.songmid && currentBuiltinSong.value.songmid && s.songmid === currentBuiltinSong.value.songmid) return true;
            return false;
          });
          
          if (songIndex >= 0) {
            currentContextSongs.value = [...builtinSearchResults.value];
            currentContextIndex.value = songIndex;
          }
        } else if (musicFiles.value.length > 0) {
          // 没有播放在线歌曲，但有本地音乐，默认显示本地音乐
          currentPlayContext.value = 'library';
          currentContextSongs.value = musicFiles.value;
          currentContextIndex.value = currentSongIndex.value;
        }
      }
      showPlaylist.value = !showPlaylist.value;
    };

    const toggleTheme = () => {
      const themes = ['dark', 'light'];
      const currentIndex = themes.indexOf(currentTheme.value);
      const nextIndex = (currentIndex + 1) % themes.length;
      currentTheme.value = themes[nextIndex];
      
      // 移除所有主题类
      document.body.classList.remove('light-theme');
      
      // 添加当前主题类
      if (currentTheme.value === 'light') {
        document.body.classList.add('light-theme');
      }
    };

    const toggleFavorite = (song) => {
      let index = -1;
      if (song.path) {
        index = favorites.value.findIndex(favSong => favSong.path === song.path);
      } else {
        index = favorites.value.findIndex(favSong =>
          (favSong.songmid && favSong.songmid === song.songmid) ||
          (favSong.id && favSong.id === song.id)
        );
      }
      if (index > -1) {
        favorites.value.splice(index, 1);
      } else {
        favorites.value.push({ ...song });
      }
      saveFavoritesToStorage();
    };

    const updateRecentlyPlayed = (song) => {
      // 移除已存在的相同歌曲
      const index = recentlyPlayed.value.findIndex(rpSong => {
        // 首先区分本地歌曲和在线歌曲
        const isLocalSong = song.path !== undefined && song.path !== null;
        const isRpLocalSong = rpSong.path !== undefined && rpSong.path !== null;
        
        // 如果一个是本地歌曲，一个是在线歌曲，即使其他属性相同也不是同一首
        // （可能是同一首歌的不同音源/音质版本）
        if (isLocalSong !== isRpLocalSong) {
          return false;
        }
        
        // 对于本地歌曲，使用 path 匹配
        if (isLocalSong) {
          const match = rpSong.path === song.path;
          return match;
        }
        
        // 对于在线歌曲，使用 hash、id 或 songmid 匹配
        if (song.hash && rpSong.hash && song.hash === rpSong.hash) {
          return true;
        }
        if (song.id && rpSong.id && song.id === rpSong.id) {
          return true;
        }
        if (song.songmid && rpSong.songmid && song.songmid === rpSong.songmid) {
          return true;
        }
        // 最后使用 url 匹配（备用方案）
        if (song.url && rpSong.url && song.url === rpSong.url) {
          return true;
        }
        return false;
      });
      
      if (index > -1) {
        recentlyPlayed.value.splice(index, 1);
      }
      
      // 添加到最近播放列表的开头
      recentlyPlayed.value.unshift({ ...song });
      
      // 限制最近播放列表的长度为 20 首
      if (recentlyPlayed.value.length > 20) {
        recentlyPlayed.value = recentlyPlayed.value.slice(0, 20);
      }
    };
    
    // 检查歌曲是否已下载
    const isSongDownloaded = async (song) => {
      // 如果是本地歌曲，直接返回 true
      if (song.path) {
        return true;
      }
      
      // 检查缓存
      const cacheKey = song.hash || song.id || song.songmid || song.url;
      if (cacheKey && downloadStatusCache.has(cacheKey)) {
        const cached = downloadStatusCache.get(cacheKey);
        if (cached.path) {
          song.downloadedPath = cached.path;
        }
        return cached.downloaded;
      }
      
      // 在线歌曲，检查下载目录中是否存在
      try {
        // 根据歌曲信息构建可能的文件名
        const filename = `${song.title} - ${song.artist}`;
        const extensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg'];
        
        // 获取下载目录
        const downloadPath = await ipcRenderer.invoke('get-download-path');
        
        // 检查各种音质格式的文件是否存在
        for (const ext of extensions) {
          const filePath = path.join(downloadPath, filename + ext);
          const exists = await ipcRenderer.invoke('check-file-exists', filePath);
          if (exists) {
            // 保存下载路径到歌曲对象
            song.downloadedPath = filePath;
            // 缓存结果
            if (cacheKey) {
              downloadStatusCache.set(cacheKey, { downloaded: true, path: filePath });
            }
            return true;
          }
        }
        
        // 缓存未下载状态
        if (cacheKey) {
          downloadStatusCache.set(cacheKey, { downloaded: false });
        }
      } catch (error) {
        console.error('检查下载状态失败:', error);
      }
      
      return false;
    };
    
    // 解析LRC歌词
    const parseLyrics = (content) => {
      const lines = content.split(/\r?\n/);
      const result = [];

      lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // 首先尝试KRC格式的时间标签 [ms,duration] 或 [ms,0]
        const krcMatch = line.match(/^\[(\d+),(\d+)\](.*)$/);
        if (krcMatch) {
          const time = parseInt(krcMatch[1]) / 1000;
          let text = krcMatch[3];
          text = text.replace(/<\d+,\d+,\d+>/g, '');
          if (text.trim()) {
            result.push({ time, text: text.trim() });
          }
          return;
        }

        // 尝试LRC格式：[mm:ss.xx]歌词
        const lrcMatch = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
        if (lrcMatch) {
          const minutes = parseInt(lrcMatch[1]);
          const seconds = parseInt(lrcMatch[2]);
          const milliseconds = parseInt(lrcMatch[3].padEnd(3, '0'));
          const time = minutes * 60 + seconds + milliseconds / 1000;
          const text = lrcMatch[4].trim();
          if (text) {
            result.push({ time, text });
          }
        }
      });

      result.sort((a, b) => a.time - b.time);
      lyricsLines.value = result;
      currentLyricIndex.value = -1;
    };
    
    // 检测是否是有效的UTF-8编码
    const isValidUtf8 = (buffer) => {
      let i = 0;
      while (i < buffer.length) {
        if (buffer[i] < 0x80) {
          // ASCII字符
          i++;
        } else if (buffer[i] < 0xC0) {
          // 无效的UTF-8起始字节
          return false;
        } else if (buffer[i] < 0xE0) {
          // 2字节UTF-8
          if (i + 1 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80) return false;
          i += 2;
        } else if (buffer[i] < 0xF0) {
          // 3字节UTF-8
          if (i + 2 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80) return false;
          i += 3;
        } else if (buffer[i] < 0xF8) {
          // 4字节UTF-8
          if (i + 3 >= buffer.length || (buffer[i + 1] & 0xC0) !== 0x80 || (buffer[i + 2] & 0xC0) !== 0x80 || (buffer[i + 3] & 0xC0) !== 0x80) return false;
          i += 4;
        } else {
          // 无效的UTF-8
          return false;
        }
      }
      return true;
    };
    
    // 检测是否包含中文字符（GBK/GB2312范围）
    const hasChineseChars = (str) => {
      return /[\u4e00-\u9fa5]/.test(str);
    };
    
    // 加载歌词文件
    const loadLyricsFile = async (lyricsPath) => {
      if (!lyricsPath) {
        showSubtitles.value = false;
        return;
      }
      
      try {
        const fs = require('fs');
        const iconv = require('iconv-lite');
        
        // 读取文件原始字节
        const buffer = fs.readFileSync(lyricsPath);
        let content;
        
        // 优先检测UTF-8编码
        if (isValidUtf8(buffer)) {
          content = buffer.toString('utf8');
          console.log('使用UTF-8编码解析歌词文件');
          
          // 检查UTF-8解码后是否有乱码（如果包含乱码字符，可能实际是GBK）
          // 如果有很多�字符，尝试用GBK重新解码
          const replacementCount = (content.match(/\ufffd/g) || []).length;
          if (replacementCount > 0 && replacementCount / content.length > 0.1) {
            console.log('UTF-8解码发现乱码，尝试GBK编码');
            content = iconv.decode(buffer, 'gbk');
          }
        } else {
          // 不是有效的UTF-8，尝试GBK（Windows ANSI编码）
          content = iconv.decode(buffer, 'gbk');
          console.log('使用GBK编码解析歌词文件（ANSI）');
        }
        
        parseLyrics(content);
        
        if (lyricsLines.value.length > 0) {
          showSubtitles.value = true;
        } else {
          showSubtitles.value = false;
        }
      } catch (error) {
        console.error('解析歌词文件失败:', error);
        showSubtitles.value = false;
      }
    };
    
    // 处理歌词滚动
    const handleLyricsScroll = (e) => {
      e.preventDefault();
      if (lyricsContent.value) {
        lyricsContent.value.scrollTop += e.deltaY * lyricsScrollSensitivity;
        // 记录用户操作时间
        lastUserLyricsActionTime = Date.now();
      }
    };
    
    // 跳转到指定歌词
    const seekToLyric = (index) => {
      if (lyricsLines.value[index] && audio) {
        audio.currentTime = lyricsLines.value[index].time;
        // 记录用户点击时间
        lastUserLyricsActionTime = Date.now();
      }
    };
    
    // 更新当前歌词位置
    const updateCurrentLyric = () => {
      if (!audio || lyricsLines.value.length === 0) return;
      
      const currentTime = audio.currentTime;
      // 提前 0.2 秒显示歌词（已调整慢 0.3 秒）
      const adjustedTime = currentTime + 0.2;
      let newIndex = -1;
      
      for (let i = lyricsLines.value.length - 1; i >= 0; i--) {
        if (adjustedTime >= lyricsLines.value[i].time) {
          newIndex = i;
          break;
        }
      }
      
      if (newIndex !== currentLyricIndex.value) {
        currentLyricIndex.value = newIndex;
        
        // 检查用户是否在最近 2 秒内操作过歌词栏
        const now = Date.now();
        const timeSinceLastAction = now - lastUserLyricsActionTime;
        
        // 清除之前的计时器
        if (autoScrollTimer) {
          clearTimeout(autoScrollTimer);
          autoScrollTimer = null;
        }
        
        // 如果用户最近有操作，延迟 2 秒后再自动滚动
        if (timeSinceLastAction < 2000) {
          autoScrollTimer = setTimeout(() => {
            // 再次检查是否在这 2 秒内又有新的操作
            if (Date.now() - lastUserLyricsActionTime >= 2000) {
              scrollToCurrentLyric(newIndex);
            }
          }, 2000);
        } else {
          // 用户没有操作，直接滚动
          scrollToCurrentLyric(newIndex);
        }
      }
    };
    
    // 滚动到当前歌词
    const scrollToCurrentLyric = (index) => {
      nextTick(() => {
        if (lyricsContent.value && index >= 0) {
          const lyricElements = lyricsContent.value.querySelectorAll('.lyric-line');
          if (lyricElements[index]) {
            lyricElements[index].scrollIntoView({
              behavior: 'auto',
              block: 'center'
            });
          }
        }
      });
    };

    const isFavorite = (song) => {
      if (song.path) {
        return favorites.value.some(favSong => favSong.path === song.path);
      }
      return favorites.value.some(favSong =>
        (favSong.songmid && favSong.songmid === song.songmid) ||
        (favSong.id && favSong.id === song.id)
      );
    };

    const toggleFullscreen = () => {
      if (showFullscreen.value && !isExitingFullscreen.value) {
        isExitingFullscreen.value = true;
        setTimeout(() => {
          showFullscreen.value = false;
          isExitingFullscreen.value = false;
        }, 300);
      } else if (!showFullscreen.value) {
        showFullscreen.value = true;
        nextTick(() => {
          const fullscreenElement = document.querySelector('.fullscreen-mode');
          if (fullscreenElement) {
            fullscreenElement.classList.add('enter');
            // 等待浏览器重绘后移除enter类，让transition有时间触发
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                fullscreenElement.classList.remove('enter');
              });
            });
          }
          if (spectrumCanvas.value) {
            const size = 500;
            spectrumCanvas.value.width = size;
            spectrumCanvas.value.height = size;
          }
          // 如果正在播放，初始化频谱
          if (isPlaying.value && audio) {
            initSpectrum();
          } else {
            drawSpectrum();
          }
        });
      }
    };

    let currentAudioElement = null;

    const initSpectrum = () => {
      if (!audio) return;
      
      try {
        if (audioContext && currentAudioElement === audio) {
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
          drawSpectrum();
          return;
        }
        
        if (audioContext) {
          audioContext.close();
          audioContext = null;
          analyser = null;
          source = null;
        }
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        
        source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        currentAudioElement = audio;
        
        drawSpectrum();
      } catch (e) {
        console.error('音频上下文错误:', e);
      }
    };

    // 用于保存频谱数据，实现暂停时的平滑过渡
    let savedSpectrumData = null;
    let wasPlaying = false; // 跟踪播放状态，避免多次保存暂停数据
    
    const drawSpectrum = () => {
      if (!spectrumCanvas.value || !analyser) return;
      
      // 先取消之前的动画循环，防止多个循环同时运行
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      
      const canvas = spectrumCanvas.value;
      const ctx = canvas.getContext('2d');
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const smoothing = 0.3;
      const pauseDecayRate = 0.985;
      const baseValue = 15;
      const rotationSpeed = 0.105; // 旋转速度（弧度/秒），约 60 秒转一圈（2π/60≈0.105）
      let rotationAngle = 0; // 当前旋转角度
      let lastTime = performance.now(); // 上次渲染时间
      let previousData = new Uint8Array(bufferLength);
      
      const render = () => {
        if (!showFullscreen.value) {
          cancelAnimationFrame(animationId);
          animationId = null;
          return;
        }
        
        animationId = requestAnimationFrame(render);
        analyser.getByteFrequencyData(dataArray);
        
        // 空间滤波：对相邻频率进行平滑，去除毛刺
        const filteredData = new Uint8Array(bufferLength);
        for (let i = 0; i < bufferLength; i++) {
          let sum = dataArray[i];
          let count = 1;
          if (i > 0) {
            sum += dataArray[i - 1];
            count++;
          }
          if (i < bufferLength - 1) {
            sum += dataArray[i + 1];
            count++;
          }
          filteredData[i] = sum / count;
        }
        
        // 更新旋转角度（顺时针，基于时间，不受帧率影响）
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // 转换为秒
        lastTime = currentTime;
        rotationAngle += rotationSpeed * deltaTime;
        if (rotationAngle > Math.PI * 2) {
          rotationAngle -= Math.PI * 2;
        }
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += filteredData[i];
        }
        const average = sum / bufferLength;
        waveScale.value = average / 255 * 0.5;
        waveOpacity.value = 0.5 + (average / 255 * 0.5);
        waveDuration.value = 1.5 + (1 - average / 255) * 1.5;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const minDim = Math.min(canvas.width, canvas.height);
        const innerRadius = minDim * 0.28;
        const outerRadius = minDim * 0.4;
        
        const skipBars = 5; // 跳过最低频
        const maxFreqPercent = 0.65; // 只使用中高频以下部分（65% 的频段）
        const rightHalfBars = Math.floor((bufferLength - skipBars) * maxFreqPercent) + 2;
        const numBars = Math.floor(rightHalfBars / 1.5); // 减少采样间隔，增加精度
        
        if (isPlaying.value && !wasPlaying) {
          savedSpectrumData = null;
        } else if (!isPlaying.value && wasPlaying) {
          savedSpectrumData = new Uint8Array(bufferLength);
          for (let j = 0; j < bufferLength; j++) {
            savedSpectrumData[j] = dataArray[j] || baseValue;
          }
        }
        wasPlaying = isPlaying.value;
        
        const gradient = ctx.createLinearGradient(0, centerY - innerRadius, 0, centerY + innerRadius);
        gradient.addColorStop(0, '#ff6b9d');
        gradient.addColorStop(0.5, '#ff2d55');
        gradient.addColorStop(1, '#ff1e3f');
        
        for (let i = 0; i < numBars; i++) {
          // 线性映射：将 0~numBars 映射到 skipBars~(skipBars + rightHalfBars)
          const dataIndex = skipBars + Math.floor(i * (rightHalfBars / numBars));
          let value = filteredData[dataIndex] || baseValue;
          
          if (!isPlaying.value && savedSpectrumData) {
            value = savedSpectrumData[dataIndex] || baseValue;
            savedSpectrumData[dataIndex] = value * pauseDecayRate + baseValue * (1 - pauseDecayRate);
          }
          
          // 线性增益：越往低频（i 越大）增益越强，中高频不增益
          const lowFreqBoost = 1.0 + (i / numBars) * 0.8; // 低频增益 80%，高频不增益
          value = Math.min(255, value * lowFreqBoost);
          
          const maxBarLength = (outerRadius - innerRadius) * 0.95;
          const barHeight = (value / 255) * maxBarLength;
          
          const angle = (i / (numBars - 1)) * Math.PI - Math.PI / 2 + rotationAngle;
          
          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);
          
          const barWidth = (Math.PI * innerRadius) / numBars * 0.9;
          
          ctx.beginPath();
          ctx.strokeStyle = gradient;
          ctx.lineWidth = barWidth;
          ctx.lineCap = 'round';
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          const mirrorAngle = Math.PI - angle + rotationAngle * 2;
          const mx1 = centerX + Math.cos(mirrorAngle) * innerRadius;
          const my1 = centerY + Math.sin(mirrorAngle) * innerRadius;
          const mx2 = centerX + Math.cos(mirrorAngle) * (innerRadius + barHeight);
          const my2 = centerY + Math.sin(mirrorAngle) * (innerRadius + barHeight);
          
          ctx.beginPath();
          ctx.strokeStyle = gradient;
          ctx.lineWidth = barWidth;
          ctx.lineCap = 'round';
          ctx.moveTo(mx1, my1);
          ctx.lineTo(mx2, my2);
          ctx.stroke();
        }
      };
      
      render();
    };

    const stopSpectrum = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };

    // 显示更多操作菜单
    const showMoreMenu = (song, event) => {
      event.stopPropagation();
      
      // 如果菜单已经打开，再次点击关闭它
      if (showMoreMenuVisible.value && currentSongForMenu.value === song) {
        closeAllMenus();
        return;
      }
      
      currentSongForMenu.value = song;
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const menuHeight = 200; // 菜单的估计高度
      const menuWidth = 180; // 菜单的宽度
      
      // 获取鼠标位置或触发元素位置
      let mouseX, mouseY;
      if (event.type === 'contextmenu' || event.clientX) {
        // 右键菜单或有鼠标位置的事件，使用鼠标位置
        mouseX = event.clientX;
        mouseY = event.clientY;
      } else {
        // 否则使用触发元素的位置
        const rect = event.currentTarget.getBoundingClientRect();
        mouseX = rect.right;
        mouseY = rect.bottom;
      }
      
      // 计算菜单的位置，确保不会超出屏幕
      let top = mouseY + 5;
      let left = mouseX - menuWidth;
      
      // 调整位置，确保菜单不会超出屏幕底部
      if (top + menuHeight > windowHeight) {
        top = mouseY - menuHeight - 5;
      }
      
      // 调整位置，确保菜单不会超出屏幕左侧
      if (left < 0) {
        left = 0;
      }
      
      // 调整位置，确保菜单不会超出屏幕右侧
      if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth;
      }
      
      moreMenuStyle.value = {
        top: `${top}px`,
        left: `${left}px`
      };
      showMoreMenuVisible.value = true;
      showDeleteMenuVisible.value = false;
      showAddToPlaylistMenuVisible.value = false;
      
      // 点击其他地方关闭菜单
      setTimeout(() => {
        document.addEventListener('click', closeAllMenus);
      }, 10);
    };

    // 关闭所有菜单
    const closeAllMenus = () => {
      showMoreMenuVisible.value = false;
      showDeleteMenuVisible.value = false;
      showAddToPlaylistMenuVisible.value = false;
      document.removeEventListener('click', closeAllMenus);
    };

    // 从菜单播放歌曲
    const playSongFromMenu = () => {
      if (currentSongForMenu.value) {
        const index = musicFiles.value.findIndex(s => s.path === currentSongForMenu.value.path);
        if (index !== -1) {
          playSong(index);
        }
      }
      closeAllMenus();
    };

    // 从菜单切换喜欢状态
    const toggleFavoriteFromMenu = () => {
      if (currentSongForMenu.value) {
        toggleFavorite(currentSongForMenu.value);
      }
      closeAllMenus();
    };

    // 显示添加到歌单菜单
    const showAddToPlaylistMenu = (event) => {
      event?.stopPropagation();
      const rect = event?.currentTarget.getBoundingClientRect() || {
        bottom: moreMenuStyle.value.top.replace('px', '') - 5,
        right: moreMenuStyle.value.left.replace('px', '')
      };
      const menuWidth = 200; // 子菜单的估计宽度
      
      // 计算子菜单的位置：与对应功能对齐，在一级窗口左边生成
      addToPlaylistMenuStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left - menuWidth - 5}px`
      };
      showAddToPlaylistMenuVisible.value = true;
      // 关闭其他二级窗口，确保一次只打开一个
      showDeleteMenuVisible.value = false;
      // 不要关闭上一个操作界面，让主菜单保持开启
      // showMoreMenuVisible.value = false;
    };

    // 显示删除菜单
    const showDeleteMenu = (event) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const menuWidth = 200; // 子菜单的估计宽度
      
      // 计算子菜单的位置：与对应功能对齐，在一级窗口左边生成
      deleteMenuStyle.value = {
        top: `${rect.top}px`,
        left: `${rect.left - menuWidth - 5}px`
      };
      showDeleteMenuVisible.value = true;
      // 关闭其他二级窗口，确保一次只打开一个
      showAddToPlaylistMenuVisible.value = false;
      // 不要关闭上一个操作界面，让主菜单保持开启
      // showMoreMenuVisible.value = false;
    };

    // 从列表中移除
    const removeFromList = () => {
      if (currentSongForMenu.value) {
        // 如果当前在歌单视图中，从歌单中移除
        if (currentView.value === 'playlist' && currentPlaylistId.value) {
          const playlist = playlists.value.find(p => p.id === currentPlaylistId.value);
          if (playlist) {
            let removeIndex = -1;
            if (currentSongForMenu.value.path) {
              // 本地歌曲：通过 path 查找
              removeIndex = playlist.songs.findIndex(s => s.path === currentSongForMenu.value.path);
            } else {
              // 在线歌曲：通过 songmid 或 id 查找
              removeIndex = playlist.songs.findIndex(s =>
                (s.songmid && s.songmid === currentSongForMenu.value.songmid) ||
                (s.id && s.id === currentSongForMenu.value.id)
              );
            }
            if (removeIndex !== -1) {
              playlist.songs.splice(removeIndex, 1);
              savePlaylistsToStorage();
            }
          }
        } else {
          // 其他视图：从本地音乐库中移除
          const index = musicFiles.value.findIndex(s => s.path === currentSongForMenu.value.path);
          if (index !== -1) {
            musicFiles.value.splice(index, 1);
            if (currentSongIndex.value === index) {
              if (musicFiles.value.length > 0) {
                // 切换到下一首音乐（如果删除的是最后一首，则切换到第一首）
                const newIndex = index < musicFiles.value.length ? index : 0;
                // 先暂停当前播放
                if (audio) {
                  audio.pause();
                  isPlaying.value = false;
                }
                // 切换到新的歌曲，但不自动播放
                currentSongIndex.value = newIndex;
                // 更新当前歌曲信息
                if (musicFiles.value[newIndex]) {
                  currentSongForMenu.value = musicFiles.value[newIndex];
                }
              } else {
                currentSongIndex.value = -1;
                isPlaying.value = false;
              }
            }
          }
        }
      }
      closeAllMenus();
    };

    // 从磁盘中删除
    const deleteFromDisk = () => {
      if (currentSongForMenu.value) {
        showConfirm('确定要从磁盘中删除这首歌吗？此操作不可恢复。', (confirmed) => {
          if (confirmed) {
            const fs = require('fs');
            const songPath = currentSongForMenu.value.path;
            const index = musicFiles.value.findIndex(s => s.path === songPath);
            
            try {
              // 如果要删除的是当前正在播放的歌曲，先停止播放并释放资源
              if (currentSongIndex.value === index && audio) {
                // 暂停播放
                audio.pause();
                // 清空音频源
                audio.src = '';
                // 加载空源以释放文件句柄
                audio.load();
                // 等待一小段时间确保文件被释放
                setTimeout(() => {
                  try {
                    // 尝试删除文件
                    fs.unlinkSync(songPath);
                    
                    // 从列表中移除
                    if (index !== -1) {
                      musicFiles.value.splice(index, 1);
                      
                      // 切换到下一首音乐
                      if (musicFiles.value.length > 0) {
                        const newIndex = index < musicFiles.value.length ? index : 0;
                        currentSongIndex.value = newIndex;
                        if (musicFiles.value[newIndex]) {
                          currentSongForMenu.value = musicFiles.value[newIndex];
                        }
                      } else {
                        currentSongIndex.value = -1;
                        isPlaying.value = false;
                        currentSongForMenu.value = null;
                      }
                    }
                    
                    showAlert('文件删除成功', '成功');
                  } catch (error) {
                    showAlert('删除文件失败：' + error.message, '错误');
                  }
                }, 100);
              } else {
                // 如果不是当前播放的歌曲，直接删除
                fs.unlinkSync(songPath);
                
                if (index !== -1) {
                  musicFiles.value.splice(index, 1);
                  
                  // 如果删除的是当前歌曲，切换到下一首
                  if (currentSongIndex.value === index) {
                    if (musicFiles.value.length > 0) {
                      const newIndex = index < musicFiles.value.length ? index : 0;
                      currentSongIndex.value = newIndex;
                      if (musicFiles.value[newIndex]) {
                        currentSongForMenu.value = musicFiles.value[newIndex];
                      }
                    } else {
                      currentSongIndex.value = -1;
                      isPlaying.value = false;
                    }
                  }
                }
                
                showAlert('文件删除成功', '成功');
              }
            } catch (error) {
              showAlert('删除文件失败：' + error.message, '错误');
            }
          }
        });
      }
      closeAllMenus();
    };

    // 取消删除
    const cancelDelete = () => {
      closeAllMenus();
    };

    // 查看歌曲详细信息
    const showSongDetail = () => {
      if (currentSongForMenu.value) {
        showSongDetailModal.value = true;
      }
      closeAllMenus();
    };

    // 关闭歌曲详细信息模态框
    const closeSongDetailModal = () => {
      showSongDetailModal.value = false;
    };

    let pendingSongForNewPlaylist = null;

    // 新建歌单 - 打开模态框
    const createNewPlaylist = () => {
      showCreatePlaylistModal.value = true;
      isEditingPlaylist.value = false;
      newPlaylistName.value = '';
      newPlaylistDescription.value = '';
      editingPlaylistId.value = null;
      pendingSongForNewPlaylist = null;
      closeAllMenus();
      
      nextTick(() => {
        if (newPlaylistNameInput.value) {
          newPlaylistNameInput.value.focus();
        }
      });
    };

    // 从添加到歌单菜单新建歌单
    const createNewPlaylistFromMenu = () => {
      pendingSongForNewPlaylist = currentSongForMenu.value;
      createNewPlaylist();
    };

    // 保存歌单
    const savePlaylist = () => {
      const name = newPlaylistName.value.trim();
      if (!name) return;

      if (isEditingPlaylist.value && editingPlaylistId.value) {
        // 编辑现有歌单
        const playlist = playlists.value.find(p => p.id === editingPlaylistId.value);
        if (playlist) {
          playlist.name = name;
          playlist.description = newPlaylistDescription.value.trim();
        }
      } else {
        // 创建新歌单，添加到数组开头（先创建的在上）
        const newPlaylist = {
          id: Date.now(),
          name: name,
          description: newPlaylistDescription.value.trim(),
          songs: [],
          createdAt: Date.now()
        };

        // 如果有待添加的歌曲，添加到新歌单中
        if (pendingSongForNewPlaylist) {
          newPlaylist.songs.push({ ...pendingSongForNewPlaylist });
        }

        playlists.value.unshift(newPlaylist);
      }

      savePlaylistsToStorage();
      closeCreatePlaylistModal();
    };

    // 关闭新建歌单模态框
    const closeCreatePlaylistModal = () => {
      showCreatePlaylistModal.value = false;
      isEditingPlaylist.value = false;
      newPlaylistName.value = '';
      newPlaylistDescription.value = '';
      editingPlaylistId.value = null;
    };

    // 打开歌单
    const openPlaylist = (playlist) => {
      currentView.value = 'playlist';
      currentPlaylistId.value = playlist.id;
      showAlbumDetail.value = false;
      showArtistDetail.value = false;
      currentAlbum.value = null;
      currentArtist.value = null;
    };

    // 返回本地音乐
    const backToLibrary = () => {
      currentView.value = 'library';
      currentPlaylistId.value = null;
    };

    // 获取歌单中歌曲的完整索引
    const getSongIndexInPlaylist = (playlistId, songIndex) => {
      const playlist = playlists.value.find(p => p.id === playlistId);
      if (!playlist || !playlist.songs[songIndex]) return -1;
      return musicFiles.value.findIndex(s => s.path === playlist.songs[songIndex].path);
    };

    // 显示歌单右键菜单
    const showPlaylistContextMenu = (playlist, event) => {
      event.stopPropagation();
      
      currentPlaylistForMenu.value = playlist;
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const menuHeight = 150;
      const menuWidth = 180;
      
      let mouseX = event.clientX;
      let mouseY = event.clientY;
      
      let top = mouseY + 5;
      let left = mouseX;
      
      if (top + menuHeight > windowHeight) {
        top = mouseY - menuHeight - 5;
      }
      
      if (left + menuWidth > windowWidth) {
        left = windowWidth - menuWidth;
      }
      
      playlistContextMenuStyle.value = {
        top: `${top}px`,
        left: `${left}px`
      };
      showPlaylistContextMenuVisible.value = true;
      closeAllMenus();
      
      setTimeout(() => {
        document.addEventListener('click', closePlaylistContextMenu);
      }, 10);
    };

    // 关闭歌单右键菜单
    const closePlaylistContextMenu = () => {
      showPlaylistContextMenuVisible.value = false;
      document.removeEventListener('click', closePlaylistContextMenu);
    };

    // 播放歌单
    const playPlaylist = () => {
      if (currentPlaylistForMenu.value && currentPlaylistForMenu.value.songs.length > 0) {
        playSong(0, 'playlist', currentPlaylistForMenu.value.songs);
        openPlaylist(currentPlaylistForMenu.value);
      }
      closePlaylistContextMenu();
    };

    // 重命名歌单
    const renamePlaylist = () => {
      if (currentPlaylistForMenu.value) {
        isEditingPlaylist.value = true;
        editingPlaylistId.value = currentPlaylistForMenu.value.id;
        newPlaylistName.value = currentPlaylistForMenu.value.name;
        newPlaylistDescription.value = currentPlaylistForMenu.value.description || '';
        showCreatePlaylistModal.value = true;
        
        nextTick(() => {
          if (newPlaylistNameInput.value) {
            newPlaylistNameInput.value.focus();
          }
        });
      }
      closePlaylistContextMenu();
    };

    // 删除歌单
    const deletePlaylist = () => {
      if (currentPlaylistForMenu.value) {
        showConfirm(`确定要删除歌单"${currentPlaylistForMenu.value.name}"吗？`, (confirmed) => {
          if (confirmed) {
            const index = playlists.value.findIndex(p => p.id === currentPlaylistForMenu.value.id);
            if (index !== -1) {
              playlists.value.splice(index, 1);
              savePlaylistsToStorage();
            }
            // 如果正在查看这个歌单，返回本地音乐
            if (currentPlaylistId.value === currentPlaylistForMenu.value.id) {
              backToLibrary();
            }
          }
        });
      }
      closePlaylistContextMenu();
    };

    // 显示自定义提示
    const showAlert = (message, title = '提示') => {
      alertTitle.value = title;
      alertMessage.value = message;
      showAlertModal.value = true;
    };

    // 关闭提示模态框
    const closeAlertModal = () => {
      showAlertModal.value = false;
      alertTitle.value = '提示';
      alertMessage.value = '';
    };

    // 显示确认对话框
    const showConfirm = (message, callback, title = '确认') => {
      confirmTitle.value = title;
      confirmMessage.value = message;
      confirmCallback = callback;
      showConfirmModal.value = true;
    };

    // 关闭确认对话框
    const closeConfirmModal = () => {
      showConfirmModal.value = false;
      confirmTitle.value = '确认';
      confirmMessage.value = '';
      confirmCallback = null;
    };

    // 确认操作
    const confirmOk = () => {
      if (confirmCallback) {
        confirmCallback(true);
      }
      closeConfirmModal();
    };

    // 取消操作
    const confirmCancel = () => {
      if (confirmCallback) {
        confirmCallback(false);
      }
      closeConfirmModal();
    };

    // 显示音质选择对话框
    const showQualitySelect = (song, callback) => {
      qualitySelectSong.value = song;
      qualitySelectCallback = callback;
      showQualitySelectModal.value = true;
    };

    // 关闭音质选择对话框
    const closeQualitySelectModal = () => {
      showQualitySelectModal.value = false;
      qualitySelectSong.value = null;
      qualitySelectCallback = null;
    };

    // 选择音质并下载
    const selectQualityAndDownload = (quality) => {
      if (qualitySelectCallback) {
        qualitySelectCallback(quality);
      }
      closeQualitySelectModal();
    };

    // 应用主题设置
    const applyThemeSetting = () => {
      currentTheme.value = settings.value.theme;
      document.body.classList.remove('light-theme');
      if (currentTheme.value === 'light') {
        document.body.classList.add('light-theme');
      }
    };

    // 保存设置
    const saveSettings = () => {
      // 应用当前设置
      applyThemeSetting();
      playMode.value = parseInt(settings.value.defaultPlayMode);
      volume.value = settings.value.defaultVolume;
      showAlert('设置已保存');
    };

    // 重置设置
    const resetSettings = () => {
      showConfirm('确定要重置所有设置为默认值吗？', (confirmed) => {
        if (confirmed) {
          settings.value = {
            theme: 'dark',
            defaultPlayMode: 0,
            autoPlayNext: true,
            defaultVolume: 100,
            playQuality: '320k'
          };
          applyThemeSetting();
          playMode.value = 0;
          volume.value = 100;
          showAlert('设置已重置为默认值');
        }
      });
    };

    // 添加到歌单（增强版）
    const addToPlaylist = (playlist) => {
      if (currentSongForMenu.value) {
        const song = currentSongForMenu.value;
        let exists = false;
        if (song.path) {
          exists = playlist.songs.some(s => s.path === song.path);
        } else {
          exists = playlist.songs.some(s =>
            (s.songmid && s.songmid === song.songmid) ||
            (s.id && s.id === song.id)
          );
        }
        if (!exists) {
          playlist.songs.push({ ...song });
          savePlaylistsToStorage();
        } else {
          showAlert('这首歌已在歌单中');
        }
      }
      closeAllMenus();
    };

    // 导入音源
    const importSource = async () => {
      const filePath = await ipcRenderer.invoke('select-source-file');
      if (!filePath) return;

      const result = await ipcRenderer.invoke('read-source-file', filePath);
      if (!result.success) {
        showAlert('读取音源文件失败：' + result.error);
        return;
      }

      try {
        const scriptInfo = parseScriptInfo(result.content);
        const sourceInfo = {
          id: `source_${Date.now()}`,
          name: scriptInfo.name || '未知音源',
          version: scriptInfo.version || '1.0.0',
          author: scriptInfo.author || '',
          description: scriptInfo.description || '',
          script: result.content,
          filePath: filePath // 保存音源文件路径
        };

        importedSources.value.push(sourceInfo);
        saveSourcesToStorage();
        
        // 注册音源到 main.js
        await ipcRenderer.invoke('register-source', sourceInfo);
        
        // 自动加载刚导入的音源
        try {
          // 使用 userApiRendererEvent 加载音源
          await userApiRendererEvent.loadApi(sourceInfo.id, sourceInfo);
          
          // 更新 sourceManager 状态
          sourceManager.currentSource = sourceInfo;
          sourceManager.isReady = true;
          currentSourceId.value = sourceInfo.id;
          
          showAlert('音源导入并加载成功：' + sourceInfo.name);
        } catch (error) {
          showAlert('音源导入成功，但加载失败：' + error.message);
        }
      } catch (error) {
        showAlert('无效的音源文件：' + error.message);
      }
    };

    // 解析脚本信息
    const parseScriptInfo = (script) => {
      const result = /^\/\*[\S|\s]+?\*\//.exec(script);
      if (!result) throw new Error('无效的自定义源文件');

      const infoNames = {
        name: 24,
        description: 36,
        author: 56,
        homepage: 1024,
        version: 36,
      };

      const rxp = /^\s?\*\s?@(\w+)\s(.+)$/;
      const infos = {};
      const infoArr = result[0].split(/\r?\n/);

      for (const info of infoArr) {
        const res = rxp.exec(info);
        if (!res) continue;
        const key = res[1];
        if (infoNames[key] == null) continue;
        infos[key] = res[2].trim();
      }

      for (const [key, len] of Object.entries(infoNames)) {
        if (!infos[key]) infos[key] = '';
        else if (infos[key].length > len) {
          infos[key] = infos[key].substring(0, len) + '...';
        }
      }

      return infos;
    };

    // 删除音源
    const removeSource = (sourceId) => {
      const index = importedSources.value.findIndex(s => s.id === sourceId);
      if (index !== -1) {
        const name = importedSources.value[index].name;
        importedSources.value.splice(index, 1);
        if (currentSourceId.value === sourceId) {
          currentSourceId.value = null;
        }
        saveSourcesToStorage();
        showAlert('已删除音源：' + name);
      }
    };

    // 保存音源到本地存储
    const saveSourcesToStorage = () => {
      try {
        console.log('[app.js] 开始保存音源到本地存储');
        console.log('[app.js] 当前音源数量:', importedSources.value.length);
        // 创建可序列化的音源数据
        const data = importedSources.value.map(s => {
          // 只保存必要的可序列化属性
          return {
            id: s.id,
            name: s.name,
            version: s.version,
            author: s.author,
            description: s.description,
            script: s.script,
            filePath: s.filePath // 保存音源文件路径
          };
        });
        const jsonData = JSON.stringify(data);
        console.log('[app.js] 音源数据大小:', jsonData.length, '字节');
        
        // 检查数据大小是否超过 localStorage 限制（约 5MB）
        if (jsonData.length > 5 * 1024 * 1024) {
          console.error('[app.js] 音源数据过大，超过 localStorage 限制');
          showAlert('保存音源失败：数据过大，超过存储限制');
          return;
        }
        
        localStorage.setItem('musicPlayer_sources', jsonData);
        console.log('[app.js] 音源保存成功');
        // 验证保存是否成功
        const savedData = localStorage.getItem('musicPlayer_sources');
        if (savedData) {
          console.log('[app.js] 验证保存成功，保存的数据长度:', savedData.length, '字节');
          // 验证数据是否可解析
          try {
            const parsedData = JSON.parse(savedData);
            console.log('[app.js] 验证数据可解析，解析后音源数量:', parsedData.length);
            // 验证是否包含 filePath 属性
            if (parsedData.length > 0 && parsedData[0].filePath) {
              console.log('[app.js] 验证数据包含 filePath 属性');
            } else {
              console.error('[app.js] 验证数据不包含 filePath 属性');
            }
          } catch (parseError) {
            console.error('[app.js] 验证数据解析失败:', parseError);
            showAlert('保存音源失败：数据解析验证失败');
          }
        } else {
          console.error('[app.js] 验证保存失败，localStorage 中没有数据');
          showAlert('保存音源失败：验证保存失败');
        }
      } catch (e) {
        console.error('[app.js] 保存音源失败:', e);
        showAlert('保存音源失败：' + e.message);
      }
    };

    // 保存收藏列表到本地存储
    const saveFavoritesToStorage = () => {
      try {
        localStorage.setItem('musicPlayer_favorites', JSON.stringify(favorites.value));
      } catch (e) {
        console.error('保存收藏失败:', e);
      }
    };

    // 加载收藏列表
    const loadFavoritesFromStorage = () => {
      try {
        const data = localStorage.getItem('musicPlayer_favorites');
        if (data) {
          favorites.value = JSON.parse(data);
        }
      } catch (e) {
        console.error('加载收藏失败:', e);
      }
    };

    // 保存导入的音乐路径到本地存储
    const saveImportedPathsToStorage = async () => {
      try {
        // 提取所有音乐文件的路径
        const paths = musicFiles.value.map(s => s.path);
        console.log('[app.js] 开始保存导入路径到本地存储，路径数量:', paths.length);
        
        // 保存到 main.js 的 localStorage
        await ipcRenderer.invoke('save-imported-paths', paths);
        console.log('[app.js] 导入路径保存成功');
      } catch (e) {
        console.error('[app.js] 保存导入路径失败:', e);
      }
    };

    // 加载已保存的导入路径并扫描音乐
    const loadImportedPathsAndScan = async () => {
      try {
        console.log('[app.js] 开始加载已保存的导入路径');
        
        // 从 main.js 的 localStorage 加载路径
        const savedPaths = await ipcRenderer.invoke('load-imported-paths');
        console.log('[app.js] 加载到已保存路径数量:', savedPaths.length);
        
        if (savedPaths && savedPaths.length > 0) {
          // 扫描路径获取音乐文件
          const files = await ipcRenderer.invoke('scan-music-folder', savedPaths);
          console.log('[app.js] 扫描到音乐文件数量:', files.length);
          
          if (files.length > 0) {
            musicFiles.value = files;
            generateShuffledIndices();
            console.log('[app.js] 音乐加载成功');
          } else {
            console.log('[app.js] 扫描结果为空，可能文件已被移动或删除');
            showAlert('部分导入的音乐文件可能已被移动或删除');
          }
        }
      } catch (e) {
        console.error('[app.js] 加载导入路径失败:', e);
      }
    };

    // 保存歌单到本地存储
    const savePlaylistsToStorage = () => {
      try {
        localStorage.setItem('musicPlayer_playlists', JSON.stringify(playlists.value));
      } catch (e) {
        console.error('保存歌单失败:', e);
      }
    };

    // 加载歌单
    const loadPlaylistsFromStorage = () => {
      try {
        const data = localStorage.getItem('musicPlayer_playlists');
        if (data) {
          playlists.value = JSON.parse(data);
        }
      } catch (e) {
        console.error('加载歌单失败:', e);
      }
    };

    // 加载本地存储的音源
    const loadSourcesFromStorage = async () => {
      try {
        console.log('[app.js] 开始加载本地存储的音源');
        const data = localStorage.getItem('musicPlayer_sources');
        console.log('[app.js] 本地存储中的音源数据:', data ? '存在' : '不存在');
        if (data) {
          try {
            // 先验证数据是否为空或无效
            if (!data || data === 'null' || data === 'undefined' || data === '') {
              console.error('[app.js] 本地存储中的音源数据为空或无效');
              showAlert('加载音源失败：数据为空或无效');
              return;
            }
            
            // 解析音源数据
            const parsedData = JSON.parse(data);
            console.log('[app.js] 成功解析音源数据，共', parsedData.length, '个音源');
            
            // 验证解析后的数据是否为数组
            if (!Array.isArray(parsedData)) {
              console.error('[app.js] 解析后的数据不是数组');
              showAlert('加载音源失败：数据格式错误');
              return;
            }
            
            // 过滤无效的音源对象并检查文件是否存在
            const validSources = [];
            for (const source of parsedData) {
              if (source && typeof source === 'object' && source.id && source.name) {
                console.log('[app.js] 检查音源:', source.name, 'filePath:', source.filePath);
                let scriptContent = source.script;
                
                if (source.filePath) {
                  const fileExists = await ipcRenderer.invoke('check-file-exists', source.filePath);
                  if (fileExists) {
                    try {
                      const result = await ipcRenderer.invoke('read-source-file', source.filePath);
                      if (result.success) {
                        scriptContent = result.content;
                        console.log('[app.js] 重新读取音源文件成功:', source.name);
                      } else {
                        console.log('[app.js] 重新读取失败，使用存储的脚本:', source.name, result.error);
                      }
                    } catch (readError) {
                      console.log('[app.js] 读取异常，使用存储的脚本:', source.name, readError.message);
                    }
                  } else {
                    console.log('[app.js] 音源文件不在磁盘，使用存储的脚本内容:', source.name);
                  }
                } else {
                  console.log('[app.js] 无文件路径，使用存储的脚本内容:', source.name);
                }
                
                if (scriptContent) {
                  const updatedSource = {
                    ...source,
                    script: scriptContent
                  };
                  validSources.push(updatedSource);
                } else {
                  console.error('[app.js] 音源无脚本内容，跳过:', source.name);
                }
              } else {
                console.error('[app.js] 无效的音源对象:', source);
              }
            }
            
            console.log('[app.js] 过滤后有效音源数量:', validSources.length);
            
            // 更新 importedSources
            importedSources.value = validSources;
            
            // 保存更新后的音源列表
            saveSourcesToStorage();
            
            // 重新注册所有有效音源到 main.js
            let firstSourceSet = false;
            for (const source of validSources) {
              console.log('[app.js] 注册音源:', source.name);
              // 创建可序列化的音源对象
              const serializableSource = {
                id: source.id,
                name: source.name,
                version: source.version,
                author: source.author,
                description: source.description,
                script: source.script,
                filePath: source.filePath
              };
              try {
                await ipcRenderer.invoke('register-source', serializableSource);
                console.log('[app.js] 注册音源成功:', source.name);
                
                // 自动加载音源到 userApiRendererEvent
                try {
                  await userApiRendererEvent.loadApi(source.id, source);
                  console.log('[app.js] 加载音源成功:', source.name);
                  
                  // 更新 sourceManager 状态
                  sourceManager.currentSource = source;
                  sourceManager.isReady = true;
                  
                  // 只在第一个音源加载成功时设置为当前音源
                  if (!firstSourceSet) {
                    currentSourceId.value = source.id;
                    firstSourceSet = true;
                    console.log('[app.js] 设置默认音源:', source.name);
                  }
                } catch (loadError) {
                  console.error('[app.js] 加载音源失败:', source.name, loadError.message);
                  // 继续加载其他音源，不要因为一个失败而停止
                }
              } catch (registerError) {
                console.error('[app.js] 注册音源失败:', source.name, registerError.message);
                // 继续注册其他音源，不要因为一个失败而停止
              }
            }
            console.log('[app.js] 已重新注册并加载', validSources.length, '个音源');
          } catch (parseError) {
            console.error('[app.js] 解析音源数据失败:', parseError);
            showAlert('加载音源失败：解析数据出错');
            // 清除损坏的数据
            localStorage.removeItem('musicPlayer_sources');
            console.log('[app.js] 已清除损坏的音源数据');
          }
        } else {
          console.log('[app.js] 本地存储中没有音源数据');
        }
      } catch (e) {
        console.error('[app.js] 加载音源失败:', e);
        showAlert('加载音源失败：' + e.message);
      }
    };

    // 加载音源脚本（用于切换音源）
    const loadSourceScript = async (source) => {
      try {
        // 如果点击的是当前已加载的音源，直接打开搜索界面
        if (currentSourceId.value === source.id && sourceManager.isSourceReady()) {
          currentView.value = 'sourceSearch';
          searchQuery.value = '';
          sourceSearchResults.value = [];
          return;
        }

        // 创建纯对象副本，避免 Vue 响应式 Proxy 导致 IPC 序列化问题
        const plainSource = {
          id: source.id,
          name: source.name,
          version: source.version || '',
          author: source.author || '',
          description: source.description || '',
          script: source.script,
          filePath: source.filePath || ''
        };

        // 使用 userApiRendererEvent 加载音源
        await userApiRendererEvent.loadApi(plainSource.id, plainSource);
        
        // 更新 sourceManager 状态
        sourceManager.currentSource = source;
        sourceManager.isReady = true;
        currentSourceId.value = source.id;
        
        // 打开搜索界面
        currentView.value = 'sourceSearch';
        searchQuery.value = '';
        sourceSearchResults.value = [];
        
        console.log('[app.js] 音源切换成功:', source.name);
      } catch (error) {
        console.error('[app.js] 加载音源失败:', error.message);
        showAlert('加载音源失败：' + error.message);
      }
    };

    // 打开音源搜索（点击音源时调用）
    const openSourceSearch = async (source) => {
      if (source === null) {
        if (!currentSourceId.value) {
          showAlert('请先在设置中选择音源');
          return;
        }
        currentView.value = 'sourceSearch';
        searchQuery.value = '';
        sourceSearchResults.value = [];
        return;
      }

      await loadSourceScript(source);
    };

    const getSourceName = (sourceId) => {
      const source = importedSources.value.find(s => s.id === sourceId);
      return source ? source.name : '';
    };

    const selectCurrentSource = async () => {
      if (!currentSourceId.value) {
        return;
      }
      const source = importedSources.value.find(s => s.id === currentSourceId.value);
      if (source) {
        await loadSourceScript(source);
      }
    };

    // 执行搜索
    const performSearch = async () => {
      if (!searchQuery.value.trim()) return;
      if (!currentSourceId.value) return;

      const source = importedSources.value.find(s => s.id === currentSourceId.value);
      if (!source) return;

      isSearching.value = true;
      sourceSearchResults.value = [];

      try {
        const results = await executeSourceSearch(source, searchQuery.value);
        sourceSearchResults.value = results;
      } catch (error) {
        console.error('搜索失败:', error);
        showAlert('搜索失败：' + error.message);
      } finally {
        isSearching.value = false;
      }
    };

    // 执行音源搜索
    const executeSourceSearch = async (source, query) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('搜索超时'));
        }, 30000);

        const cleanup = () => {
          clearTimeout(timeout);
          ipcRenderer.removeAllListeners('source-search-result');
          ipcRenderer.removeAllListeners('source-search-error');
        };

        ipcRenderer.send('source-search', { id: source.id, name: source.name, script: source.script }, query);

        ipcRenderer.once('source-search-result', (event, data) => {
          cleanup();
          resolve(data);
        });

        ipcRenderer.once('source-search-error', (event, error) => {
          cleanup();
          reject(new Error(error));
        });
      });
    };

    // 下载音源歌曲
    const downloadSourceSong = async (song) => {
      // 弹出音质选择框
      showQualitySelect(song, async (quality) => {
        // 显示正在获取信息
        showAlert('正在获取歌曲信息...');

        // 获取封面
        let coverUrl = song.cover || null;
        if (!coverUrl && song.source && musicSdk.getPic) {
          try {
            coverUrl = await musicSdk.getPic(song);
          } catch (e) {
          }
        }

        // 获取歌词
        let lyricText = null;
        if (sourceManager.isSourceReady()) {
          try {
            const sourceLyric = await sourceManager.request(song.source, 'lyric', { musicInfo: song });
            if (sourceLyric && typeof sourceLyric === 'object') {
              lyricText = sourceLyric.lyric || sourceLyric.lrc || null;
            } else if (typeof sourceLyric === 'string' && sourceLyric.trim()) {
              lyricText = sourceLyric;
            }
          } catch (e) {
          }
        }
        if (!lyricText) {
          try {
            const result = await musicSdk.getLyric(song);
            if (result && result.lyric) lyricText = result.lyric;
          } catch (e) {
          }
        }

        // 获取音频 URL
        if (song.source) {
          try {
            const urlData = await sourceManager.request(song.source, 'musicUrl', {
              type: quality,
              musicInfo: song
            });
            song.url = urlData;
          } catch (error) {
            showAlert('无法下载：获取音频 URL 失败 - ' + error.message);
            return;
          }
        }

        if (!song.url) {
          showAlert('无法下载：该歌曲没有音频 URL');
          return;
        }

        // 根据音质添加正确的文件扩展名
        const ext = quality === 'flac' ? '.flac' : '.mp3';
        const filename = `${song.title} - ${song.artist}${ext}`;
        try {
          const result = await ipcRenderer.invoke('download-file', song.url, filename, {
            coverUrl: coverUrl,
            lyrics: lyricText,
            title: song.title,
            artist: song.artist,
            album: song.album
          });
          if (result.success) {
            showAlert('下载成功：' + result.path);
          } else {
            showAlert('下载失败：' + result.message);
          }
        } catch (error) {
          showAlert('下载失败：' + error.message);
        }
      });
    };

    // 处理下载按钮点击
    const handleDownload = async (song) => {
      // 如果是本地歌曲，直接播放
      if (song.path) {
        playLocalFile(song.path, song);
        return;
      }
      
      // 如果已下载，直接播放本地文件
      if (song.downloaded && song.downloadedPath) {
        playLocalFile(song.downloadedPath, song);
        return;
      }
      
      // 检查是否已下载但未设置 downloadedPath
      const downloaded = await isSongDownloaded(song);
      if (downloaded && song.downloadedPath) {
        playLocalFile(song.downloadedPath, song);
        return;
      }
      
      // 未下载，执行下载
      downloadSourceSong(song);
    };
    
    // 获取下载图标
    const getDownloadIcon = (song) => {
      // 只显示下载图标
      return '#icon-download';
    };
    
    // 获取下载标题
    const getDownloadTitle = (song) => {
      return '下载';
    };
    
    // 初始化歌曲下载状态
    const initSongDownloadStatus = async (songs) => {
      if (!songs || !Array.isArray(songs)) return;
      
      for (const song of songs) {
        // 跳过本地歌曲，它们已经是下载状态
        if (song.path) {
          song.downloaded = true;
          continue;
        }
        
        // 检查是否已经有下载状态
        if (song.downloaded !== undefined) {
          continue;
        }
        
        // 异步检查下载状态，不阻塞 UI 渲染
        isSongDownloaded(song).then(downloaded => {
          song.downloaded = downloaded;
        });
      }
    };
    
    // 播放本地文件
    const playLocalFile = async (filePath, songInfo) => {
      if (audio) {
        audio.pause();
        audio.src = '';
        audio.load();
        audio.onerror = null;
        audio.onended = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.ontimeupdate = null;
        audio.onloadedmetadata = null;
        audio = null;
      }

      audio = new Audio(filePath);
      audio.crossOrigin = 'anonymous';
      audio.volume = volume.value / 100;

      audio.onloadedmetadata = () => {
        totalTime.value = audio.duration;
      };

      audio.ontimeupdate = () => {
        currentTime.value = audio.currentTime;
        updateCurrentLyric();
      };

      audio.onended = () => {
        if (settings.value.autoPlayNext) {
          playBuiltinNext();
        }
      };

      audio.onplay = () => {
        isPlaying.value = true;
      };

      audio.onpause = () => {
        isPlaying.value = false;
      };

      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
      };

      try {
        await audio.play();
        isPlaying.value = true;
        
        // 更新当前播放歌曲信息
        if (songInfo) {
          currentBuiltinSong.value = songInfo;
          loadBuiltinLyrics(songInfo);
        }
      } catch (error) {
        console.error('播放失败:', error);
        showAlert('播放失败：' + error.message);
      }
    };

    // 播放音源歌曲
    const playSourceSong = async (song) => {
      // 取消之前的播放请求
      pendingPlayToken.cancelled = true;
      const currentToken = { cancelled: false };
      pendingPlayToken = currentToken;

      // 优先检查是否已下载，如果已下载则播放本地文件
      if (!song.path) {
        const downloaded = await isSongDownloaded(song);
        if (currentToken.cancelled) return;
        if (downloaded && song.downloadedPath) {
          playLocalFile(song.downloadedPath, song);
          return;
        }
      }

      // 每次播放都根据当前设置的音质重新获取 URL
      if (song.source) {
        let urlObtained = false;
        const triedSources = new Set();
        const currentId = currentSourceId.value;
        if (currentId) triedSources.add(currentId);

        try {
          const urlData = await sourceManager.request(song.source, 'musicUrl', {
            type: settings.value.playQuality,
            musicInfo: song
          });
          if (currentToken.cancelled) return;
          song.url = urlData;
          urlObtained = true;
        } catch (firstError) {
          console.warn('[playSourceSong] 当前音源失败:', firstError.message, '，尝试其他音源');
        }

        if (!urlObtained) {
          for (const s of importedSources.value) {
            if (currentToken.cancelled) return;
            if (triedSources.has(s.id)) continue;
            triedSources.add(s.id);
            try {
              userApiRendererEvent.setActiveSource(s);
              sourceManager.currentSource = s;
              currentSourceId.value = s.id;
              const urlData = await sourceManager.request(song.source, 'musicUrl', {
                type: settings.value.playQuality,
                musicInfo: song
              });
              if (currentToken.cancelled) return;
              song.url = urlData;
              urlObtained = true;
              break;
            } catch (err) {
              console.warn('[playSourceSong] 音源', s.name, '也失败:', err.message);
            }
          }
        }

        if (!urlObtained) {
          if (currentToken.cancelled) return;
          showAlert('所有音源都无法获取该歌曲的播放链接', '播放失败');
          return;
        }
      }
      
      if (!song.url || typeof song.url !== 'string' || !/^https?:/.test(song.url)) {
        if (currentToken.cancelled) return;
        showAlert('该歌曲没有可用的播放URL，请尝试更换音源或音乐平台', '播放错误');
        return;
      }
      
      // 先用 fetch 测试 URL 是否可达，超时 10 秒
      // QQ音乐(tx)服务器不支持HEAD，改用GET
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const fetchMethod = song.source === 'tx' ? 'GET' : 'HEAD';
        const response = await fetch(song.url, { method: fetchMethod, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          if (currentToken.cancelled) return;
          showAlert('该歌曲播放链接无效（状态码: ' + response.status + '），请尝试更换音源', '播放错误');
          return;
        }
      } catch (fetchError) {
        if (currentToken.cancelled) return;
        if (fetchError.name === 'AbortError') {
          showAlert('播放链接响应超时（5秒），请尝试更换音源或音乐平台', '播放错误');
        } else {
          showAlert('无法连接到播放服务器，请尝试更换音源或音乐平台', '播放错误');
        }
        return;
      }
      
      if (audio) {
        audio.pause();
        audio.src = '';
        audio.load();
        audio.onerror = null;
        audio.onended = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.ontimeupdate = null;
        audio.onloadedmetadata = null;
        audio = null;
      }

      audio = new Audio(song.url);
      audio.crossOrigin = 'anonymous';
      audio.volume = volume.value / 100;

      audio.onloadedmetadata = () => {
        totalTime.value = audio.duration;
      };

      audio.ontimeupdate = () => {
        currentTime.value = audio.currentTime;
        updateCurrentLyric();
      };

      audio.onended = () => {
        if (settings.value.autoPlayNext) {
          playBuiltinNext();
        }
      };

      audio.onplay = () => {
        isPlaying.value = true;
      };

      audio.onpause = () => {
        isPlaying.value = false;
      };

      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
      };

      try {
        await audio.play();
        if (currentToken.cancelled) return;
        isPlaying.value = true;
        currentPlayContext.value = 'builtin';
        currentBuiltinSong.value = null;
        await nextTick();
        currentBuiltinSong.value = song;

        // 加载歌词
        loadBuiltinLyrics(song);
      } catch (error) {
        if (currentToken.cancelled) return;
        console.error('播放失败:', error);
      }
    };
    
    // 执行内置音源搜索
    const performBuiltinSearch = async () => {
      if (!searchQuery.value.trim()) return;

      isBuiltinSearching.value = true;
      builtinSearchResults.value = [];

      try {
        const results = await musicSdk.searchMusic(
          searchQuery.value,
          1, // page
          30, // limit
          builtinSearchSource.value
        );

        // 如果是多平台搜索，合并结果
        if (Array.isArray(results)) {
          builtinSearchResults.value = results.flatMap(r => r.list || []);
        } else {
          builtinSearchResults.value = results.list || [];
        }

        // 为酷狗音乐获取封面
        const kgSongs = builtinSearchResults.value.filter(s => s.source === 'kg' && !s.cover);
        for (const song of kgSongs) {
          try {
            const pic = await musicSdk.getPic(song);
            if (pic) {
              song.cover = pic;
            }
          } catch (e) {
            console.error('获取封面失败:', e);
          }
        }

        // 保持在当前搜索视图，不切换
        // currentView 已经是 'sourceSearch'，不需要切换
      } catch (error) {
        console.error('搜索失败:', error);
        showAlert('搜索失败：' + error.message);
      } finally {
        isBuiltinSearching.value = false;
      }
    };
    
    // 在线播放防抖控制
    let lastPlayTime = 0;
    const PLAY_INTERVAL_LIMIT = 1000; // 1 秒内只能切一次歌

    const playSearchResult = (song) => {
      const songIndex = builtinSearchResults.value.findIndex(s =>
        (s.hash && song.hash && s.hash === song.hash) ||
        (s.id && song.id && s.id === song.id) ||
        (s.songmid && song.songmid && s.songmid === song.songmid)
      );

      currentPlayContext.value = 'builtin';
      currentContextSongs.value = [...builtinSearchResults.value];
      currentContextIndex.value = songIndex >= 0 ? songIndex : 0;
      playBuiltinSong(song);
    };

    // 播放内置搜索歌曲
    const playBuiltinSong = async (song, onPlaySuccess) => {
      // 取消之前的播放请求
      pendingPlayToken.cancelled = true;
      const currentToken = { cancelled: false };
      pendingPlayToken = currentToken;

      // 获取封面（酷狗音乐需要单独获取）
      if (!song.cover && song.source === 'kg') {
        try {
          const pic = await musicSdk.getPic(song);
          if (currentToken.cancelled) return;
          if (pic) {
            song.cover = pic;
          }
        } catch (e) {
        }
      }

      if (song.source) {
        if (!sourceManager.isSourceReady()) {
          showAlert('请先在设置中加载音源以播放在线音乐', '播放提示');
          return;
        }

        let urlObtained = false;
        const triedSources = new Set();
        const currentId = currentSourceId.value;
        if (currentId) triedSources.add(currentId);

        const validateUrl = async (url) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
            clearTimeout(timeoutId);
            if (!response.ok) {
              console.warn('[playBuiltinSong] URL无效, 状态码:', response.status);
              return false;
            }
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json') || contentType.includes('text/html')) {
              console.warn('[playBuiltinSong] URL返回了非音频内容:', contentType);
              return false;
            }
            return true;
          } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
              console.warn('[playBuiltinSong] URL响应超时');
            } else {
              console.warn('[playBuiltinSong] URL连接失败:', fetchError.message);
            }
            return false;
          }
        };

        const tryGetUrl = async (source, songSrc) => {
          const urlData = await sourceManager.request(source, 'musicUrl', {
            type: settings.value.playQuality,
            musicInfo: song
          });
          console.log('[playBuiltinSong] urlData 类型:', typeof urlData, '值:', urlData);
          if (typeof urlData !== 'string' || !/^https?:/.test(urlData)) {
            throw new Error('音源返回了无效的URL格式: ' + typeof urlData);
          }
          const isValid = await validateUrl(urlData);
          if (!isValid) {
            throw new Error('音源返回的URL不可达');
          }
          return urlData;
        };

        try {
          song.url = await tryGetUrl(song.source, song.source);
          if (currentToken.cancelled) return;
          urlObtained = true;
        } catch (firstError) {
          console.warn('[playBuiltinSong] 当前音源失败:', firstError.message, '，尝试其他音源');
        }

        if (!urlObtained) {
          console.log('[playBuiltinSong] 开始回退循环，音源总数:', importedSources.value.length);
          for (const s of importedSources.value) {
            if (currentToken.cancelled) return;
            console.log('[playBuiltinSong] 检查音源:', s.name, 'ID:', s.id, '已尝试:', triedSources.has(s.id));
            if (triedSources.has(s.id)) {
              console.log('[playBuiltinSong] 跳过已尝试的音源:', s.name);
              continue;
            }
            triedSources.add(s.id);
            console.log('[playBuiltinSong] 切换到音源:', s.name, '请求平台:', song.source);
            try {
              userApiRendererEvent.setActiveSource(s);
              sourceManager.currentSource = s;
              currentSourceId.value = s.id;
              const urlData = await sourceManager.request(song.source, 'musicUrl', {
                type: settings.value.playQuality,
                musicInfo: song
              });
              if (currentToken.cancelled) return;
              console.log('[playBuiltinSong] 音源', s.name, 'urlData 类型:', typeof urlData);
              if (typeof urlData !== 'string' || !/^https?:/.test(urlData)) {
                throw new Error('音源返回了无效的URL格式');
              }
              const isValid = await validateUrl(urlData);
              if (currentToken.cancelled) return;
              if (!isValid) {
                throw new Error('音源返回的URL不可达');
              }
              song.url = urlData;
              urlObtained = true;
              console.log('[playBuiltinSong] 音源', s.name, '获取URL成功:', urlData.substring(0, 80));
              break;
            } catch (err) {
              console.warn('[playBuiltinSong] 音源', s.name, '失败:', err.message);
            }
          }
        }

        if (!urlObtained) {
          if (currentToken.cancelled) return;
          showAlert('所有音源都无法获取该歌曲的播放链接', '播放失败');
          return;
        }
      }

      if (!song.url || typeof song.url !== 'string' || !/^https?:/.test(song.url)) {
        if (currentToken.cancelled) return;
        showAlert('获取到的播放链接无效，请尝试更换音源或音乐平台', '播放错误');
        return;
      }

      if (audio) {
        audio.src = '';
        audio.load();
        audio.onerror = null;
        audio.onended = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.ontimeupdate = null;
        audio.onloadedmetadata = null;
        audio = null;
      }

      audio = new Audio(song.url);
      audio.crossOrigin = 'anonymous';
      audio.volume = volume.value / 100;

      audio.onloadedmetadata = () => {
        totalTime.value = audio.duration;
      };

      audio.ontimeupdate = () => {
        currentTime.value = audio.currentTime;
        updateCurrentLyric();
      };

      audio.onended = () => {
        if (settings.value.autoPlayNext) {
          playBuiltinNext();
        }
      };

      audio.onplay = () => {
        isPlaying.value = true;
      };

      audio.onpause = () => {
        isPlaying.value = false;
      };

      audio.onerror = (e) => {
        const audioEl = e.target;
        const errorCode = audioEl ? audioEl.error?.code : 'unknown';
        console.error('[playBuiltinSong] Audio错误, code:', errorCode, 'url:', song.url?.substring(0, 100));
        let errorMsg = 'url获取失败，请尝试更换音源或音乐平台';
        if (errorCode === 4) errorMsg = '不支持的音频格式，请尝试更换音源';
        showAlert(errorMsg, '播放错误');
      };

      try {
        await audio.play();
        if (currentToken.cancelled) return;
        isPlaying.value = true;
        
        currentBuiltinSong.value = null;
        await nextTick();
        currentBuiltinSong.value = song;

        // 执行播放成功后的回调（例如设置当前索引）
        if (onPlaySuccess) {
          onPlaySuccess();
        }

        // 更新最近播放列表（从最近播放列表播放时不更新）
        if (currentPlayContext.value !== 'recent') {
          updateRecentlyPlayed(song);
        }

        // 如果在大屏模式，初始化频谱
        if (showFullscreen.value) {
          initSpectrum();
        }

        // 异步加载歌词，不阻塞播放流程
        loadBuiltinLyrics(song);
      } catch (error) {
        if (currentToken.cancelled) return;
        showAlert('url获取失败，请尝试更换音源或音乐平台', '播放错误');
      }
    };

    const loadBuiltinLyrics = async (song) => {
      // 如果有内嵌歌词，优先使用
      if (song.lyrics) {
        parseLyrics(song.lyrics);
        showSubtitles.value = lyricsLines.value.length > 0;
        return;
      }

      // 如果没有 source（本地歌曲且没有内嵌歌词），直接返回
      if (!song.source) {
        lyricsLines.value = [];
        showSubtitles.value = false;
        return;
      }

      let lyricText = null;

      try {
        // 优先使用 sourceManager（自定义音源脚本）获取歌词
        if (sourceManager.isSourceReady()) {
          try {
            const sourceLyric = await sourceManager.request(song.source, 'lyric', {
              musicInfo: song
            });
            // 音源脚本返回的是 { lyric: "..." } 格式，需要提取 lyric 属性
            if (sourceLyric && typeof sourceLyric === 'object') {
              lyricText = sourceLyric.lyric || sourceLyric.lrc || null;
            } else if (typeof sourceLyric === 'string' && sourceLyric.trim()) {
              lyricText = sourceLyric;
            }
          } catch (sourceError) {
          }
        }

        // 如果音源脚本没有获取到歌词，尝试内置SDK
        if (!lyricText) {
          try {
            const result = await musicSdk.getLyric(song);
            if (result && result.lyric) {
              lyricText = result.lyric;
            }
          } catch (sdkError) {
          }
        }

        if (lyricText) {
          parseLyrics(lyricText);
          showSubtitles.value = lyricsLines.value.length > 0;
        } else {
          lyricsLines.value = [];
          showSubtitles.value = false;
        }
      } catch (error) {
        lyricsLines.value = [];
        showSubtitles.value = false;
      }
    };

    const playBuiltinSongWithIndex = async (song, index) => {
      await playBuiltinSong(song, () => {
        currentContextIndex.value = index;
      });
    };

    const playBuiltinNext = async () => {
      if (currentContextSongs.value.length === 0) return;

      let newIndex;
      if (playMode.value === 0) {
        newIndex = getRandomSongIndex();
      } else {
        newIndex = currentContextIndex.value + 1;
        if (newIndex >= currentContextSongs.value.length) newIndex = 0;
      }

      const nextSong = currentContextSongs.value[newIndex];
      if (nextSong) {
        if (nextSong.path) {
          currentContextIndex.value = newIndex;
          playSong(newIndex, currentPlayContext.value, currentContextSongs.value);
        } else {
          await playBuiltinSongWithIndex(nextSong, newIndex);
        }
      }
    };

    const playBuiltinPrev = async () => {
      if (currentContextSongs.value.length === 0) return;

      let newIndex;
      if (playMode.value === 0) {
        newIndex = getRandomSongIndex();
      } else {
        newIndex = currentContextIndex.value - 1;
        if (newIndex < 0) newIndex = currentContextSongs.value.length - 1;
      }

      const prevSong = currentContextSongs.value[newIndex];
      if (prevSong) {
        if (prevSong.path) {
          currentContextIndex.value = newIndex;
          playSong(newIndex, currentPlayContext.value, currentContextSongs.value);
        } else {
          await playBuiltinSongWithIndex(prevSong, newIndex);
        }
      }
    };

    const handleKeyDown = (e) => {
      if (showFullscreen.value && e.code === 'Escape') {
        toggleFullscreen();
        return;
      }
      
      switch(e.code) {
        case 'Space':
          // 只有在全屏模式或状态栏获得焦点时才允许空格键控制播放暂停
          if (showFullscreen.value || isPlayerBarFocused.value) {
            e.preventDefault();
            togglePlay();
          }
          break;
        case 'ArrowLeft':
          if (audio && audio.currentTime > 5) {
            audio.currentTime -= 5;
          }
          break;
        case 'ArrowRight':
          if (audio && audio.duration - audio.currentTime > 5) {
            audio.currentTime += 5;
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          const volumeUp = Math.min(100, volume.value + 5);
          setVolume(volumeUp);
          break;
        case 'ArrowDown':
          e.preventDefault();
          const volumeDown = Math.max(0, volume.value - 5);
          setVolume(volumeDown);
          break;
      }
    };

    ipcRenderer.on('play-pause', togglePlay);
    ipcRenderer.on('previous-song', previousSong);
    ipcRenderer.on('next-song', nextSong);

    onMounted(async () => {
      document.addEventListener('keydown', handleKeyDown);
      
      // 监听状态栏点击事件，设置焦点标志
      const playerBar = document.querySelector('.player-bar');
      if (playerBar) {
        playerBar.addEventListener('click', () => {
          isPlayerBarFocused.value = true;
        });
        playerBar.addEventListener('mouseenter', () => {
          isPlayerBarFocused.value = true;
        });
      }
      
      // 监听全局点击，当点击非状态栏区域时移除焦点
      document.addEventListener('click', (e) => {
        if (playerBar && !playerBar.contains(e.target)) {
          isPlayerBarFocused.value = false;
        }
      });
      
      // 先初始化 userApiRendererEvent
      userApiRendererEvent.init();
      console.log('[app.js] userApiRendererEvent 已初始化');
      
      // 加载设置
      loadSettings();
      
      // 然后加载音源和其他数据
      await loadSourcesFromStorage();
      // 加载默认音源
      loadDefaultSources();
      loadFavoritesFromStorage();
      loadPlaylistsFromStorage();
      
      // 加载已保存的导入路径并扫描音乐
      await loadImportedPathsAndScan();
    });

    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown);
      stopSpectrum();
      if (audio) {
        audio.pause();
      }
    });

    return {
      musicFiles,
      currentSongIndex,
      selectedSongIndex,
      isPlaying,
      playMode,
      currentTime,
      totalTime,
      volume,
      showFullscreen,
      isExitingFullscreen,
      currentView,
      spectrumCanvas,
      waveScale,
      waveOpacity,
      waveDuration,
      sidebar,
      isResizing,
      currentAlbum,
      currentArtist,
      showAlbumDetail,
      showArtistDetail,
      showPlaylist,
      currentSong,
      progress,
      playModeText,
      isShuffle,
      repeatMode,
      volumeIcon,
      pageTitle,
      displaySongs,
      isPlaylistItemPlaying,
      minimizeWindow,
      maximizeWindow,
      closeWindow,
      formatTime,
      importMusic,
      selectImportType,
      showImportTypeModal,
      playSong,
      togglePlay,
      previousSong,
      nextSong,
      togglePlayMode,
      seekTo,
      setVolume,
      toggleMute,
      toggleFullscreen,
      getSongIndex,
      getSongIndexByArtist,
      startResizing,
      openAlbumDetail,
      openArtistDetail,
      backToAlbums,
      backToArtists,
      togglePlaylist,
      currentTheme,
      toggleTheme,
      toggleFavorite,
      isFavorite,
      favorites,
      recentlyPlayed,
      playlistSongs,
      currentPlayContext,
      playlistTitle,
      showSubtitles,
      lyricsContainer,
      lyricsContent,
      lyricsLines,
      currentLyricIndex,
      handleLyricsScroll,
      seekToLyric,
      // 歌单相关
      playlists,
      currentPlaylistId,
      showCreatePlaylistModal,
      isEditingPlaylist,
      newPlaylistName,
      newPlaylistDescription,
      newPlaylistNameInput,
      createNewPlaylist,
      createNewPlaylistFromMenu,
      savePlaylist,
      closeCreatePlaylistModal,
      openPlaylist,
      backToLibrary,
      getSongIndexInPlaylist,
      showPlaylistContextMenu,
      showPlaylistContextMenuVisible,
      playlistContextMenuStyle,
      currentPlaylistForMenu,
      playPlaylist,
      renamePlaylist,
      deletePlaylist,
      // 菜单相关
      showMoreMenu,
      closeAllMenus,
      showMoreMenuVisible,
      showDeleteMenuVisible,
      showAddToPlaylistMenuVisible,
      moreMenuStyle,
      deleteMenuStyle,
      addToPlaylistMenuStyle,
      currentSongForMenu,
      playSongFromMenu,
      toggleFavoriteFromMenu,
      showAddToPlaylistMenu,
      showDeleteMenu,
      removeFromList,
      deleteFromDisk,
      cancelDelete,
      showSongDetail,
      addToPlaylist,
      // 歌曲详情模态框
      showSongDetailModal,
      closeSongDetailModal,
      // 自定义提示模态框
      showAlertModal,
      alertTitle,
      alertMessage,
      showAlert,
      closeAlertModal,
      // 确认对话框
      showConfirmModal,
      confirmTitle,
      confirmMessage,
      showConfirm,
      closeConfirmModal,
      confirmOk,
      confirmCancel,
      // 音质选择相关
      showQualitySelectModal,
      qualitySelectSong,
      closeQualitySelectModal,
      selectQualityAndDownload,
      // 设置相关
      settings,
      applyThemeSetting,
      saveSettings,
      resetSettings,
      // 音源相关
      importedSources,
      currentSourceId,
      searchQuery,
      sourceSearchResults,
      isSearching,
      importSource,
      removeSource,
      openSourceSearch,
      performSearch,
      playSourceSong,
      downloadSourceSong,
      handleDownload,
      getDownloadIcon,
      getDownloadTitle,
      initSongDownloadStatus,
      loadSourceScript,
      getSourceName,
      selectCurrentSource,
      // 内置音源搜索相关
      builtinSearchSource,
      isBuiltinSearching,
      builtinSearchResults,
      performBuiltinSearch,
      playSearchResult,
      playBuiltinSong
    };
  }
});

app.mount('#app');
