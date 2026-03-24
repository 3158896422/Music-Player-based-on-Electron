const zlib = require('zlib')
const path = require('path')
const fs = require('fs')

// 字段长度限制
const INFO_NAMES = {
  name: 24,
  description: 36,
  author: 56,
  homepage: 1024,
  version: 36,
}

// 匹配脚本元信息
const matchInfo = (scriptInfo) => {
  const infoArr = scriptInfo.split(/\r?\n/)
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  const infos = {}
  
  for (const info of infoArr) {
    const result = rxp.exec(info)
    if (!result) continue
    
    const key = result[1]
    if (INFO_NAMES[key] == null) continue
    
    infos[key] = result[2].trim()
  }

  // 限制字段长度
  for (const [key, len] of Object.entries(INFO_NAMES)) {
    if (!infos[key]) infos[key] = ''
    else if (infos[key].length > len) {
      infos[key] = infos[key].substring(0, len) + '...'
    }
  }

  return infos
}

// 解析脚本信息
const parseScriptInfo = (script) => {
  const result = /^\/\*[\S|\s]+?\*\//.exec(script)
  if (!result) throw new Error('无效的自定义源文件')

  let scriptInfo = matchInfo(result[0])
  scriptInfo.name = scriptInfo.name || `user_api_${new Date().toLocaleString()}`
  return scriptInfo
}

// 压缩脚本
const deflateScript = (script) => {
  return new Promise((resolve, reject) => {
    zlib.deflate(Buffer.from(script, 'utf8'), (err, buf) => {
      if (err) {
        reject(err)
        return
      }
      resolve('gz_' + buf.toString('base64'))
    })
  })
}

// 解压脚本
const inflateScript = (script) => {
  return new Promise((resolve, reject) => {
    if (script.startsWith('gz_')) {
      zlib.inflate(Buffer.from(script.substring(3), 'base64'), (err, buf) => {
        if (err) {
          reject(err)
          return
        }
        resolve(buf.toString('utf8'))
      })
    } else {
      resolve(script)
    }
  })
}

// 导入音源 API
const importApi = async (scriptRaw) => {
  let scriptInfo = parseScriptInfo(scriptRaw)
  
  const apiInfo = {
    id: `user_api_${Math.random().toString().substring(2, 5)}_${Date.now()}`,
    ...scriptInfo,
    allowShowUpdateAlert: true,
  }
  
  const script = await deflateScript(scriptRaw)
  
  return { apiInfo, script }
}

// 从文件导入音源
const importApiFromFile = async (filePath) => {
  try {
    const scriptRaw = await fs.promises.readFile(filePath, 'utf-8')
    return await importApi(scriptRaw)
  } catch (error) {
    throw new Error(`读取文件失败：${error.message}`)
  }
}

// 验证音源脚本
const validateScript = (script) => {
  try {
    const info = parseScriptInfo(script)
    return {
      valid: true,
      info: {
        name: info.name,
        version: info.version,
        author: info.author,
        description: info.description,
        homepage: info.homepage,
      }
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    }
  }
}

module.exports = {
  parseScriptInfo,
  deflateScript,
  inflateScript,
  importApi,
  importApiFromFile,
  validateScript,
  INFO_NAMES,
}
