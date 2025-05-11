// Vercel Serverless Function - 音乐资源请求接口
// 此文件用于在 Vercel 环境中处理音乐资源请求

import axios from 'axios';

// 导出处理函数
export default async function handler(req, res) {
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

  // 获取请求参数
  const { id, br } = req.query;

  // 验证参数
  if (!id) {
    return res.status(400).json({
      status: 'error',
      message: '缺少必要参数: id'
    });
  }

  try {
    // 构建请求 URL
    const apiUrl = process.env.MUSIC_API_URL || 'https://music-api.gdstudio.xyz/api.php';
    const requestUrl = `${apiUrl}?id=${id}${br ? `&br=${br}` : ''}`;

    // 发送请求
    const response = await axios.get(requestUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'UNM-Server-hono/2.2.6'
      }
    });

    // 返回响应
    return res.status(200).json({
      status: 'success',
      data: response.data,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } catch (error) {
    console.error('Error fetching music resource:', error);
    
    return res.status(500).json({
      status: 'error',
      message: '获取音乐资源失败',
      error: error.message,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
}
