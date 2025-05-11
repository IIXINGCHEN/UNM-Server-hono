/**
 * 请求限流中间件
 * 
 * 使用令牌桶算法实现更精确的请求限流
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getClientIp } from '../utils/ip.js';
import { logger } from '../utils/logger.js';

// 令牌桶接口
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  blocked: boolean;
  blockedUntil: number;
  totalRequests: number;
  limitExceeded: number;
}

// IP黑名单接口
interface BlacklistEntry {
  ip: string;
  reason: string;
  blockedAt: number;
  blockedUntil: number;
}

// 限流配置接口
interface RateLimitConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
  blockDuration: number;
  maxViolations: number;
}

// 令牌桶存储
const buckets: Map<string, TokenBucket> = new Map();

// IP黑名单
const blacklist: Map<string, BlacklistEntry> = new Map();

// 默认限流配置
const defaultConfig: RateLimitConfig = {
  capacity: 100,         // 桶容量（最大令牌数）
  refillRate: 10,        // 每次添加的令牌数
  refillInterval: 1000,  // 添加令牌的时间间隔（毫秒）
  blockDuration: 300000, // 超过限制后的封禁时间（毫秒）
  maxViolations: 5       // 允许的最大违规次数，超过后加入黑名单
};

// 路径特定的限流配置
const pathConfigs: Map<string, RateLimitConfig> = new Map([
  // 搜索API限流更严格
  ['/api/search', {
    capacity: 20,
    refillRate: 2,
    refillInterval: 1000,
    blockDuration: 600000,
    maxViolations: 3
  }],
  // 匹配API限流适中
  ['/api/match', {
    capacity: 50,
    refillRate: 5,
    refillInterval: 1000,
    blockDuration: 300000,
    maxViolations: 5
  }]
]);

// 清理过期的限流记录和黑名单
const cleanup = () => {
  const now = Date.now();
  
  // 清理过期的黑名单记录
  for (const [ip, entry] of blacklist.entries()) {
    if (entry.blockedUntil < now) {
      blacklist.delete(ip);
      logger.info(`IP已从黑名单中移除: ${ip}`);
    }
  }
  
  // 清理长时间未访问的令牌桶
  const expiryTime = now - 24 * 60 * 60 * 1000; // 24小时
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.lastRefill < expiryTime) {
      buckets.delete(key);
    }
  }
};

// 每小时清理一次
setInterval(cleanup, 60 * 60 * 1000);

/**
 * 获取路径的限流配置
 * @param path 请求路径
 * @returns 限流配置
 */
const getConfigForPath = (path: string): RateLimitConfig => {
  // 检查是否有路径特定的配置
  for (const [configPath, config] of pathConfigs.entries()) {
    if (path.startsWith(configPath)) {
      return config;
    }
  }
  
  // 返回默认配置
  return defaultConfig;
};

/**
 * 令牌桶限流中间件
 */
