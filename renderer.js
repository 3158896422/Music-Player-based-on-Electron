const { ipcRenderer } = require('electron');
const path = require('path');

let musicFiles = [];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0: 不循环, 1: 列表循环, 2: 单曲循环
let audio = new Audio();
let previousVolume = 70;

// 窗口控制
function minimizeWindow() {
  ipcRenderer.send('window-minimize');
}

function maximizeWindow() {
  ipcRenderer.send('window-maximize');
}

function closeWindow() {
  ipcRenderer.send('window-close');
}

// 导入音乐
async function importMusic() {
  const selectedPaths = await ipcRenderer.invoke('select-folder');
  
  if (selectedPaths && selectedPaths.length > 0) {
    const files = await ipcRenderer.invoke('scan-music-folder', selectedPaths);
    
    if (files.length > 0) {
      musicFiles = files;
      displayMusicList(files);
    } else {
      alert('未找到音乐文件');
    }
  }
}

// 显示音乐列表
function displayMusicList(files) {
  const emptyState = document.getElementById('empty-state');
  const musicList = document.getElementById('music-list');
  
  emptyState.style.display = 'none';
  musicList.style.display = 'flex';
  musicList.innerHTML = '';
  
  files.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'music-item';
    item.dataset.index = index;
    item.innerHTML = `
      <div class="music-item-number">${index + 1}</div>
      <div class="music-item-info">
        <div class="music-item-title">${file.name}</div>
        <div class="music-item-artist">${file.format.toUpperCase()} 文件</div>
      </div>
      <div class="music-item-duration">--:--</div>
    `;
    
    item.addEventListener('click', () => playSong(index));
    musicList.appendChild(item);
  });
}

// 播放歌曲
function playSong(index) {
  if (index < 0 || index >= musicFiles.length) return;
  
  currentSongIndex = index;
  const song = musicFiles[index];
  
  audio.src = song.path;
  audio.play();
  isPlaying = true;
  
  updatePlayButton();
  updateSongInfo(song);
  highlightCurrentSong();
}

// 更新播放按钮
function updatePlayButton() {
  const playBtn = document.getElementById('play-btn');
  playBtn.textContent = isPlaying ? '⏸' : '▶';
}

// 更新歌曲信息
function updateSongInfo(song) {
  document.getElementById('song-title').textContent = song.name;
  document.getElementById('song-artist').textContent = song.format.toUpperCase() + ' 文件';
}

// 高亮当前播放歌曲
function highlightCurrentSong() {
  const items = document.querySelectorAll('.music-item');
  items.forEach((item, index) => {
    if (index === currentSongIndex) {
      item.classList.add('playing');
    } else {
      item.classList.remove('playing');
    }
  });
}

// 切换播放/暂停
function togglePlay() {
  if (musicFiles.length === 0) return;
  
  if (currentSongIndex === -1) {
    playSong(0);
  } else {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play();
      isPlaying = true;
    }
    updatePlayButton();
  }
}

// 上一首
function previousSong() {
  if (musicFiles.length === 0) return;
  
  let newIndex;
  if (isShuffle) {
    newIndex = Math.floor(Math.random() * musicFiles.length);
  } else {
    newIndex = currentSongIndex - 1;
    if (newIndex < 0) newIndex = musicFiles.length - 1;
  }
  
  playSong(newIndex);
}

// 下一首
function nextSong() {
  if (musicFiles.length === 0) return;
  
  let newIndex;
  if (isShuffle) {
    newIndex = Math.floor(Math.random() * musicFiles.length);
  } else {
    newIndex = currentSongIndex + 1;
    if (newIndex >= musicFiles.length) newIndex = 0;
  }
  
  playSong(newIndex);
}

// 切换随机播放
function toggleShuffle() {
  isShuffle = !isShuffle;
  const btn = document.getElementById('shuffle-btn');
  btn.classList.toggle('active', isShuffle);
}

// 切换循环模式
function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const btn = document.getElementById('repeat-btn');
  
  btn.classList.remove('active');
  btn.textContent = '🔁';
  
  if (repeatMode === 1) {
    btn.classList.add('active');
  } else if (repeatMode === 2) {
    btn.classList.add('active');
    btn.textContent = '🔂';
  }
}

// 切换静音
function toggleMute() {
  const volumeSlider = document.getElementById('volume-slider');
  const volumeBtn = document.querySelector('.volume-btn');
  
  if (audio.volume > 0) {
    previousVolume = audio.volume * 100;
    audio.volume = 0;
    volumeSlider.value = 0;
    volumeBtn.textContent = '🔇';
  } else {
    audio.volume = previousVolume / 100;
    volumeSlider.value = previousVolume;
    volumeBtn.textContent = '🔊';
  }
  
  updateVolumeSlider();
}

// 更新音量滑块
function updateVolumeSlider() {
  const volumeSlider = document.getElementById('volume-slider');
  const value = volumeSlider.value;
  volumeSlider.style.setProperty('--volume', value + '%');
}

// 格式化时间
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 更新进度条
function updateProgress() {
  if (audio.duration) {
    const progress = (audio.currentTime / audio.duration) * 100;
    const progressBar = document.getElementById('progress-bar');
    progressBar.value = progress;
    progressBar.style.setProperty('--progress', progress + '%');
    
    document.getElementById('current-time').textContent = formatTime(audio.currentTime);
    document.getElementById('total-time').textContent = formatTime(audio.duration);
  }
}

// 音频事件监听
audio.addEventListener('timeupdate', updateProgress);

audio.addEventListener('ended', () => {
  if (repeatMode === 2) {
    audio.currentTime = 0;
    audio.play();
  } else if (repeatMode === 1 || currentSongIndex < musicFiles.length - 1) {
    nextSong();
  } else {
    isPlaying = false;
    updatePlayButton();
  }
});

audio.addEventListener('error', (e) => {
  console.error('音频播放错误:', e);
  alert('无法播放此音频文件');
});

// 进度条控制
document.getElementById('progress-bar').addEventListener('input', (e) => {
  const progress = e.target.value;
  if (audio.duration) {
    audio.currentTime = (progress / 100) * audio.duration;
  }
});

// 音量控制
document.getElementById('volume-slider').addEventListener('input', (e) => {
  const volume = e.target.value;
  audio.volume = volume / 100;
  updateVolumeSlider();
  
  const volumeBtn = document.querySelector('.volume-btn');
  if (volume == 0) {
    volumeBtn.textContent = '🔇';
  } else if (volume < 50) {
    volumeBtn.textContent = '🔉';
  } else {
    volumeBtn.textContent = '🔊';
  }
});

// 初始化音量
audio.volume = 0.7;
updateVolumeSlider();

// 键盘快捷键
document.addEventListener('keydown', (e) => {
  switch(e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      if (audio.currentTime > 5) {
        audio.currentTime -= 5;
      }
      break;
    case 'ArrowRight':
      if (audio.duration - audio.currentTime > 5) {
        audio.currentTime += 5;
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      const volumeUp = Math.min(100, audio.volume * 100 + 5);
      audio.volume = volumeUp / 100;
      document.getElementById('volume-slider').value = volumeUp;
      updateVolumeSlider();
      break;
    case 'ArrowDown':
      e.preventDefault();
      const volumeDown = Math.max(0, audio.volume * 100 - 5);
      audio.volume = volumeDown / 100;
      document.getElementById('volume-slider').value = volumeDown;
      updateVolumeSlider();
      break;
  }
});