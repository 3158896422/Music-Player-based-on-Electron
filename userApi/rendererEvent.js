const { ipcRenderer } = require('electron');

let userApi = null;
let apiStatus = { status: true };
const requestQueue = new Map();
const timeouts = new Map();

const init = () => {
  ipcRenderer.on('userApi_init', (event, { data, status, message }) => {
    apiStatus = status
      ? { status: true, apiInfo: { ...userApi, sources: data?.sources } }
      : { status: false, apiInfo: userApi, message };

    ipcRenderer.send('user-api-status-change', apiStatus);
  });

  ipcRenderer.on('userApi_response', (event, { data, status, message }) => {
    const { requestKey, result } = data || {};
    const request = requestQueue.get(requestKey);

    if (!request) {
      return;
    }

    requestQueue.delete(requestKey);
    clearRequestTimeout(requestKey);

    if (status) {
      request[0](result);
    } else {
      request[1](new Error(message));
    }
  });

  ipcRenderer.on('sandbox-event', (event, scriptId, type, data) => {
    if (type === 'response') {
      const { reqId, response } = data;
      const request = requestQueue.get(reqId);

      if (!request) {
        return;
      }

      requestQueue.delete(reqId);
      clearRequestTimeout(reqId);

      request[0](response);
    } else if (type === 'error') {
      const { reqId, msg } = data;
      const request = requestQueue.get(reqId);

      if (!request) {
        return;
      }

      requestQueue.delete(reqId);
      clearRequestTimeout(reqId);

      request[1](new Error(msg));
    }
  });
};

const loadApi = async (apiId, apiInfo) => {
  if (!apiId) {
    apiStatus = { status: false, message: 'api id is null' };
    ipcRenderer.send('user-api-status-change', apiStatus);
    return;
  }

  userApi = {
    id: apiInfo.id,
    name: apiInfo.name,
    version: apiInfo.version,
    author: apiInfo.author,
    description: apiInfo.description
  };

  const result = await ipcRenderer.invoke('load-user-api', apiInfo);

  if (!result.success) {
    throw new Error(result.error || '加载失败');
  }
};

const cancelRequest = (requestKey) => {
  if (!requestQueue.has(requestKey)) return;

  const request = requestQueue.get(requestKey);
  request[1](new Error('Cancel request'));
  requestQueue.delete(requestKey);
  clearRequestTimeout(requestKey);
};

const request = async ({ requestKey, data }) => {
  return new Promise((resolve, reject) => {
    if (!userApi) {
      reject(new Error('user api is not loaded'));
      return;
    }

    const timeout = timeouts.get(requestKey);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(timeout);
      cancelRequest(requestKey);
    }

    requestQueue.set(requestKey, [resolve, reject]);
    timeouts.set(requestKey, setTimeout(() => {
      if (requestQueue.has(requestKey)) {
        requestQueue.get(requestKey)[1](new Error('Request timeout'));
        requestQueue.delete(requestKey);
        timeouts.delete(requestKey);
      }
    }, 10000));

    ipcRenderer.send('userApi_request', userApi.id, requestKey, data);
  });
};

const clearRequestTimeout = (requestKey) => {
  const timeout = timeouts.get(requestKey);
  if (timeout) {
    clearTimeout(timeout);
    timeouts.delete(timeout);
  }
};

const openDevTools = () => {
  if (userApi) {
    ipcRenderer.send('userApi_openDevTools', userApi.id);
  }
};

const closeApi = (apiId) => {
  ipcRenderer.send('unload-user-api', apiId);
  userApi = null;
};

module.exports = {
  init,
  loadApi,
  request,
  cancelRequest,
  openDevTools,
  closeApi
};