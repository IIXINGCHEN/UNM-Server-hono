import { Hono } from 'hono';
import { readPackageJson } from '../utils/package.js';
import { logger } from '../utils/logger.js';
import os from 'os';

// 创建健康检查路由实例
const health = new Hono();

// 服务启动时间
const startTime = Date.now();

// 系统信息缓存
let systemInfoCache: any = null;
let systemInfoCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

/**
 * 获取系统信息
 * @returns 系统信息对象
 */
async function getSystemInfo() {
  const now = Date.now();

  // 如果缓存有效，直接返回缓存
  if (systemInfoCache && now - systemInfoCacheTime < CACHE_TTL) {
    return systemInfoCache;
  }

  try {
    const packageJson = await readPackageJson();

    // 收集系统信息
    const systemInfo = {
      version: packageJson.version,
      uptime: Math.floor((now - startTime) / 1000), // 秒
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpus: os.cpus().length,
        memory: {
          total: Math.round(os.totalmem() / (1024 * 1024)), // MB
          free: Math.round(os.freemem() / (1024 * 1024)), // MB
          usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) // 百分比
        },
        loadAvg: os.loadavg()
      }
    };

    // 更新缓存
    systemInfoCache = systemInfo;
    systemInfoCacheTime = now;

    return systemInfo;
  } catch (error) {
    logger.error('获取系统信息失败', error as Error);

    // 返回基本信息
    return {
      version: 'unknown',
      uptime: Math.floor((now - startTime) / 1000),
      error: 'Failed to get system info'
    };
  }
}

/**
 * 简单健康检查
 * 返回200状态码表示服务正常运行
 */
health.get('/liveness', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  }, 200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
});

/**
 * 就绪检查
 * 检查服务是否准备好处理请求
 */
health.get('/readiness', async (c) => {
  try {
    // 这里可以添加其他依赖服务的检查
    // 例如数据库连接、缓存服务等

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    }, 200, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  } catch (error) {
    logger.error('就绪检查失败', error as Error);

    return c.json({
      status: 'error',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 503, {
      'Content-Type': 'application/json; charset=utf-8'
    }); // Service Unavailable
  }
});

/**
 * 详细健康检查
 * 返回系统详细信息
 */
health.get('/', async (c) => {
  try {
    const systemInfo = await getSystemInfo();

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ...systemInfo
    }, 200, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  } catch (error) {
    logger.error('健康检查失败', error as Error);

    return c.json({
      status: 'error',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }
});

export { health };
