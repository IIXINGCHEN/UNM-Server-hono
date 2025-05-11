/**
 * UNM-Server-hono API测试脚本
 *
 * 用于测试所有API端点是否正常工作
 * 使用方法: node scripts/api-test.js
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import dotenv from 'dotenv';
// 自定义实现 generateAuthParam 函数，避免依赖编译后的代码
import crypto from 'crypto';

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

// 加载环境变量
dotenv.config();

// 测试配置
const config = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:5678',
  apiKey: process.env.API_KEY || 'test-api-key',
  authSecret: process.env.AUTH_SECRET || 'test-auth-secret',
  testId: '1962165898', // 测试音乐ID
  testName: '起风了', // 测试音乐名称
  timeout: 10000, // 请求超时时间（毫秒）
};

// 测试用例
const testCases = [
  {
    name: '健康检查',
    endpoint: '/health',
    method: 'GET',
    needsAuth: false,
    needsApiKey: false,
    expectedStatus: 200,
    validate: (data) => data && data.status === 'ok' && data.version,
  },
  {
    name: '服务信息',
    endpoint: '/api/info',
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.version,
  },
  {
    name: '前端配置',
    endpoint: '/api/config',
    method: 'GET',
    needsAuth: false,
    needsApiKey: false,
    expectedStatus: 200,
    validate: (data) => data && data.apiKey,
  },
  {
    name: '音源匹配测试',
    endpoint: '/api/test',
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url,
  },
  {
    name: '音乐匹配(URL)',
    endpoint: `/api/match?id=${config.testId}&server=kuwo,kugou&type=url`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url,
  },
  {
    name: '音乐匹配(封面)',
    endpoint: `/api/match?id=${config.testId}&type=pic`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.pic,
  },
  {
    name: '音乐匹配(歌词)',
    endpoint: `/api/match?id=${config.testId}&type=lrc`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.lrc,
  },
  {
    name: '网易云音乐获取(URL)',
    endpoint: `/api/ncmget?id=${config.testId}&br=320&type=url`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url,
  },
  {
    name: '网易云音乐获取(封面)',
    endpoint: `/api/ncmget?id=${config.testId}&type=pic`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.pic,
  },
  {
    name: '网易云音乐获取(歌词)',
    endpoint: `/api/ncmget?id=${config.testId}&type=lrc`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.lrc,
  },
  {
    name: '其他音源音乐获取(ID)',
    endpoint: `/api/otherget?id=${config.testId}&source=kuwo&type=url`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url,
  },
  {
    name: '其他音源音乐获取(名称)',
    endpoint: `/api/otherget?name=${encodeURIComponent(config.testName)}&type=url`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url,
  },
  {
    name: '音乐搜索',
    endpoint: `/api/search?name=${encodeURIComponent(config.testName)}`,
    method: 'GET',
    needsAuth: true,
    needsApiKey: true,
    expectedStatus: 200,
    validate: (data) => data && data.url_id,
  },
  {
    name: '鉴权参数生成',
    endpoint: `/api/auth?path=/api/match&params=id%3D${config.testId}%26type%3Durl`,
    method: 'GET',
    needsAuth: false,
    needsApiKey: false,
    expectedStatus: 200,
    validate: (data) => data && data.auth,
  },
];

// 生成鉴权参数
function getAuthParam(endpoint) {
  const url = new URL(endpoint, config.baseUrl);
  const path = url.pathname;
  const queryParams = {};

  url.searchParams.forEach((value, key) => {
    if (key !== 'auth') {
      queryParams[key] = value;
    }
  });

  return generateAuthParam(path, queryParams, config.authSecret);
}

// 执行测试
async function runTests() {
  console.log(chalk.blue('=== UNM-Server-hono API测试 ==='));
  console.log(chalk.gray(`基础URL: ${config.baseUrl}`));
  console.log(chalk.gray(`测试时间: ${new Date().toLocaleString()}`));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    process.stdout.write(`测试 ${chalk.cyan(test.name)} ... `);

    try {
      // 准备URL和请求选项
      let url = `${config.baseUrl}${test.endpoint}`;

      // 添加鉴权参数
      if (test.needsAuth) {
        const authParam = getAuthParam(test.endpoint);
        url += url.includes('?') ? '&' : '?';
        url += `auth=${authParam}`;
      }

      // 准备请求选项
      const options = {
        method: test.method,
        headers: {
          'Accept': 'application/json',
        },
        timeout: config.timeout,
      };

      // 添加API密钥
      if (test.needsApiKey) {
        options.headers['X-API-Key'] = config.apiKey;
      }

      // 发送请求
      const response = await fetch(url, options);
      const data = await response.json();

      // 验证状态码
      if (response.status !== test.expectedStatus) {
        throw new Error(`状态码错误: 期望 ${test.expectedStatus}, 实际 ${response.status}`);
      }

      // 验证响应数据
      // 健康检查端点的响应格式与其他API不同，直接验证整个响应
      if (test.name === '健康检查') {
        if (!test.validate(data)) {
          throw new Error(`响应数据验证失败: ${JSON.stringify(data)}`);
        }
      } else if (!test.validate(data.data)) {
        throw new Error(`响应数据验证失败: ${JSON.stringify(data)}`);
      }

      // 测试通过
      console.log(chalk.green('通过'));
      passed++;
    } catch (error) {
      // 测试失败
      console.log(chalk.red('失败'));
      console.log(chalk.red(`  错误: ${error.message}`));
      failed++;
    }
  }

  // 输出测试结果
  console.log('');
  console.log(chalk.blue('=== 测试结果 ==='));
  console.log(`总计: ${testCases.length}`);
  console.log(`通过: ${chalk.green(passed)}`);
  console.log(`失败: ${chalk.red(failed)}`);
  console.log('');

  // 返回测试结果
  return {
    total: testCases.length,
    passed,
    failed,
  };
}

// 执行测试
runTests().then((result) => {
  // 如果有测试失败，以非零状态码退出
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch((error) => {
  console.error(chalk.red(`测试执行错误: ${error.message}`));
  process.exit(1);
});
