const TagLib = require('node-taglib-sharp')
const fs = require('fs')

async function checkFlacArtist(filePath) {
  try {
    console.log('=== 检查 FLAC 艺术家字段 ===\n')
    console.log('文件路径:', filePath)
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ 文件不存在')
      return
    }
    
    const file = TagLib.File.createFromPath(filePath)
    const tag = file.tag
    
    console.log('\n【艺术家相关信息】')
    console.log('标题:', tag.title || '(无)')
    console.log('专辑:', tag.album || '(无)')
    console.log('')
    
    console.log('【ARTIST 字段】')
    console.log('  值:', tag.artist || '(无)')
    console.log('  类型:', typeof tag.artist)
    console.log('  长度:', tag.artist ? tag.artist.length : 0)
    if (tag.artist) {
      console.log('  字符分解:', Array.from(tag.artist).map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
    }
    console.log('')
    
    console.log('【ALBUMARTIST 字段】')
    console.log('  值:', tag.albumArtist || '(无)')
    console.log('')
    
    console.log('【PERFORMERS 字段】')
    if (tag.performers && tag.performers.length > 0) {
      console.log('  数量:', tag.performers.length)
      tag.performers.forEach((p, i) => {
        console.log(`  [${i}]:`, p)
      })
    } else {
      console.log('  (无)')
    }
    console.log('')
    
    console.log('【COMPOSER 字段】')
    console.log('  值:', tag.composer || '(无)')
    console.log('')
    
    // 读取原始 Vorbis Comments
    console.log('【原始 Vorbis Comments】')
    const metadata = await import('music-metadata')
    const meta = await metadata.default.parseFile(filePath)
    if (meta.vorbis && meta.vorbis.comment) {
      const artistRelated = meta.vorbis.comment.filter(c => 
        c.toUpperCase().includes('ARTIST') || 
        c.toUpperCase().includes('PERFORMER')
      )
      if (artistRelated.length > 0) {
        console.log('  艺术家相关标签:')
        artistRelated.forEach(c => {
          const [key, ...valueParts] = c.split('=')
          console.log(`    ${key}: ${valueParts.join('=')}`)
        })
      } else {
        console.log('  未找到艺术家相关标签')
      }
    }
    
    file.dispose()
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node check-flac-artist.js <flac 文件路径>')
  process.exit(0)
}

checkFlacArtist(args[0])
