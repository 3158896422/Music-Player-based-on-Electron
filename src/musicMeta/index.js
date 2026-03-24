const path = require('path')
const mp3Meta = require('./mp3Meta')
const flacMeta = require('./flacMeta')

exports.setMeta = async (filePath, meta, proxy) => {
  console.log('[musicMeta] setMeta 被调用, filePath:', filePath, 'ext:', path.extname(filePath))
  switch (path.extname(filePath)) {
    case '.mp3':
      return mp3Meta(filePath, meta, proxy)
    case '.flac':
      return flacMeta(filePath, meta, proxy)
    default:
      console.log('[musicMeta] 未知文件类型，不写入元数据')
  }
}
