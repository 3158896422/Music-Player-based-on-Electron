const NodeID3 = require('node-id3')
const path = require('path')
const fs = require('fs')
const download = require('./downloader')
const extReg = /^(\.(?:jpe?g|png)).*$/

const handleWriteMeta = (meta, filePath) => {
  if (meta.lyrics) {
    meta.unsynchronisedLyrics = {
      language: 'zho',
      text: meta.lyrics,
    }
    delete meta.lyrics
  }
  console.log('[mp3Meta] 写入元数据')
  NodeID3.write(meta, filePath)
}

module.exports = (filePath, meta, proxy) => {
  console.log('[mp3Meta] 开始处理, filePath:', filePath)
  console.log('[mp3Meta] meta信息:', {
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    hasAPIC: !!meta.APIC,
    hasLyrics: !!meta.lyrics
  })
  
  if (!meta.APIC && !meta.lyrics) {
    console.log('[mp3Meta] 无封面和歌词，直接写入')
    handleWriteMeta(meta, filePath)
    return Promise.resolve()
  }
  
  if (!meta.APIC) {
    console.log('[mp3Meta] 无封面，写入歌词')
    handleWriteMeta(meta, filePath)
    return Promise.resolve()
  }
  
  if (!/^http/.test(meta.APIC)) {
    console.log('[mp3Meta] 封面不是URL，删除并写入')
    delete meta.APIC
    handleWriteMeta(meta, filePath)
    return Promise.resolve()
  }
  
  let ext = path.extname(meta.APIC)
  let picPath = filePath.replace(/\.mp3$/, '') + (ext ? ext.replace(extReg, '$1') : '.jpg')

  let picUrl = meta.APIC
  if (picUrl.includes('music.126.net')) picUrl += `${picUrl.includes('?') ? '&' : '?'}param=500y500`
  console.log('[mp3Meta] 开始下载封面:', picUrl)
  
  return download(picUrl, picPath, proxy).then(success => {
    if (success) {
      console.log('[mp3Meta] 封面下载成功:', picPath)
      meta.APIC = picPath
      handleWriteMeta(meta, filePath)
      fs.unlink(picPath, err => {
        if (err) console.log('[mp3Meta] 删除临时封面失败:', err.message)
      })
    } else {
      console.log('[mp3Meta] 封面下载失败，删除APIC后写入')
      delete meta.APIC
      handleWriteMeta(meta, filePath)
    }
  })
}
