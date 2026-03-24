const TagLib = require('node-taglib-sharp')
const fsPromises = require('fs').promises

async function testPictureTypes(picPath) {
  try {
    console.log('=== 测试不同的 Picture 创建方法 ===\n')
    console.log('图片路径:', picPath)
    
    const pictureData = await fsPromises.readFile(picPath)
    console.log('图片大小:', pictureData.length, '字节')
    console.log('格式:', pictureData[0] === 0xff && pictureData[1] === 0xd8 ? 'JPEG' : 'PNG')
    
    // 方法 1: fromBinary
    console.log('\n【方法 1: Picture.fromBinary()】')
    try {
      const pic1 = TagLib.Picture.fromBinary(pictureData)
      console.log('✓ 创建成功')
      console.log('  构造函数:', pic1.constructor.name)
      console.log('  类型:', pic1.constructor.name === 'XiphPicture' ? 'XiphPicture (FLAC 专用)' : '普通 Picture')
      console.log('  数据:', pic1.data ? pic1.data.length : '无')
    } catch (e) {
      console.log('❌ 失败:', e.message)
    }
    
    // 方法 2: 创建 XiphPicture
    console.log('\n【方法 2: 尝试创建 XiphPicture】')
    try {
      // 检查是否有 XiphPicture 类
      if (TagLib.XiphPicture) {
        console.log('  找到 XiphPicture 类')
        // 尝试不同的构造方法
        const pic2 = new TagLib.XiphPicture()
        console.log('✓ 创建 XiphPicture 成功')
        console.log('  构造函数:', pic2.constructor.name)
      } else {
        console.log('  ❌ 未找到 XiphPicture 类')
      }
    } catch (e) {
      console.log('❌ 失败:', e.message)
    }
    
    // 方法 3: 检查 Picture 类的其他静态方法
    console.log('\n【方法 3: 检查 Picture 类的静态方法】')
    console.log('  Picture 类的方法:')
    Object.getOwnPropertyNames(TagLib.Picture).forEach(name => {
      if (typeof TagLib.Picture[name] === 'function') {
        console.log(`    - ${name}`)
      }
    })
    
    // 方法 4: 直接设置 pictureData 属性
    console.log('\n【方法 4: 手动创建 Picture 对象】')
    try {
      const pic4 = TagLib.Picture.fromBinary(pictureData)
      console.log('  原始数据类型:', pic4.data ? pic4.data.constructor.name : '无')
      
      // 尝试直接设置数据
      console.log('  尝试直接赋值数据...')
      // 某些版本可能需要特定的数据格式
    } catch (e) {
      console.log('❌ 失败:', e.message)
    }
    
    // 方法 5: 检查 TagLib 命名空间
    console.log('\n【方法 5: 检查 TagLib 命名空间】')
    console.log('  TagLib 可用的类:')
    Object.getOwnPropertyNames(TagLib).forEach(name => {
      if (typeof TagLib[name] === 'function') {
        console.log(`    - ${name}`)
      }
    })
    
    console.log('\n✅ 测试完成')
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('使用方法:')
  console.log('  node test-picture-types.js <图片路径>')
  process.exit(0)
}

testPictureTypes(args[0])
