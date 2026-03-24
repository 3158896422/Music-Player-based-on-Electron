const cloudMusicApi = require('NeteaseCloudMusicApi');

// 测试网易云音乐搜索 API
async function testSearch() {
  try {
    console.log('=== 测试网易云音乐搜索 API ===\n')
    
    const keyword = '周杰伦 七里香'
    
    console.log('搜索关键词:', keyword)
    const result = await cloudMusicApi.search({
      keywords: keyword,
      page: 1,
      limit: 1,
      type: 1  // 1: 单曲
    })
    
    const data = result.body
    console.log('\nAPI 返回状态码:', data.code)
    
    if (data.code === 200 && data.result && data.result.songs && data.result.songs.length > 0) {
      const song = data.result.songs[0]
      
      console.log('\n【搜索结果 - 歌曲信息】')
      console.log('ID:', song.id)
      console.log('名称:', song.name)
      console.log('专辑:', song.album ? song.album.name : '未知')
      
      console.log('\n【艺术家信息】')
      console.log('artists 数组:', song.artists ? song.artists.length : 0, '个歌手')
      if (song.artists) {
        song.artists.forEach((artist, index) => {
          console.log(`  歌手${index + 1}:`)
          console.log('    ID:', artist.id)
          console.log('    名称:', artist.name)
        })
        
        console.log('\n【组合后的艺术家字符串】')
        const artistStr = song.artists.map(a => a.name).join('&')
        console.log('  结果:', artistStr)
      } else {
        console.log('  ❌ artists 字段不存在或为空')
      }
      
      console.log('\n【其他字段】')
      console.log('ar:', song.ar ? '存在' : '不存在')
      if (song.ar) {
        console.log('  ar 数组:', Array.isArray(song.ar) ? song.ar.length : '不是数组')
        if (Array.isArray(song.ar) && song.ar.length > 0) {
          console.log('  ar[0]:', song.ar[0])
        }
      }
      console.log('artists:', song.artists ? '存在' : '不存在')
      
    } else {
      console.log('❌ 搜索失败')
      console.log('data:', JSON.stringify(data, null, 2).substring(0, 500))
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

testSearch()
