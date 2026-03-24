const TagLib = require('node-taglib-sharp')
const fs = require('fs')

async function checkSuccessFile(filePath) {
  try {
    console.log('=== 检查成功的 FLAC 文件 ===\n')
    console.log('文件路径:', filePath)
    
    const file = TagLib.File.createFromPath(filePath)
    const tag = file.tag
    
    console.log('\n【标签信息】')
    console.log('标题:', tag.title)
    console.log('艺术家:', tag.artist)
    console.log('专辑:', tag.album)
    console.log('歌词:', tag.lyrics ? tag.lyrics.length + ' 字符' : '无')
    console.log('封面数量:', tag.pictures ? tag.pictures.length : 0)
    
    if (tag.pictures && tag.pictures.length > 0) {
      console.log('\n【封面详情】')
      tag.pictures.forEach((pic, index) => {
        console.log(`\n封面 ${index + 1}:`)
        console.log('  构造函数:', pic.constructor.name)
        console.log('  类型:', pic.type, `(${TagLib.PictureType.FrontCover} = FrontCover)`)
        console.log('  描述:', `"${pic.description}"`)
        console.log('  MIME 类型:', `"${pic.mimeType}"`)
        console.log('  数据:', pic.data ? pic.data.length + ' 字节' : '无')
        console.log('  宽度:', pic.width)
        console.log('  高度:', pic.height)
        
        // 检查数据类型
        console.log('\n  数据类型检查:')
        console.log('    instanceof Buffer:', pic.data instanceof Buffer)
        console.log('    instanceof Uint8Array:', pic.data instanceof Uint8Array)
        console.log('    typeof:', typeof pic.data)
        console.log('    has length:', typeof pic.data.length)
        
        // 尝试转换为 Buffer
        if (pic.data && !(pic.data instanceof Buffer)) {
          const buffer = Buffer.from(pic.data)
          console.log('    转换为 Buffer 后:', buffer.length + ' 字节')
          console.log('    前 10 字节:', Array.from(buffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '))
        } else if (pic.data instanceof Buffer) {
          console.log('    前 10 字节:', Array.from(pic.data.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '))
        }
      })
    }
    
    file.dispose()
    
    console.log('\n✅ 检查完成')
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

const filePath = 'D:\\QQMusic\\Music\\搁浅 - 周杰伦.flac'
checkSuccessFile(filePath)
