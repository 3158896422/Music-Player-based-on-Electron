const TagLib = require('node-taglib-sharp')
const fsPromises = require('fs').promises
const path = require('path')
const axios = require('axios')
const download = require('./downloader')

const extReg = /^(\.(?:jpe?g|png)).*$/

const writeMeta = async(filePath, meta, picPath) => {
  console.log('[flacMeta] 开始使用 node-taglib-sharp 写入 FLAC 元数据')
  console.log('[flacMeta] filePath:', filePath)
  console.log('[flacMeta] meta:', {
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    hasLyrics: !!meta.lyrics,
    lyricsLength: meta.lyrics ? meta.lyrics.length : 0,
    hasPicPath: !!picPath
  })

  try {
    // 使用 node-taglib-sharp 打开文件
    const file = TagLib.File.createFromPath(filePath)
    const tag = file.tag

    console.log('[flacMeta] 写入前的元数据:')
    console.log('  原始标题:', tag.title || '(无)')
    console.log('  原始艺术家:', tag.artist || '(无)')
    console.log('  原始专辑:', tag.album || '(无)')

    // 写入基本元数据
    if (meta.title) {
      tag.title = meta.title
      console.log('[flacMeta] 写入标题:', meta.title)
    }
    if (meta.artist) {
      tag.artist = meta.artist
      tag.albumArtist = meta.artist  // 同时设置专辑艺术家
      // performers 应该是数组格式，支持多个表演者
      tag.performers = [meta.artist]   // 设置为数组
      console.log('[flacMeta] 写入艺术家:', meta.artist)
      console.log('[flacMeta] 写入专辑艺术家:', meta.artist)
      console.log('[flacMeta] 写入表演者:', meta.artist)
    }
    if (meta.album) {
      tag.album = meta.album
      console.log('[flacMeta] 写入专辑:', meta.album)
    }
    
    // 写入歌词 - 使用 Vorbis Comments 标准的 LYRICS 字段
    if (meta.lyrics) {
      tag.lyrics = meta.lyrics
      console.log('[flacMeta] ✓ 写入歌词，长度:', meta.lyrics.length)
    }

    // 写入封面图片
    if (picPath) {
      console.log('[flacMeta] 读取封面图片:', picPath)
      const pictureData = await fsPromises.readFile(picPath)
      
      // 使用 fromPath 方法创建 Picture（更可靠）
      const picture = TagLib.Picture.fromPath(picPath)
      picture.type = TagLib.PictureType.FrontCover
      picture.description = 'Front Cover'
      
      console.log('[flacMeta] Picture 对象信息:')
      console.log('  构造函数:', picture.constructor.name)
      console.log('  MIME 类型:', picture.mimeType)
      console.log('  数据大小:', picture.data ? picture.data.length : 0)
      
      tag.pictures = [picture]
      console.log('[flacMeta] ✓ 写入封面，大小:', pictureData.length, '字节')
    }

    // 保存文件
    file.save()
    console.log('[flacMeta] ✓ FLAC 元数据保存成功:', filePath)

    // 释放资源
    file.dispose()

  } catch (error) {
    console.error('[flacMeta] ❌ 写入失败:', error.message)
    console.error('[flacMeta] 错误堆栈:', error.stack)
    throw error
  }
}

module.exports = async (filePath, meta, proxy) => {
  console.log('[flacMeta] 开始处理，filePath:', filePath)
  console.log('[flacMeta] meta 信息:', {
    title: meta.title,
    artist: meta.artist,
    artistType: typeof meta.artist,
    artistLength: meta.artist ? meta.artist.length : 0,
    album: meta.album,
    hasAPIC: !!meta.APIC,
    hasLyrics: !!meta.lyrics
  })

  // 如果没有封面和歌词，直接写入基本元数据
  if (!meta.APIC && !meta.lyrics) {
    console.log('[flacMeta] 无封面和歌词，直接写入')
    return writeMeta(filePath, meta)
  }

  // 如果没有封面，只写入歌词
  if (!meta.APIC) {
    console.log('[flacMeta] 无封面，写入歌词')
    return writeMeta(filePath, meta)
  }

  // 处理封面
  let picUrl = meta.APIC
  delete meta.APIC
  
  if (!/^http/.test(picUrl)) {
    console.log('[flacMeta] 封面不是 URL，直接写入')
    return writeMeta(filePath, meta)
  }

  let ext = path.extname(picUrl)
  let picPath = filePath.replace(/\.flac$/, '') + (ext ? ext.replace(extReg, '$1') : '.jpg')

  let picUrlFinal = picUrl
  if (picUrl.includes('music.126.net')) picUrlFinal += `${picUrl.includes('?') ? '&' : '?'}param=500y500`
  
  console.log('[flacMeta] 开始下载封面:', picUrlFinal)
  
  try {
    const success = await download(picUrlFinal, picPath, proxy)
    if (success) {
      console.log('[flacMeta] 封面下载成功:', picPath)
      await writeMeta(filePath, meta, picPath)
      // 删除临时图片
      try {
        await fsPromises.unlink(picPath)
        console.log('[flacMeta] 删除临时封面')
      } catch (err) {
        console.log('[flacMeta] 删除临时封面失败:', err.message)
      }
    } else {
      console.log('[flacMeta] 封面下载失败，只写入元数据')
      await writeMeta(filePath, meta)
    }
  } catch (error) {
    console.error('[flacMeta] 封面处理失败:', error.message)
    await writeMeta(filePath, meta)
  }
}