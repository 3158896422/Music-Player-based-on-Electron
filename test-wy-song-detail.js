const cloudMusicApi = require('NeteaseCloudMusicApi');

// 测试网易云音乐歌曲详情 API
async function testSongDetail() {
  try {
    console.log('=== 测试网易云音乐歌曲详情 API ===\n')
    
    // 使用一首歌测试（七里香）
    const songId = 186016  // 七里香的 ID
    
    console.log('获取歌曲详情，songId:', songId)
    const result = await cloudMusicApi.song_detail({
      ids: songId.toString()
    })
    
    const data = result.body
    console.log('\nAPI 返回状态码:', data.code)
    
    if (data.code === 200 && data.songs && data.songs.length > 0) {
      const song = data.songs[0]
      
      console.log('\n【歌曲基本信息】')
      console.log('ID:', song.id)
      console.log('名称:', song.name)
      console.log('专辑:', song.al ? song.al.name : '未知')
      console.log('专辑 ID:', song.al ? song.al.id : '未知')
      
      console.log('\n【艺术家信息】')
      console.log('artists 数组:', song.artists ? song.artists.length : 0, '个歌手')
      if (song.artists) {
        song.artists.forEach((artist, index) => {
          console.log(`  歌手${index + 1}:`)
          console.log('    ID:', artist.id)
          console.log('    名称:', artist.name)
          console.log('    别名:', artist.alias ? artist.alias.join(',') : '无')
          console.log('    英文名:', artist.trans || '无')
        })
        
        console.log('\n【组合后的艺术家字符串】')
        const artistStr = song.artists.map(a => a.name).join('&')
        console.log('  结果:', artistStr)
      }
      
      console.log('\n【其他信息】')
      console.log('duration:', song.duration || song.dt, '毫秒')
      console.log('封面 URL:', song.al && song.al.picUrl ? song.al.picUrl.substring(0, 50) + '...' : '无')
      
    } else {
      console.log('❌ 获取歌曲详情失败')
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('堆栈:', error.stack)
  }
}

testSongDetail()