export const tokenBucketRateLimiter = async (c: Context, next: Next) => {
  // 从环境变量获取是否启用限流
  const enableRateLimit = process.env.ENABLE_RATE_LIMIT !== 'false';
  
  // 如果未启用限流，直接放行
  if (!enableRateLimit) {
    await next();
    return;
  }
  
  // 获取客户端IP
  const ip = getClientIp(c);
  const path = c.req.path;
  
  // 检查IP是否在黑名单中
  if (blacklist.has(ip)) {
    const entry = blacklist.get(ip)!;
    const now = Date.now();
    
    // 如果仍在封禁期内，拒绝请求
    if (entry.blockedUntil > now) {
      const remainingSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      
      logger.warn(`拒绝黑名单IP的请求`, {
        ip,
        path,
        reason: entry.reason,
        remainingSeconds
      });
      
      c.res.headers.set('Retry-After', remainingSeconds.toString());
      throw new HTTPException(403, { 
        message: `您的IP已被临时封禁，原因: ${entry.reason}，剩余时间: ${remainingSeconds}秒` 
      });
    } else {
      // 封禁期已过，从黑名单中移除
      blacklist.delete(ip);
      logger.info(`IP已从黑名单中移除: ${ip}`);
    }
  }
  
  // 获取路径的限流配置
  const config = getConfigForPath(path);
  
  // 构建桶标识（IP + 路径前缀）
  const pathPrefix = path.split('/').slice(0, 3).join('/');
  const bucketKey = `${ip}:${pathPrefix}`;
  
  // 获取或创建令牌桶
  if (!buckets.has(bucketKey)) {
    buckets.set(bucketKey, {
      tokens: config.capacity,
      lastRefill: Date.now(),
      blocked: false,
      blockedUntil: 0,
      totalRequests: 0,
      limitExceeded: 0
    });
  }
  
  const bucket = buckets.get(bucketKey)!;
  const now = Date.now();
  
  // 检查是否被临时封禁
  if (bucket.blocked) {
    if (now < bucket.blockedUntil) {
      const remainingSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
      
      // 增加违规计数
      bucket.limitExceeded++;
      
      // 检查是否超过最大违规次数
      if (bucket.limitExceeded > config.maxViolations) {
        // 加入黑名单
        const blockDuration = config.blockDuration * 2; // 黑名单封禁时间更长
        blacklist.set(ip, {
          ip,
          reason: '多次超出请求限制',
          blockedAt: now,
          blockedUntil: now + blockDuration
        });
        
        logger.warn(`IP已加入黑名单`, {
          ip,
          path,
          violations: bucket.limitExceeded,
          blockDuration
        });
        
        c.res.headers.set('Retry-After', Math.ceil(blockDuration / 1000).toString());
        throw new HTTPException(403, { 
          message: '您的IP已被临时封禁，原因: 多次超出请求限制' 
        });
      }
      
      logger.warn(`请求被限流`, {
        ip,
        path,
        remainingSeconds,
        violations: bucket.limitExceeded
      });
      
      c.res.headers.set('Retry-After', remainingSeconds.toString());
      throw new HTTPException(429, { 
        message: `请求过于频繁，请在${remainingSeconds}秒后重试` 
      });
    } else {
      // 封禁期已过，重置桶
      bucket.blocked = false;
      bucket.tokens = 1; // 给一个初始令牌
    }
  }
  
  // 计算需要添加的令牌数
  const elapsedTime = now - bucket.lastRefill;
  const intervalsElapsed = Math.floor(elapsedTime / config.refillInterval);
  
  if (intervalsElapsed > 0) {
    // 添加令牌，但不超过桶容量
    bucket.tokens = Math.min(
      config.capacity,
      bucket.tokens + intervalsElapsed * config.refillRate
    );
    bucket.lastRefill = now;
  }
  
  // 增加请求计数
  bucket.totalRequests++;
  
  // 检查是否有足够的令牌
  if (bucket.tokens < 1) {
    // 没有足够的令牌，请求被限流
    bucket.blocked = true;
    bucket.blockedUntil = now + config.blockDuration;
    bucket.limitExceeded++;
    
    logger.warn(`请求被限流`, {
      ip,
      path,
      blockDuration: config.blockDuration,
      violations: bucket.limitExceeded
    });
    
    c.res.headers.set('Retry-After', Math.ceil(config.blockDuration / 1000).toString());
    throw new HTTPException(429, { 
      message: `请求过于频繁，请稍后再试` 
    });
  }
  
  // 消耗一个令牌
  bucket.tokens -= 1;
  
  // 设置速率限制头
  c.res.headers.set('X-RateLimit-Limit', config.capacity.toString());
  c.res.headers.set('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
  c.res.headers.set('X-RateLimit-Reset', Math.ceil(bucket.lastRefill / 1000 + config.refillInterval / 1000).toString());
  
  await next();
};
