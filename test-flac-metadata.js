const path = require('path')
const fs = require('fs')
const musicMetadata = require('music-metadata')

const flacFilePath = 'D:\\QQMusic\\Music\\七里香 - 周杰伦.flac'

console.log('正在读取 FLAC 文件的元数据...\n')

musicMetadata.parseFile(flacFilePath)
  .then(metadata => {
    console.log('=== FLAC 文件信息 ===')
    console.log('文件路径:', flacFilePath)
    
    // 基本信息
    console.log('\n=== 基本信息 ===')
    if (metadata.common.title) {
      console.log('标题:', metadata.common.title)
    }
    if (metadata.common.artist) {
      console.log('艺术家:', metadata.common.artist)
    }
    if (metadata.common.album) {
      console.log('专辑:', metadata.common.album)
    }
    if (metadata.common.year) {
      console.log('年份:', metadata.common.year)
    }
    if (metadata.common.track.no) {
      console.log('音轨号:', metadata.common.track.no)
    }

    // 检查歌词
    console.log('\n=== 歌词信息 ===')
    const possibleLyricTags = ['lyrics', 'unsyncedLyrics', 'unsynchronisedLyrics']
    let foundLyrics = false
    
    for (const tag of possibleLyricTags) {
      if (metadata.common[tag]) {
        const lyrics = metadata.common[tag]
        console.log(`✓ 找到歌词标签 (${tag})`)
        
        if (Array.isArray(lyrics)) {
          lyrics.forEach((lyric, index) => {
            console.log(`\n歌词 ${index + 1}:`)
            console.log('  语言:', lyric.language || '未知')
            console.log('  内容长度:', lyric.text ? lyric.text.length : 0, '字符')
            
            if (lyric.text && lyric.text.length < 1000) {
              console.log('\n=== 完整歌词 ===')
              console.log(lyric.text)
            } else if (lyric.text) {
              console.log('\n=== 歌词预览 (前 500 字符) ===')
              console.log(lyric.text.substring(0, 500))
              console.log('\n... (更多内容)')
            }
          })
        } else {
          console.log('歌词内容长度:', lyrics.length, '字符')
          if (lyrics.length < 1000) {
            console.log('\n=== 完整歌词 ===')
            console.log(lyrics)
          } else {
            console.log('\n=== 歌词预览 (前 500 字符) ===')
            console.log(lyrics.substring(0, 500))
            console.log('\n... (更多内容)')
          }
        }
        foundLyrics = true
        break
      }
    }
    
    // 也检查 native 标签
    if (!foundLyrics && metadata.native) {
      console.log('\n检查 Native 标签...')
      const vorbisTags = metadata.native.vorbis || []
      for (const tag of vorbisTags) {
        if (tag.id && tag.id.toUpperCase() === 'LYRICS') {
          console.log('✓ 找到 LYRICS 标签 (Vorbis Comments)')
          console.log('歌词内容长度:', tag.value.length, '字符')
          if (tag.value.length < 1000) {
            console.log('\n=== 完整歌词 ===')
            console.log(tag.value)
          } else {
            console.log('\n=== 歌词预览 (前 500 字符) ===')
            console.log(tag.value.substring(0, 500))
            console.log('\n... (更多内容)')
          }
          foundLyrics = true
          break
        }
      }
    }
    
    if (!foundLyrics) {
      console.log('✗ 未找到内嵌歌词')
    }

    // 检查封面
    console.log('\n=== 封面信息 ===')
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      console.log(`✓ 包含 ${metadata.common.picture.length} 张内嵌封面`)
      metadata.common.picture.forEach((pic, index) => {
        console.log(`\n封面 ${index + 1}:`)
        console.log('  类型:', pic.type || '未知')
        console.log('  格式:', pic.format || '未知')
        console.log('  大小:', pic.data ? pic.data.length : 0, '字节')
        console.log('  描述:', pic.description || '无')
      })
    } else {
      console.log('✗ 未找到内嵌封面')
    }

    // 显示所有可用的标签
    console.log('\n=== 所有可用的元数据标签 ===')
    console.log('Common 标签:', Object.keys(metadata.common).join(', '))
    
    if (metadata.native) {
      console.log('\nNative 标签类型:', Object.keys(metadata.native).join(', '))
      Object.keys(metadata.native).forEach(type => {
        console.log(`\n${type} 标签:`)
        metadata.native[type].forEach(tag => {
          console.log(`  - ${tag.id}: ${typeof tag.value === 'string' && tag.value.length > 50 ? tag.value.substring(0, 50) + '...' : tag.value}`)
        })
      })
    }

  })
  .catch(err => {
    console.error('读取 FLAC 文件失败:', err.message)
    console.error(err.stack)
  })
