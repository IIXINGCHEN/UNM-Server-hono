import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as crypto from 'crypto';
import { getClientIp } from '../utils/ip.js';
import { logger } from '../utils/logger.js';
import {
  ApiPermissionLevel,
  getApiPermissionLevel,
  validateApiKeyPermission,
  getProvidedApiKey,
  validateOrigin
} from '../utils/api-permissions.js';

// 请求ID生成器
export const generateRequestId = (): string => {
  return crypto.randomUUID();
};

// 请求ID中间件
export const requestIdMiddleware = async (c: Context, next: Next) => {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.res.headers.set('X-Request-ID', requestId);
  await next();
};

// 安全头中间件
export const securityHeadersMiddleware = async (c: Context, next: Next) => {
  // 基本安全头
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 内容安全策略
  // 环境变量检查
  const isDev = process.env.NODE_ENV === 'development';


  // 基础CSP配置
  let scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval'";
  let styleSrc = "'self' 'unsafe-inline'";
  let fontSrc = "'self' data:";
  let imgSrc = "'self' data:";
  let connectSrc = "'self'";

  // 检查是否允许CDN资源
  if (process.env.ALLOW_CDN === 'true') {
    // 添加Tailwind CSS CDN和highlight.js
    scriptSrc += " https://cdn.tailwindcss.com https://cdnjs.cloudflare.com";

    // 添加Font Awesome、Google Fonts和highlight.js样式
    styleSrc += " https://cdnjs.cloudflare.com https://fonts.googleapis.com";

    // 添加Google Fonts和Font Awesome字体源
    fontSrc += " https://fonts.gstatic.com https://cdnjs.cloudflare.com";

    // 添加图片源
    imgSrc += " https://cdnjs.cloudflare.com https://img.imsyy.top";

    // 添加连接源
    connectSrc += " https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com";
  } else {
    logger.info('CDN资源已禁用，使用本地资源');
  }

  // 在开发环境中放宽CSP限制，以便调试
  if (isDev) {
    scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval' *";
    styleSrc = "'self' 'unsafe-inline' *";
    fontSrc = "'self' data: *";
    imgSrc = "'self' data: *";
    connectSrc = "'self' *";
  }

  // 构建完整的CSP值
  const cspValue = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `font-src ${fontSrc}`,
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`
  ].join('; ');

  // 添加报告URI
  const reportUri = "/api/csp-report";
  const cspValueWithReport = cspValue + `; report-uri ${reportUri}`;

  // 在开发环境中，可以考虑添加report-only模式，以便调试CSP问题
  if (isDev) {
    // 设置CSP，包含报告功能
    c.res.headers.set('Content-Security-Policy', cspValueWithReport);

    // 可选：添加CSP报告模式，帮助调试
    // 这会同时报告违规但不阻止资源加载，有助于调试
    c.res.headers.set('Content-Security-Policy-Report-Only', cspValueWithReport);
  } else {
    // 生产环境中设置严格的CSP，包含报告功能
    c.res.headers.set('Content-Security-Policy', cspValueWithReport);
  }

  // 如果启用HTTPS，添加HSTS头
  if (process.env.ENABLE_HTTPS === 'true') {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  await next();
};

// 速率限制中间件
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

// 清理过期的速率限制记录
const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
};

// 每小时清理一次
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const rateLimit = parseInt(process.env.RATE_LIMIT || '100', 10);

  // 如果速率限制设置为0，则禁用此中间件
  if (rateLimit <= 0) {
    await next();
    return;
  }

  // 获取客户端IP
  const ip = getClientIp(c);

  const now = Date.now();
  const resetTime = now + 60 * 1000; // 1分钟后重置

  // 初始化或更新IP的请求计数
  if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
    rateLimitStore[ip] = { count: 1, resetTime };
  } else {
    rateLimitStore[ip].count += 1;
  }

  // 设置速率限制头
  c.res.headers.set('X-RateLimit-Limit', rateLimit.toString());
  c.res.headers.set('X-RateLimit-Remaining', Math.max(0, rateLimit - rateLimitStore[ip].count).toString());
  c.res.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitStore[ip].resetTime / 1000).toString());

  // 检查是否超过限制
  if (rateLimitStore[ip].count > rateLimit) {
    throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' });
  }

  await next();
};

// API密钥验证中间件
export const apiKeyMiddleware = async (c: Context, next: Next) => {
  const requestId = c.get('requestId') || 'unknown';
  const path = c.req.path;

  // 获取API权限级别
  const requiredLevel = getApiPermissionLevel(path);

  // 公开API无需验证密钥
  if (requiredLevel === ApiPermissionLevel.PUBLIC) {
    await next();
    return;
  }

  // 检查环境变量配置
  const serverApiKey = process.env.API_KEY;
  const clientApiKey = process.env.CLIENT_API_KEY;

  // 验证服务器API密钥配置
  if (requiredLevel === ApiPermissionLevel.SERVER && (!serverApiKey || serverApiKey.trim() === '')) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('生产环境未配置服务器API密钥', new Error('API_KEY not configured'), { requestId, path });
      return c.json({
        code: 500,
        message: '服务器配置错误',
        requestId
      }, 500, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    } else {
      logger.warn('开发环境未配置服务器API密钥，跳过验证', { requestId, path });
      await next();
      return;
    }
  }

  // 验证客户端API密钥配置
  if (requiredLevel === ApiPermissionLevel.CLIENT && (!clientApiKey || clientApiKey.trim() === '') && (!serverApiKey || serverApiKey.trim() === '')) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('生产环境未配置客户端API密钥', new Error('CLIENT_API_KEY not configured'), { requestId, path });
      return c.json({
        code: 500,
        message: '服务器配置错误',
        requestId
      }, 500, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    } else {
      logger.warn('开发环境未配置客户端API密钥，跳过验证', { requestId, path });
      await next();
      return;
    }
  }

  // 获取提供的API密钥
  const providedKey = getProvidedApiKey(c);

  // 添加详细日志，帮助诊断问题
  logger.debug(`API密钥验证: 路径=${path}, 权限级别=${requiredLevel}, 提供密钥=${providedKey ? '是' : '否'}`, {
    requestId,
    path,
    method: c.req.method,
    requiredLevel,
    hasKey: !!providedKey
  });

  // 验证API密钥权限
  const { valid, reason } = validateApiKeyPermission(providedKey, requiredLevel);

  // 开发环境或Vercel环境中的特殊处理
  if (!valid && (process.env.NODE_ENV !== 'production' || process.env.VERCEL === '1' || process.env.VERCEL === 'true')) {
    // 检查是否来自localhost或Vercel域名
    const host = c.req.header('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isVercel = host.includes('vercel.app');

    if (isLocalhost || isVercel || process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
      logger.warn(`特殊环境下，允许请求跳过API密钥验证`, {
        requestId,
        path,
        method: c.req.method,
        requiredLevel,
        host,
        isVercel: process.env.VERCEL === '1' || process.env.VERCEL === 'true'
      });
      await next();
      return;
    }
  }

  // 如果验证失败，拒绝请求
  if (!valid) {
    logger.warn(`API密钥验证失败: ${reason}`, {
      requestId,
      path,
      method: c.req.method,
      requiredLevel
    });

    // 返回JSON格式的错误响应，而不是抛出异常
    return c.json({
      code: 401,
      message: reason || 'API密钥验证失败',
      requestId
    }, 401, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }

  // 验证通过
  await next();
};

// HTTPS重定向中间件
export const httpsRedirectMiddleware = async (c: Context, next: Next) => {
  // 在生产环境中，如果未启用HTTPS，则记录警告
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_HTTPS !== 'true') {
    logger.warn('生产环境未启用HTTPS，建议启用HTTPS以提高安全性');
  }

  // 如果启用了HTTPS，且请求是HTTP，则重定向到HTTPS
  if (process.env.ENABLE_HTTPS === 'true' && c.req.header('X-Forwarded-Proto') === 'http') {
    const url = new URL(c.req.url);
    url.protocol = 'https:';
    return c.redirect(url.toString(), 301);
  }

  await next();
};

// 输入验证工具函数
export const validateInput = {
  // 验证ID是否为有效的数字或字符串
  id: (id: string | null): boolean => {
    if (!id) return false;
    // 如果是数字字符串，检查是否为正整数
    if (/^\d+$/.test(id)) {
      return parseInt(id, 10) > 0;
    }
    // 如果是其他字符串，检查长度和字符
    return id.length > 0 && id.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(id);
  },

  // 验证音质参数
  br: (br: string | null, allowedValues: string[]): boolean => {
    return !!br && allowedValues.includes(br);
  },

  // 验证音源参数
  sources: (sources: string[]): boolean => {
    const validSources = [
      "pyncmd", "kuwo", "bilibili", "migu", "kugou",
      "qq", "youtube", "youtube-dl", "yt-dlp", "joox"
    ];

    if (sources.length === 0) return false;

    return sources.every(source =>
      validSources.includes(source) &&
      source.length > 0 &&
      source.length <= 20
    );
  },

  // 验证搜索名称
  name: (name: string | null): boolean => {
    return !!name && name.length > 0 && name.length <= 200;
  }
};

// 清理和转义HTML特殊字符，防止XSS攻击
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
