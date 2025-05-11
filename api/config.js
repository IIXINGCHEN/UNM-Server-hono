// Vercel Serverless Function - 配置接口
// 此文件用于在 Vercel 环境中提供配置信息

// 导入配置
import { config } from '../dist/config/index.js';

// 导出处理函数
export default function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-API-Key, X-Request-ID');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 返回配置信息
  res.status(200).json({
    status: 'success',
    data: {
      version: '2.2.6',
      allowedDomains: process.env.ALLOWED_DOMAIN ? process.env.ALLOWED_DOMAIN.split(',') : ['*'],
      enableHttps: process.env.ENABLE_HTTPS === 'true',
      allowCdn: process.env.ALLOW_CDN === 'true',
      enableFlac: process.env.ENABLE_FLAC === 'true',
      selectMaxBr: process.env.SELECT_MAX_BR === 'true',
      followSourceOrder: process.env.FOLLOW_SOURCE_ORDER === 'true'
    }
  });
}
