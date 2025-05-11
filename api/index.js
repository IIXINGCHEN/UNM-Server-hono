// Vercel Serverless Function 入口文件
// 此文件用于在 Vercel 环境中作为 API 入口点

// 导入主应用
import { app } from '../dist/index.js';

// 导出处理函数
export default async function handler(req, res) {
  // 将请求传递给Hono应用
  try {
    // 创建一个标准的Request对象
    const request = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined
    });

    // 使用Hono应用处理请求
    const response = await app.fetch(request);

    // 设置状态码
    res.statusCode = response.status;

    // 设置响应头
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }

    // 设置响应体
    const body = await response.text();
    res.end(body);
  } catch (error) {
    console.error('Error handling request:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'error',
      message: 'Internal Server Error',
      error: error.message
    }));
  }
}
