const TagLib = require('node-taglib-sharp')
const fs = require('fs')
const mm = require('music-metadata')

async function compareFlacFiles(file1, file2) {
  try {
    console.log('=== FLAC 文件封面嵌入对比分析 ===\n')
    
    // 文件 1：成功的文件
    console.log('📁 文件 1 (成功):', file1)
    console.log('-'.repeat(60))
    if (!fs.existsSync(file1)) {
      console.log('❌ 文件不存在')
    } else {
      await analyzeFile(file1, '成功')
    }
    
    console.log('\n')
    
    // 文件 2：失败的文件
    console.log('📁 文件 2 (失败):', file2)
    console.log('-'.repeat(60))
    if (!fs.existsSync(file2)) {
      console.log('❌ 文件不存在')
    } else {
      await analyzeFile(file2, '失败')
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error(error.stack)
  }
}

async function analyzeFile(filePath, label) {
  // 方法 1: 使用 TagLib 分析
  console.log('\n【TAGLIB 分析】')
  const file = TagLib.File.createFromPath(filePath)
  const tag = file.tag
  
  console.log(`标题：${tag.title || '(无)'}`)
  console.log(`艺术家：${tag.artist || '(无)'}`)
  console.log(`专辑：${tag.album || '(无)'}`)
  console.log(`歌词：${tag.lyrics ? tag.lyrics.length + ' 字符' : '(无)'}`)
  console.log(`封面数量：${tag.pictures ? tag.pictures.length : 0}`)
  
  if (tag.pictures && tag.pictures.length > 0) {
    tag.pictures.forEach((pic, index) => {
      console.log(`\n  封面 ${index + 1}:`)
      console.log(`    类型：${pic.type}`)
      console.log(`    描述：${pic.description}`)
      console.log(`    MIME 类型：${pic.mimeType}`)
      console.log(`    大小：${pic.data.length} 字节`)
      console.log(`    宽度：${pic.width || '(未知)'}`)
      console.log(`    高度：${pic.height || '(未知)'}`)
      
      // 检查图片数据
      const data = pic.data
      if (data && data.length > 0) {
        // 转换为 Buffer 或 Array
        const dataArray = data instanceof Buffer ? data : (data instanceof Uint8Array ? data : new Uint8Array(data))
        console.log(`    前 10 字节：${Array.from(dataArray.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
        console.log(`    图片格式判断：${dataArray[0] === 0xff && dataArray[1] === 0xd8 ? 'JPEG' : dataArray[0] === 0x89 && dataArray[1] === 0x50 ? 'PNG' : '未知'}`)
      }
    })
  }
  
  file.dispose()
  
  // 方法 2: 使用 music-metadata 分析
  console.log('\n【MUSIC-METADATA 分析】')
  const metadata = await mm.parseFile(filePath)
  
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    metadata.common.picture.forEach((pic, index) => {
      console.log(`\n  封面 ${index + 1}:`)
      console.log(`    格式：${pic.format || '(未知)'}`)
      console.log(`    类型：${pic.type || '(未知)'}`)
      console.log(`    大小：${pic.data ? pic.data.length : 0} 字节`)
      console.log(`    描述：${pic.description || '(无)'}`)
      
      if (pic.data && pic.data.length > 0) {
        console.log(`    前 10 字节：${Array.from(pic.data.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      }
    })
  } else {
    console.log('  未找到封面图片')
  }
  
  // 检查 Vorbis Comments
  if (metadata.vorbis && metadata.vorbis.comment) {
    console.log('\n【VORBIS COMMENTS】')
    const pictureComments = metadata.vorbis.comment.filter(c => c.includes('METADATA_BLOCK_PICTURE') || c.includes('COVERART'))
    if (pictureComments.length > 0) {
      console.log(`  找到 ${pictureComments.length} 个图片相关标签`)
      pictureComments.forEach(c => {
        const [key, ...valueParts] = c.split('=')
        console.log(`    ${key}: ${valueParts.length > 0 ? '有数据' : '(无数据)'}`)
      })
    } else {
      console.log('  未找到 METADATA_BLOCK_PICTURE 或 COVERART 标签')
    }
  }
}

// 使用方法
const file1 = 'D:\\QQMusic\\Music\\搁浅 - 周杰伦.flac'
const file2 = 'D:\\QQMusic\\Music\\七里香 - 周杰伦.flac'

console.log('对比文件:')
console.log('  文件 1 (成功):', file1)
console.log('  文件 2 (失败):', file2)
console.log('')

compareFlacFiles(file1, file2)
