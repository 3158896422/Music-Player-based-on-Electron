const fs = require('fs')
const path = require('path')

// 测试使用 node-taglib-sharp 写入 FLAC 元数据
// 首先需要安装：npm install node-taglib-sharp

async function testWriteFlacMetadata(filePath, meta) {
  try {
    console.log('=== 测试 FLAC 元数据写入 ===\n')
    console.log('文件路径:', filePath)
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ 文件不存在:', filePath)
      return
    }

    // 尝试使用 node-taglib-sharp
    try {
      const TagLib = require('node-taglib-sharp')
      console.log('✓ node-taglib-sharp 加载成功\n')

      const file = TagLib.File.createFromPath(filePath)
      const tag = file.tag

      console.log('写入前的标签:')
      console.log('  Title:', tag.title)
      console.log('  Artist:', tag.artist)
      console.log('  Album:', tag.album)
      console.log('')

      // 写入元数据
      if (meta.title) tag.title = meta.title
      if (meta.artist) tag.artist = meta.artist
      if (meta.album) tag.album = meta.album
      if (meta.lyrics) tag.lyrics = meta.lyrics

      console.log('写入元数据:')
      console.log('  Title:', meta.title)
      console.log('  Artist:', meta.artist)
      console.log('  Album:', meta.album)
      console.log('  Lyrics:', meta.lyrics ? `${meta.lyrics.length} 字符` : '无')
      console.log('')

      // 保存
      file.save()
      console.log('✓ 元数据保存成功\n')

      // 验证
      const verifyFile = TagLib.File.createFromPath(filePath)
      console.log('验证后的标签:')
      console.log('  Title:', verifyFile.tag.title)
      console.log('  Artist:', verifyFile.tag.artist)
      console.log('  Album:', verifyFile.tag.album)
      console.log('  Lyrics:', verifyFile.tag.lyrics ? `${verifyFile.tag.lyrics.length} 字符` : '无')
      console.log('')

      verifyFile.dispose()
      file.dispose()

      console.log('=== 测试完成 ===')
    } catch (taglibError) {
      console.error('❌ node-taglib-sharp 不可用:', taglibError.message)
      console.log('\n请安装：npm install node-taglib-sharp')
    }
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error(error.stack)
  }
}

// 使用方法
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('使用方法:')
  console.log('  node test-write-flac.js <flac 文件路径> <歌词文本>')
  console.log('\n示例:')
  console.log('  node test-write-flac.js "D:\\Music\\七里香.flac" "[00:00] 歌词..."')
  process.exit(0)
}

const flacFilePath = args[0]
const lyrics = args[1] || ''

testWriteFlacMetadata(flacFilePath, {
  title: '七里香',
  artist: '周杰伦',
  album: '七里香',
  lyrics: lyrics
})
