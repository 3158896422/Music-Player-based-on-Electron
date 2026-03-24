const TagLib = require('node-taglib-sharp')
const fs = require('fs')

// 测试 node-taglib-sharp 写入 FLAC 元数据

async function testWriteFlac(filePath) {
  try {
    console.log('=== 测试 FLAC 元数据写入 ===\n')
    console.log('文件路径:', filePath)
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ 文件不存在:', filePath)
      return
    }

    console.log('\n1️⃣ 读取写入前的元数据...')
    let file = TagLib.File.createFromPath(filePath)
    console.log('   标题:', file.tag.title || '(无)')
    console.log('   艺术家:', file.tag.artist || '(无)')
    console.log('   专辑:', file.tag.album || '(无)')
    console.log('   歌词:', file.tag.lyrics ? `${file.tag.lyrics.length} 字符` : '(无)')
    console.log('   封面:', file.tag.pictures && file.tag.pictures.length > 0 ? `${file.tag.pictures.length} 张` : '(无)')
    file.dispose()

    console.log('\n2️⃣ 写入新的元数据...')
    file = TagLib.File.createFromPath(filePath)
    
    // 写入元数据
    file.tag.title = '七里香'
    file.tag.artist = '周杰伦'
    file.tag.album = '七里香'
    file.tag.lyrics = '[00:00.00] 窗外的麻雀 在电线杆上多嘴\n[00:06.93] 你说这一句 很有夏天的感觉'
    
    // 写入封面（如果有图片）
    const coverPath = filePath.replace('.flac', '.jpg')
    if (fs.existsSync(coverPath)) {
      const pictureData = fs.readFileSync(coverPath)
      const picture = TagLib.Picture.fromBinary(pictureData)
      picture.type = TagLib.PictureType.FrontCover
      picture.description = 'Front Cover'
      picture.mimeType = 'image/jpeg'
      file.tag.pictures = [picture]
      console.log('   ✓ 封面图片已添加')
    }
    
    // 保存
    file.save()
    console.log('   ✓ 元数据已保存')
    file.dispose()

    console.log('\n3️⃣ 验证写入后的元数据...')
    file = TagLib.File.createFromPath(filePath)
    console.log('   标题:', file.tag.title)
    console.log('   艺术家:', file.tag.artist)
    console.log('   专辑:', file.tag.album)
    console.log('   歌词:', file.tag.lyrics ? `${file.tag.lyrics.length} 字符` : '(无)')
    if (file.tag.lyrics) {
      console.log('   歌词预览:', file.tag.lyrics.substring(0, 50) + '...')
    }
    console.log('   封面:', file.tag.pictures && file.tag.pictures.length > 0 ? `${file.tag.pictures.length} 张，${file.tag.pictures[0].data.length} 字节` : '(无)')
    file.dispose()

    console.log('\n✅ 测试完成！')
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

// 使用方法
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node test-taglib.js <flac 文件路径>')
  console.log('\n示例:')
  console.log('  node test-taglib.js "D:\\Music\\七里香 - 周杰伦.flac"')
  process.exit(0)
}

testWriteFlac(args[0])
