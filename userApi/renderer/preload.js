const { contextBridge, ipcRenderer, webFrame } = require('electron');
const needle = require('needle');
const zlib = require('zlib');
const { createCipheriv, publicEncrypt, constants, randomBytes, createHash } = require('crypto');

let isInitedApi = false;
let currentApiId = null;
const events = { request: null };
const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
  updateAlert: 'updateAlert'
};
const eventNames = Object.values(EVENT_NAMES);

const onError = (errorMessage) => {
  if (isInitedApi) return;
  isInitedApi = true;
  if (errorMessage.length > 1024) errorMessage = errorMessage.substring(0, 1024) + '...';
  ipcRenderer.send('userApi_init', {
    apiId: currentApiId,
    data: null,
    status: false,
    message: errorMessage
  });
};

contextBridge.exposeInMainWorld('lx', {
  EVENT_NAMES,
  
  request(url, { method = 'get', timeout, headers, body, form, formData }, callback) {
    let options = { 
      headers: { 
        ...headers, 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' 
      },
      response_timeout: timeout || 60000 
    };
    
    let data = body || form || formData;
    if (form || formData) options.json = false;

    needle.request(method, url, data, options, (err, resp) => {
      try {
        if (err) {
          callback.call(this, err, null, null);
        } else {
          let rawBody = resp.raw.toString();
          let formattedBody;
          try { formattedBody = JSON.parse(rawBody); } catch (_) { formattedBody = rawBody; }
          callback.call(this, null, {
            statusCode: resp.statusCode,
            headers: resp.headers,
            body: formattedBody,
          }, formattedBody);
        }
      } catch (err) {
        onError(err.message);
      }
    });
    return () => {};
  },
  
  send(eventName, data) {
    return new Promise((resolve, reject) => {
      if (!eventNames.includes(eventName)) {
        return reject(new Error('The event is not supported: ' + eventName));
      }
      
      switch (eventName) {
        case EVENT_NAMES.inited:
          if (isInitedApi) {
            return reject(new Error('Script is inited'));
          }
          isInitedApi = true;
          
          if (!data) {
            ipcRenderer.send('userApi_init', {
              apiId: currentApiId,
              data: null,
              status: false,
              message: 'Missing required parameter init info'
            });
            return reject(new Error('Missing required parameter init info'));
          }

          ipcRenderer.send('userApi_init', {
            apiId: currentApiId,
            data: data,
            status: true,
            message: ''
          });
          resolve();
          break;
          
        case EVENT_NAMES.updateAlert:
          ipcRenderer.send('userApi_showUpdateAlert', data);
          resolve();
          break;
          
        default:
          reject(new Error('Unknown event name: ' + eventName));
      }
    });
  },
  
  on(eventName, handler) {
    return new Promise((resolve, reject) => {
      if (!eventNames.includes(eventName)) {
        return reject(new Error('The event is not supported: ' + eventName));
      }
      
      switch (eventName) {
        case EVENT_NAMES.request:
          events.request = handler;
          resolve();
          break;
          
        default:
          reject(new Error('The event is not supported: ' + eventName));
      }
    });
  },
  
  utils: {
    crypto: {
      aesEncrypt: (buf, mode, key, iv) => {
        const cipher = createCipheriv(mode, key, iv);
        return Buffer.concat([cipher.update(buf), cipher.final()]);
      },
      rsaEncrypt: (buf, key) => {
        const b = Buffer.concat([Buffer.alloc(128 - buf.length), buf]);
        return publicEncrypt({ key, padding: constants.RSA_NO_PADDING }, b);
      },
      randomBytes: (size) => randomBytes(size),
      md5: (str) => createHash('md5').update(str).digest('hex'),
    },
    buffer: {
      from: (...args) => Buffer.from(...args),
      bufToString: (buf, f) => Buffer.from(buf, 'binary').toString(f),
    },
    zlib: {
      inflate: (buf) => new Promise((res, rej) => zlib.inflate(buf, (e, d) => e ? rej(e) : res(d))),
      deflate: (d) => new Promise((res, rej) => zlib.deflate(d, (e, b) => e ? rej(e) : res(b))),
    }
  },
  
  currentScriptInfo: { name: 'LX Source Tester', version: '2.0.0' },
  version: '2.0.0',
  env: 'desktop'
});

// 暴露错误处理程序
contextBridge.exposeInMainWorld('__lx_init_error_handler__', {
  sendError: onError
});

// 添加错误监听器
webFrame.executeJavaScript(`(() => {
window.addEventListener('error', (event) => {
  if (event.isTrusted) globalThis.__lx_init_error_handler__.sendError(event.message.replace(/^Uncaught\sError:\s/, ''))
});
window.addEventListener('unhandledrejection', (event) => {
  if (!event.isTrusted) return;
  const message = typeof event.reason === 'string' ? event.reason : event.reason?.message ?? String(event.reason);
  globalThis.__lx_init_error_handler__.sendError(message.replace(/^Error:\s/, ''));
});
})()`);

// 监听初始化事件，使用 webFrame.executeJavaScript 执行用户脚本
ipcRenderer.on('userApi_initEnv', (event, userApi) => {
  console.log('收到 userApi_initEnv 事件:', userApi.name);
  currentApiId = userApi.id;
  
  // 重置初始化状态
  isInitedApi = false;
  
  // 使用 webFrame.executeJavaScript 在当前渲染进程执行用户脚本
  webFrame.executeJavaScript(userApi.script)
    .then(() => {
      console.log('✅ 用户脚本执行成功:', userApi.name);
    })
    .catch(err => {
      console.error('❌ 用户脚本执行失败:', err.message);
      onError('脚本执行失败：' + err.message);
    });
});

ipcRenderer.on('trigger-request', async (event, reqId, data) => {
  if (!events.request) {
    ipcRenderer.send('userApi_response', {
      data: { requestKey: reqId },
      status: false,
      message: '脚本未注册请求处理程序'
    });
    return;
  }

  try {
    const response = await events.request(data);
    ipcRenderer.send('userApi_response', {
      data: { requestKey: reqId, result: response },
      status: true,
      message: ''
    });
  } catch (err) {
    ipcRenderer.send('userApi_response', {
      data: { requestKey: reqId },
      status: false,
      message: err.message || err
    });
  }
});

// 处理音源搜索查询
ipcRenderer.on('source-search-query', async (event, query) => {
  if (!events.request) {
    ipcRenderer.send('source-search-error', '音源未初始化');
    return;
  }

  try {
    const response = await events.request({
      source: 'search',
      action: 'search',
      info: { keyword: query }
    });
    ipcRenderer.send('source-search-results', response);
  } catch (err) {
    ipcRenderer.send('source-search-error', err.message || err);
  }
});
