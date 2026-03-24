/**
 * @name 测试音源
 * @description 用于测试洛雪音源加载功能
 * @version 1.0.0
 * @author Test
 */

console.log('测试脚本开始执行')
console.log('window.lx exists:', typeof window.lx)
console.log('globalThis.lx exists:', typeof globalThis.lx)

try {
  const { EVENT_NAMES, request, on, send } = globalThis.lx
  console.log('成功获取 lx API')
  console.log('EVENT_NAMES:', EVENT_NAMES)

  const sources = {
    kw: {
      name: '测试酷我音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k'],
    }
  }

  on(EVENT_NAMES.request, ({ source, action, info }) => {
    console.log('收到请求:', source, action, info)
    return new Promise((resolve, reject) => {
      if (action === 'musicUrl') {
        resolve('https://test.example.com/music.mp3')
      } else {
        reject(new Error('不支持的操作'))
      }
    })
  })

  console.log('准备发送 inited 事件')
  send(EVENT_NAMES.inited, {
    sources: sources,
  })
  console.log('inited 事件已发送')

} catch (error) {
  console.error('测试脚本执行出错:', error)
}
