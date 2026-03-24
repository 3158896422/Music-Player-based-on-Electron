const NodeID3 = require('node-id3')
const path = require('path')

const mp3FilePath = 'D:\\QQMusic\\Music\\七里香 - 周杰伦.mp3'

console.log('正在读取 MP3 文件的 ID3 标签...\n')

NodeID3.read(mp3FilePath, (err, tags) => {
  if (err) {
    console.error('读取文件失败:', err.message)
    return
  }

  console.log('=== MP3 文件信息 ===')
  console.log('文件路径:', mp3FilePath)
  console.log('\n=== ID3 标签信息 ===')
  
  // 基本信息
  if (tags.title) console.log('标题:', tags.title)
  if (tags.artist) console.log('艺术家:', tags.artist)
  if (tags.album) console.log('专辑:', tags.album)
  if (tags.year) console.log('年份:', tags.year)
  if (tags.genre) console.log('流派:', tags.genre)
  if (tags.trackNumber) console.log('音轨号:', tags.trackNumber)

  // 检查歌词
  console.log('\n=== 歌词信息 ===')
  
  // 检查 USLT 帧（同步歌词）
  if (tags.lyrics) {
    console.log('✓ 包含内嵌歌词 (USLT 帧)')
    console.log('歌词语言:', tags.lyrics.language || '未知')
    console.log('歌词内容长度:', tags.lyrics.text ? tags.lyrics.text.length : 0, '字符')
    if (tags.lyrics.text && tags.lyrics.text.length < 500) {
      console.log('歌词预览:\n', tags.lyrics.text)
    } else if (tags.lyrics.text) {
      console.log('歌词预览 (前 200 字符):\n', tags.lyrics.text.substring(0, 200))
    }
  } else {
    console.log('✗ 未找到内嵌歌词 (USLT 帧)')
  }

  // 检查 UNSL 帧（非同步歌词）
  if (tags.unsynchronisedLyrics) {
    console.log('\n✓ 包含非同步歌词 (UNSL 帧)')
    console.log('歌词语言:', tags.unsynchronisedLyrics.language || '未知')
    console.log('歌词内容长度:', tags.unsynchronisedLyrics.text ? tags.unsynchronisedLyrics.text.length : 0, '字符')
    console.log('\n=== 完整歌词 ===')
    console.log(tags.unsynchronisedLyrics.text)
  } else {
    console.log('\n✗ 未找到非同步歌词 (UNSL 帧)')
  }

  // 检查封面
  console.log('\n=== 封面信息 ===')
  if (tags.image) {
    console.log('✓ 包含内嵌封面')
    console.log('封面格式:', tags.image.imageFormat || '未知')
    console.log('封面大小:', tags.image.imageBuffer ? tags.image.imageBuffer.length : 0, '字节')
  } else {
    console.log('✗ 未找到内嵌封面')
  }

  // 显示所有可用的标签帧
  console.log('\n=== 所有 ID3 标签帧 ===')
  console.log('可用的标签帧:', Object.keys(tags).join(', '))
})
