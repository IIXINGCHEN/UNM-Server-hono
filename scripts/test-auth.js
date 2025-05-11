/**
 * 测试API鉴权参数生成和验证
 * 
 * 使用方法:
 * node scripts/test-auth.js
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// 加载环境变量
dotenv.config();

// 获取鉴权密钥
const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  console.error('错误: 未配置鉴权密钥 (AUTH_SECRET)');
  console.error('请在 .env 文件中设置 AUTH_SECRET');
  process.exit(1);
}

// 获取API密钥
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error('错误: 未配置API密钥 (API_KEY)');
  console.error('请在 .env 文件中设置 API_KEY');
  process.exit(1);
}

// 生成随机数
function generateNonce(length = 8) {
  return crypto.randomBytes(length).toString('hex');
}

// 生成签名
function generateSignature(timestamp, nonce, path, query, secret) {
  // 按字母顺序排序查询参数
  const sortedQuery = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join('&');

  // 构建签名字符串: 时间戳|随机数|路径|查询参数
  const signString = `${timestamp}|${nonce}|${path}|${sortedQuery}`;

  console.log('签名字符串:', signString);

  // 使用HMAC-SHA256算法生成签名
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signString);
  return hmac.digest('hex');
}

// 生成完整的鉴权参数
function generateAuthParam(path, query, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const signature = generateSignature(timestamp, nonce, path, query, secret);
  return `${signature}|${timestamp}|${nonce}`;
}

// 测试用例
const testCases = [
  {
    name: '匹配音乐资源',
    path: '/api/match',
    query: {
      id: '1962165898',
      server: 'kuwo,kugou,bilibili',
      type: 'url'
    }
  },
  {
    name: '网易云音乐获取',
    path: '/api/ncmget',
    query: {
      id: '1962165898',
      br: '320',
      type: 'url'
    }
  },
  {
    name: '其他音源获取',
    path: '/api/otherget',
    query: {
      name: '起风了',
      type: 'url'
    }
  }
];

// 执行测试
console.log('API密钥:', apiKey);
console.log('鉴权密钥:', authSecret.substring(0, 10) + '...');
console.log('\n开始测试鉴权参数生成...\n');

for (const testCase of testCases) {
  console.log(`测试用例: ${testCase.name}`);
  console.log(`路径: ${testCase.path}`);
  console.log(`查询参数:`, testCase.query);

  // 生成鉴权参数
  const authParam = generateAuthParam(testCase.path, testCase.query, authSecret);
  console.log(`鉴权参数: ${authParam}`);

  // 构建完整URL
  const queryString = Object.entries(testCase.query)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const fullUrl = `${testCase.path}?${queryString}&auth=${authParam}`;
  console.log(`完整URL: ${fullUrl}`);

  // 构建curl命令
  const curlCmd = `curl -H "X-API-Key: ${apiKey}" "http://localhost:5678${fullUrl}"`;
  console.log(`curl命令: ${curlCmd}`);

  console.log('\n');
}

console.log('测试完成');
