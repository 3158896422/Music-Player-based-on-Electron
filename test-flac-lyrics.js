const fs = require('fs')
const path = require('path')
const mm = require('music-metadata')

// 测试 FLAC 文件的 Vorbis Comments 内嵌封面和歌词

async function testFlacMetadata(filePath) {
  try {
    console.log('=== FLAC 文件元数据测试 ===\n')
    console.log('文件路径:', filePath)
    console.log('')

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('❌ 文件不存在:', filePath)
      return
    }

    // 使用 music-metadata 读取元数据
    const metadata = await mm.parseFile(filePath)
    
    console.log('=== 基本信息 ===')
    console.log('格式:', metadata.format.container)
    console.log('编码:', metadata.format.codec)
    console.log('时长:', metadata.format.duration ? metadata.format.duration.toFixed(2) + ' 秒' : '未知')
    console.log('')

    console.log('=== Vorbis Comments (文本标签) ===')
    const vorbisComments = metadata.vorbis
    if (vorbisComments) {
      console.log('Vendor:', vorbisComments.vendor)
      console.log('')
      
      // 显示所有评论标签
      if (vorbisComments.comment) {
        console.log('评论标签:')
        vorbisComments.comment.forEach(comment => {
          const [key, ...valueParts] = comment.split('=')
          const value = valueParts.join('=')
          if (key === 'LYRICS') {
            console.log(`  ${key}: [歌词，长度 ${value ? value.length : 0} 字符]`)
          } else if (key === 'METADATA_BLOCK_PICTURE') {
            console.log(`  ${key}: [图片数据]`)
          } else {
            console.log(`  ${key}: ${value || '(空)'}`)
          }
        })
      }
    } else {
      console.log('❌ 未找到 Vorbis Comments')
    }
    console.log('')

    console.log('=== 封面图片 ===')
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      console.log('✓ 包含封面图片')
      metadata.common.picture.forEach((pic, index) => {
        console.log(`  图片 ${index + 1}:`)
        console.log(`    格式: ${pic.format || '未知'}`)
        console.log(`    类型: ${pic.type || '未知'}`)
        console.log(`    大小: ${pic.data ? pic.data.length : 0} 字节`)
        console.log(`    描述: ${pic.description || '无'}`)
      })
    } else {
      console.log('✗ 未找到封面图片')
    }
    console.log('')

    console.log('=== 歌词信息 ===')
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      console.log('✓ 包含内嵌歌词')
      console.log('歌词长度:', metadata.common.lyrics[0].length, '字符')
      console.log('\n歌词预览 (前 200 字符):')
      console.log('---')
      console.log(metadata.common.lyrics[0].substring(0, 200))
      console.log('---')
    } else {
      console.log('✗ 未找到内嵌歌词')
    }
    console.log('')

    console.log('=== 其他常见标签 ===')
    const commonFields = ['title', 'artist', 'album', 'year', 'genre', 'track', 'composer']
    commonFields.forEach(field => {
      if (metadata.common[field]) {
        console.log(`  ${field}: ${metadata.common[field]}`)
      }
    })
    console.log('')

    console.log('=== 测试完成 ===')
  } catch (error) {
    console.error('❌ 读取失败:', error.message)
    console.error(error.stack)
  }
}

// 使用方法
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node test-flac-lyrics.js <flac 文件路径>')
  console.log('\n示例:')
  console.log('  node test-flac-lyrics.js "D:\\Music\\七里香.flac"')
  process.exit(0)
}

const flacFilePath = args[0]
testFlacMetadata(flacFilePath)
