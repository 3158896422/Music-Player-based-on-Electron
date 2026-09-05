const { ipcRenderer } = require('electron');

const barEl = document.getElementById('dlBar');
const line1El = document.getElementById('dlLine1');
const line2El = document.getElementById('dlLine2');

// 接收主窗口推送的歌词数据
ipcRenderer.on('lyric-update', (event, data) => {
  if (!data) return;
  line1El.textContent = data.text1 || '';
  line2El.textContent = data.text2 || '';
  barEl.classList.toggle('paused', data.playing === false);

  // 同步播放/暂停图标
  const playing = data.playing !== false;
  document.getElementById('dlIconPlay').style.display = playing ? 'none' : 'block';
  document.getElementById('dlIconPause').style.display = playing ? 'block' : 'none';

  // 同步播放模式图标（0 随机 / 1 列表循环 / 2 单曲循环）
  const mode = data.playMode || 0;
  document.getElementById('dlModeShuffle').style.display = mode === 0 ? 'block' : 'none';
  document.getElementById('dlModeRepeat').style.display = mode === 1 ? 'block' : 'none';
  document.getElementById('dlModeRepeatOne').style.display = mode === 2 ? 'block' : 'none';
  document.getElementById('dlMode').classList.toggle('mode-active', mode > 0);
});

// 通知主窗口歌词窗口已就绪，请求推送当前歌词状态
ipcRenderer.send('desktop-lyric-ready');

// 关闭按钮
document.getElementById('dlClose').addEventListener('click', () => {
  ipcRenderer.send('desktop-lyric-close');
});

// 播放控制：发送命令给主进程，由主进程转发给主窗口
const sendControl = (action) => ipcRenderer.send('desktop-lyric-control', action);
document.getElementById('dlPlay').addEventListener('click', () => sendControl('play-pause'));
document.getElementById('dlPrev').addEventListener('click', () => sendControl('previous-song'));
document.getElementById('dlNext').addEventListener('click', () => sendControl('next-song'));
document.getElementById('dlMode').addEventListener('click', () => sendControl('toggle-play-mode'));

// ===== 悬停状态 =====
// Windows 透明窗口的全透明像素会穿透鼠标，CSS :hover 不可靠；
// 且 DPI 缩放下 forward 转发的鼠标事件坐标会错位。
// 因此由主进程轮询光标位置（DIP 坐标，不会错位），推送给本页面切换样式。
ipcRenderer.on('lyric-hover', (event, inside) => {
  barEl.classList.toggle('hover', inside);
});
