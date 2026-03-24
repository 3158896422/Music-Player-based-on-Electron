const TagLib = require('node-taglib-sharp')
const axios = require('axios')

async function testPictureTypes() {
  try {
    console.log('=== 测试不同的 Picture 创建方法 ===\n')
    
    // 下载一张图片
    const imageUrl = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000000nfgwP0D6qxd.jpg'
    console.log('下载图片:', imageUrl)
    
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const pictureData = Buffer.from(response.data)
    
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
      console.log('  数据类型:', pic1.data ? pic1.data.constructor.name : '无')
    } catch (e) {
      console.log('❌ 失败:', e.message)
    }
    
    // 方法 2: 检查是否有 XiphPicture
    console.log('\n【方法 2: 检查 XiphPicture】')
    if (TagLib.XiphPicture) {
      console.log('  ✓ 找到 XiphPicture 类')
      try {
        const pic2 = new TagLib.XiphPicture()
        console.log('  ✓ 创建 XiphPicture 实例成功')
        console.log('    构造函数:', pic2.constructor.name)
      } catch (e) {
        console.log('  ❌ 创建实例失败:', e.message)
      }
    } else {
      console.log('  ❌ 未找到 XiphPicture 类')
    }
    
    // 方法 3: 检查 Picture 类的静态方法
    console.log('\n【方法 3: Picture 类的静态方法】')
    const methods = Object.getOwnPropertyNames(TagLib.Picture).filter(name => {
      return typeof TagLib.Picture[name] === 'function'
    })
    if (methods.length > 0) {
      console.log('  可用方法:', methods.join(', '))
    } else {
      console.log('  无静态方法')
    }
    
    // 方法 4: 检查 Picture 实例属性
    console.log('\n【方法 4: Picture 实例属性】')
    const pic4 = TagLib.Picture.fromBinary(pictureData)
    console.log('  实例属性:')
    Object.getOwnPropertyNames(pic4).forEach(name => {
      const value = pic4[name]
      if (typeof value !== 'function') {
        console.log(`    ${name}: ${typeof value === 'object' && value ? value.constructor.name : typeof value}`)
      }
    })
    
    console.log('\n✅ 测试完成')
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

testPictureTypes()
