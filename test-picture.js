const TagLib = require('node-taglib-sharp')
const fsPromises = require('fs').promises

async function testPictureCreation(picPath) {
  try {
    console.log('=== 测试 Picture 创建 ===\n')
    console.log('封面路径:', picPath)
    
    const pictureData = await fsPromises.readFile(picPath)
    console.log('图片数据大小:', pictureData.length, '字节')
    console.log('前 10 字节:', Array.from(pictureData.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '))
    console.log('图片格式:', pictureData[0] === 0xff && pictureData[1] === 0xd8 ? 'JPEG' : 'PNG')
    
    console.log('\n创建 Picture 对象...')
    const picture = TagLib.Picture.fromBinary(pictureData)
    
    console.log('✓ Picture 创建成功')
    console.log('  类型:', picture.type)
    console.log('  描述:', picture.description)
    console.log('  MIME 类型:', picture.mimeType)
    console.log('  数据大小:', picture.data ? picture.data.length : '无数据')
    console.log('  宽度:', picture.width)
    console.log('  高度:', picture.height)
    
    // 测试设置属性
    console.log('\n设置属性...')
    picture.type = TagLib.PictureType.FrontCover
    picture.description = 'Front Cover'
    picture.mimeType = 'image/jpeg'
    
    console.log('  新类型:', picture.type)
    console.log('  新描述:', picture.description)
    console.log('  新 MIME:', picture.mimeType)
    
    // 测试赋值给数组
    console.log('\n测试赋值给数组...')
    const pictures = [picture]
    console.log('  数组长度:', pictures.length)
    console.log('  数组 [0] 类型:', pictures[0].type)
    console.log('  数组 [0] 数据大小:', pictures[0].data ? pictures[0].data.length : '无')
    
    console.log('\n✅ 测试成功！')
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

// 使用方法
const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node test-picture.js <图片路径>')
  console.log('\n示例:')
  console.log('  node test-picture.js "D:\\Music\\七里香.jpg"')
  process.exit(0)
}

testPictureCreation(args[0])
