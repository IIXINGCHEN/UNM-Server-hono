/**
 * UNM-Server-hono 监控脚本
 *
 * 用于监控服务的性能和稳定性，收集指标以便进一步优化
 * 使用方法: node scripts/monitor.js
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { createServer } from 'http';
import pkg from 'prom-client';
const { register, collectDefaultMetrics } = pkg;
const client = pkg;
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

// 监控配置
const config = {
  baseUrl: process.env.MONITOR_API_URL || 'http://localhost:5678',
  apiKey: process.env.API_KEY || 'test-api-key',
  authSecret: process.env.AUTH_SECRET || 'test-auth-secret',
  testId: '1962165898', // 测试音乐ID
  interval: parseInt(process.env.MONITOR_INTERVAL || '60000', 10), // 监控间隔（毫秒）
  port: parseInt(process.env.MONITOR_PORT || '9090', 10), // 指标服务器端口
  timeout: 10000, // 请求超时时间（毫秒）
};

// 创建指标
const apiResponseTime = new client.Histogram({
  name: 'unm_api_response_time_seconds',
  help: 'API响应时间（秒）',
  labelNames: ['endpoint', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const apiRequestsTotal = new client.Counter({
  name: 'unm_api_requests_total',
  help: 'API请求总数',
  labelNames: ['endpoint', 'status'],
});

const apiErrorsTotal = new client.Counter({
  name: 'unm_api_errors_total',
  help: 'API错误总数',
  labelNames: ['endpoint', 'error_type'],
});

const healthCheckStatus = new client.Gauge({
  name: 'unm_health_check_status',
  help: '健康检查状态（1=正常，0=异常）',
});

const systemInfo = new client.Gauge({
  name: 'unm_system_info',
  help: '系统信息',
  labelNames: ['version', 'node_version'],
});

// 收集默认指标（CPU、内存等）
collectDefaultMetrics({ prefix: 'unm_' });

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

// 监控端点
const endpoints = [
  {
    name: '健康检查',
    path: '/health',
    needsAuth: false,
    needsApiKey: false,
  },
  {
    name: '服务信息',
    path: '/api/info',
    needsAuth: true,
    needsApiKey: true,
  },
  {
    name: '音乐匹配',
    path: `/api/match?id=${config.testId}&type=url`,
    needsAuth: true,
    needsApiKey: true,
  },
  {
    name: '网易云音乐获取',
    path: `/api/ncmget?id=${config.testId}&br=320&type=url`,
    needsAuth: true,
    needsApiKey: true,
  },
];

// 监控函数
async function monitor() {
  console.log(chalk.blue(`[${new Date().toLocaleString()}] 开始监控...`));

  for (const endpoint of endpoints) {
    try {
      // 准备URL和请求选项
      let url = `${config.baseUrl}${endpoint.path}`;

      // 添加鉴权参数
      if (endpoint.needsAuth) {
        const authParam = getAuthParam(endpoint.path);
        url += url.includes('?') ? '&' : '?';
        url += `auth=${authParam}`;
      }

      // 准备请求选项
      const options = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: config.timeout,
      };

      // 添加API密钥
      if (endpoint.needsApiKey) {
        options.headers['X-API-Key'] = config.apiKey;
      }

      // 记录开始时间
      const startTime = process.hrtime();

      // 发送请求
      const response = await fetch(url, options);
      const data = await response.json();

      // 计算响应时间
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      // 更新指标
      apiResponseTime.labels(endpoint.name, response.status.toString()).observe(duration);
      apiRequestsTotal.labels(endpoint.name, response.status.toString()).inc();

      // 更新健康检查状态
      if (endpoint.name === '健康检查') {
        healthCheckStatus.set(data.data && data.data.status === 'ok' ? 1 : 0);
      }

      // 更新系统信息
      if (endpoint.name === '服务信息' && data.data) {
        systemInfo.labels(
          data.data.version || 'unknown',
          data.data.node_version || 'unknown'
        ).set(1);
      }

      console.log(chalk.green(`[${endpoint.name}] 状态: ${response.status}, 响应时间: ${duration.toFixed(3)}s`));
    } catch (error) {
      // 记录错误
      apiErrorsTotal.labels(endpoint.name, error.name).inc();
      console.log(chalk.red(`[${endpoint.name}] 错误: ${error.message}`));

      // 如果是健康检查，更新状态为异常
      if (endpoint.name === '健康检查') {
        healthCheckStatus.set(0);
      }
    }
  }

  console.log(chalk.blue(`[${new Date().toLocaleString()}] 监控完成`));
}

// 创建指标服务器
const server = createServer(async (req, res) => {
  if (req.url === '/metrics') {
    // 返回指标
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } else {
    // 返回404
    res.statusCode = 404;
    res.end('Not Found');
  }
});

// 启动监控
async function start() {
  // 启动指标服务器
  server.listen(config.port, () => {
    console.log(chalk.green(`指标服务器已启动，监听端口 ${config.port}`));
    console.log(chalk.green(`指标地址: http://localhost:${config.port}/metrics`));
  });

  // 执行首次监控
  await monitor();

  // 定期执行监控
  setInterval(monitor, config.interval);

  // 处理进程退出
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n正在关闭监控服务...'));
    server.close(() => {
      console.log(chalk.yellow('监控服务已关闭'));
      process.exit(0);
    });
  });
}

// 启动监控
start().catch((error) => {
  console.error(chalk.red(`监控启动错误: ${error.message}`));
  process.exit(1);
});
