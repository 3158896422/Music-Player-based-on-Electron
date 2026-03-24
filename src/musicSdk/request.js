/**
 * HTTP 请求模块
 * 基于 axios 封装
 */

const axios = require('axios');

// 创建 axios 实例
const request = axios.create({
  timeout: 10000, // 10 秒超时
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

// 请求拦截器
request.interceptors.request.use(
  config => {
    // 可以在这里添加通用的请求处理
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    if (error.response) {
      // 服务器返回错误响应
      console.error(`HTTP ${error.response.status}:`, error.message);
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('请求超时或无响应:', error.message);
    } else {
      // 请求配置出错
      console.error('请求错误:', error.message);
    }
    return Promise.reject(error);
  }
);

module.exports = request;
