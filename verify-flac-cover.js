const TagLib = require('node-taglib-sharp')
const fs = require('fs')

async function verifyFlacCover(filePath) {
  try {
    console.log('=== FLAC 封面嵌入验证 ===\n')
    console.log('文件路径:', filePath)
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ 文件不存在')
      return
    }
    
    const file = TagLib.File.createFromPath(filePath)
    const tag = file.tag
    
    console.log('\n【基本信息】')
    console.log('标题:', tag.title || '(无)')
    console.log('艺术家:', tag.artist || '(无)')
    console.log('专辑:', tag.album || '(无)')
    console.log('歌词:', tag.lyrics ? `✓ 有 (${tag.lyrics.length} 字符)` : '✗ 无')
    
    console.log('\n【封面信息】')
    if (tag.pictures && tag.pictures.length > 0) {
      console.log(`✓ 封面数量：${tag.pictures.length}`)
      tag.pictures.forEach((pic, index) => {
        console.log(`\n  封面 ${index + 1}:`)
        console.log(`    类型：${pic.constructor.name}`)
        console.log(`    PictureType: ${pic.type} (${pic.type === 3 ? 'FrontCover ✓' : '其他'})`)
        console.log(`    MIME: ${pic.mimeType}`)
        console.log(`    大小：${pic.data ? pic.data.length : 0} 字节`)
        console.log(`    描述：${pic.description || '(无)'}`)
        
        if (pic.data && pic.data.length > 0) {
          const data = pic.data instanceof Buffer ? pic.data : Buffer.from(pic.data)
          const isJpeg = data[0] === 0xff && data[1] === 0xd8
          const isPng = data[0] === 0x89 && data[1] === 0x50
          console.log(`    格式：${isJpeg ? 'JPEG ✓' : isPng ? 'PNG ✓' : '未知'}`)
        }
      })
      console.log('\n✅ 封面嵌入成功！')
    } else {
      console.log('✗ 未找到封面')
      console.log('\n❌ 封面嵌入失败！')
    }
    
    file.dispose()
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

// 使用方法
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node verify-flac-cover.js <flac 文件路径>')
  console.log('\n示例:')
  console.log('  node verify-flac-cover.js "D:\\QQMusic\\Music\\七里香 - 周杰伦.flac"')
  process.exit(0)
}

verifyFlacCover(args[0])
