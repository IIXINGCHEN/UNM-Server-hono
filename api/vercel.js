// Vercel Serverless Function 入口文件
// 此文件用于在 Vercel 环境中作为所有请求的入口点

// 导入主应用
import { app } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静态文件路径
const publicPath = path.resolve(__dirname, '../public');
const distPath = path.resolve(__dirname, '../dist');

// 导出处理函数
export default async function handler(req, res) {
  // 将请求传递给Hono应用
  try {
    // 获取完整URL
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // 处理静态HTML文件
    if (pathname === '/' || pathname === '/index.html') {
      try {
        const indexPath = path.join(publicPath, 'index.html');
        const indexContent = await fs.promises.readFile(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        return res.end(indexContent);
      } catch (err) {
        console.error('Error reading index.html:', err);
        // 如果读取失败，继续尝试使用Hono应用处理
      }
    }

    // 处理API文档页面
    if (pathname === '/api-docs.html') {
      try {
        const apiDocsPath = path.join(publicPath, 'api-docs.html');
        const apiDocsContent = await fs.promises.readFile(apiDocsPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        return res.end(apiDocsContent);
      } catch (err) {
        console.error('Error reading api-docs.html:', err);
        // 如果读取失败，继续尝试使用Hono应用处理
      }
    }

    // 处理CSS文件
    if (pathname.startsWith('/css/')) {
      try {
        const cssPath = path.join(publicPath, pathname);
        const cssContent = await fs.promises.readFile(cssPath, 'utf-8');
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.statusCode = 200;
        return res.end(cssContent);
      } catch (err) {
        console.error(`Error reading CSS file ${pathname}:`, err);
        // 如果读取失败，继续尝试使用Hono应用处理
      }
    }

    // 处理JavaScript文件
    if (pathname.startsWith('/js/')) {
      try {
        const jsPath = path.join(publicPath, pathname);
        const jsContent = await fs.promises.readFile(jsPath, 'utf-8');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.statusCode = 200;
        return res.end(jsContent);
      } catch (err) {
        console.error(`Error reading JS file ${pathname}:`, err);
        // 如果读取失败，继续尝试使用Hono应用处理
      }
    }

    // 创建一个标准的Request对象
    const request = new Request(url, {
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
      error: error.message,
      path: req.url
    }));
  }
}
