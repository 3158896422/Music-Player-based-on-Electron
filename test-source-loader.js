/**
 * 音源加载测试脚本
 * 用于测试新的 BrowserWindow 音源加载机制
 */

const path = require('path')
const fs = require('fs')

console.log('=== 音源加载测试 ===\n')

// 检查必要的文件是否存在
const requiredFiles = [
  './userApi/renderer/user-api.html',
  './userApi/renderer/preload.js',
  './userApi/main.js',
  './userApi/rendererEvent.js',
  './userApi/utils.js',
  './sourceManager.js',
]

console.log('1. 检查必要的文件...')
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file))
  console.log(`   ${exists ? '✓' : '✗'} ${file}`)
  if (!exists) {
    console.error(`   错误：文件不存在：${file}`)
  }
})

console.log('\n2. 检查文件内容...')

// 检查 preload.js 是否暴露了 window.lx
const preloadPath = path.join(__dirname, './userApi/renderer/preload.js')
if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf-8')
  const hasLx = preloadContent.includes('contextBridge.exposeInMainWorld(\'lx\'')
  const hasRequest = preloadContent.includes('request(')
  const hasSend = preloadContent.includes('send(')
  const hasOn = preloadContent.includes('on(')
  
  console.log(`   ${hasLx ? '✓' : '✗'} 暴露 window.lx`)
  console.log(`   ${hasRequest ? '✓' : '✗'} 实现 request 方法`)
  console.log(`   ${hasSend ? '✓' : '✗'} 实现 send 方法`)
  console.log(`   ${hasOn ? '✓' : '✗'} 实现 on 方法`)
}

// 检查 utils.js 是否有脚本解析功能
const utilsPath = path.join(__dirname, './userApi/utils.js')
if (fs.existsSync(utilsPath)) {
  const utilsContent = fs.readFileSync(utilsPath, 'utf-8')
  const hasParseScriptInfo = utilsContent.includes('parseScriptInfo')
  const hasValidateScript = utilsContent.includes('validateScript')
  
  console.log(`   ${hasParseScriptInfo ? '✓' : '✗'} 脚本信息解析`)
  console.log(`   ${hasValidateScript ? '✓' : '✗'} 脚本验证`)
}

// 检查 sourceManager.js 是否使用 BrowserWindow
const sourceManagerPath = path.join(__dirname, './sourceManager.js')
if (fs.existsSync(sourceManagerPath)) {
  const sourceManagerContent = fs.readFileSync(sourceManagerPath, 'utf-8')
  const usesRendererEvent = sourceManagerContent.includes('userApiRendererEvent')
  const hasInitSource = sourceManagerContent.includes('initSource')
  const hasWaitForInit = sourceManagerContent.includes('waitForInit')
  
  console.log(`   ${usesRendererEvent ? '✓' : '✗'} 使用 rendererEvent 模块`)
  console.log(`   ${hasInitSource ? '✓' : '✗'} 实现 initSource 方法`)
  console.log(`   ${hasWaitForInit ? '✓' : '✗'} 实现 waitForInit 方法`)
}

console.log('\n3. 测试脚本文件...')
const testSourcePath = path.join(__dirname, './test-source.js')
if (fs.existsSync(testSourcePath)) {
  const testSourceContent = fs.readFileSync(testSourcePath, 'utf-8')
  const hasName = testSourceContent.includes('@name')
  const hasSend = testSourceContent.includes('send(')
  const hasOn = testSourceContent.includes('on(')
  
  console.log(`   ${hasName ? '✓' : '✗'} 包含元信息注释`)
  console.log(`   ${hasSend ? '✓' : '✗'} 调用 send 方法`)
  console.log(`   ${hasOn ? '✓' : '✗'} 调用 on 方法`)
} else {
  console.log('   ✗ 测试脚本不存在')
}

console.log('\n=== 测试完成 ===')
console.log('\n提示：要完整测试音源加载功能，请运行 Electron 应用并导入 test-source.js 文件')
