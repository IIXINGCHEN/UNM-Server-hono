// src/app.ts 

// =============================================================================
// == 核心依赖导入 ==
// =============================================================================
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/serve-static';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { HTTPException } from 'hono/http-exception';
import { readFile } from 'fs/promises';
import path from 'path';
// 导入速率限制器相关
import { rateLimiter } from '@hono/rate-limiter'; // <-- 导入速率限制器工厂函数
import { MemoryStore } from '@hono/rate-limiter/memory-store'; // <-- 导入内存存储 (用于默认/开发)
// import { RedisStore } from '@hono/rate-limiter/redis'; // <-- 如果使用 Redis, 需要导入并安装 @upstash/redis
// import { Redis } from '@upstash/redis';

// =============================================================================
// == 应用内部模块导入 ==
// =============================================================================
import config from './config';
import pinoLogger from './utils/logger';
import apiRoutes from './routes';
import { ApiError } from './services/externalApi.service';
import { MusicController } from './controllers/music.controller';
import { MusicMatchService } from './services/musicMatch.service';
import { ExternalApiService } from './services/externalApi.service';
import { ProxyService } from './services/proxy.service';

// =============================================================================
// == Hono 应用实例化 ==
// =============================================================================
const app = new Hono<{ Variables: { requestId?: string } }>();

// =============================================================================
// == 服务与控制器实例化 ==
// =============================================================================
const musicMatchService = new MusicMatchService();
const externalApiService = new ExternalApiService();
const proxyService = new ProxyService();
const musicController = new MusicController(musicMatchService, externalApiService, proxyService);

// =============================================================================
// == 速率限制器初始化 ==
// =============================================================================
// 根据配置选择或创建速率限制器存储实例
let limiterStore;
if (config.RATE_LIMIT_STORE === 'redis' && config.RATE_LIMIT_REDIS_URL) {
  // 如果配置为 Redis 且提供了 URL
  try {
    // // 需要先安装: npm install @upstash/redis
    // const redisClient = Redis.fromEnv(); // 或者使用 new Redis({ url: config.RATE_LIMIT_REDIS_URL, token: ... })
    // limiterStore = new RedisStore(redisClient);
    pinoLogger.warn('Redis store for rate limiter is configured but Redis client setup is commented out. Falling back to memory store.');
    // 暂时回退到内存存储，需要取消注释并正确配置 Redis 客户端才能使用
    limiterStore = new MemoryStore();
  } catch (redisError) {
    pinoLogger.error({ err: redisError }, 'Failed to initialize Redis store for rate limiter. Falling back to memory store.');
    limiterStore = new MemoryStore(); // 初始化失败也回退到内存
  }
} else {
  // 默认使用内存存储
  limiterStore = new MemoryStore();
  if (config.NODE_ENV === 'production' && config.RATE_LIMIT_STORE === 'memory') {
      // 在生产环境中使用内存存储发出警告 (不适用于集群或多实例部署)
      pinoLogger.warn('Rate limiter is using MemoryStore in production. This is not recommended for multi-instance deployments.');
  }
}

// 创建速率限制器实例
const limiter = rateLimiter({
  // 时间窗口 (毫秒), 从配置读取
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  // 每个窗口允许的最大请求数, 从配置读取
  limit: config.RATE_LIMIT_MAX_REQUESTS,
  // // 自定义消息 (可选)
  // message: '请求过于频繁，请稍后再试。',
  // // 自定义状态码 (可选)
  // statusCode: 429,
  // 使用的存储实例
  store: limiterStore,
  // 用于区分用户的 key 生成器 (通常使用 IP 地址)
  keyGenerator: (c) => {
    // 尝试获取真实的客户端 IP (考虑代理情况)
    // Hono 不直接提供类似 express 的 req.ip, 需要检查 x-forwarded-for 或其他头
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'unknown_ip'; // 提供一个备用 ID
    return ip;
  },
  // // 跳过某些请求 (可选)
  // skip: (c) => {
  //   // return c.req.path === '/health'; // 例如跳过健康检查
  //   return false; // 默认不跳过
  // },
});

// =============================================================================
// == 全局中间件注册 (按执行顺序非常重要!) ==
// =============================================================================

// --- 1. URL 规范化 ---
app.use('*', trimTrailingSlash());

// --- 2. 请求 ID 生成与注入 ---
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// --- 3. 请求日志 ---
// (保持之前的 hono/logger 或自定义 Pino 中间件)
app.use('*', honoLogger((message: string, ...rest: string[]) => {
  pinoLogger.info({ logMessage: message, details: rest /*, requestId: c.get('requestId') */ }, 'Hono Request Log');
}));

// --- 4. 全局错误处理 ---
// (保持之前的 app.onError 实现)
app.onError((err, c) => {
  const requestId = c.get('requestId');
  let statusCode = 500;
  const errorResponse: { code: number; message: string; stack?: string; details?: any; requestId?: string } = {
    code: statusCode,
    message: '服务器内部错误 (Internal Server Error)',
    requestId: requestId,
  };

  if (err instanceof HTTPException) {
    statusCode = err.status;
    errorResponse.message = err.message;
  } else if (err instanceof ApiError) {
    statusCode = err.status;
    errorResponse.message = err.message;
    errorResponse.details = err.details;
  } else if (err instanceof Error) {
    errorResponse.message = err.message;
  }

  errorResponse.code = statusCode;

  if (config.NODE_ENV === 'development' && err instanceof Error && err.stack) {
    errorResponse.stack = err.stack;
  }

  pinoLogger.error({
    err: { message: (err as Error).message, stack: (err as Error).stack, status: statusCode, details: (err as any).details, ...(err instanceof Error ? { name: err.name } : {}) },
    requestId: requestId, url: c.req.url, method: c.req.method,
  }, `Error handled: ${statusCode} - ${errorResponse.message}`);

  return c.json(errorResponse, statusCode);
});


// --- 5. 速率限制 ---
// 应用速率限制中间件到所有请求 ('*')
// 应该放在核心业务逻辑路由之前, 但可能在静态文件、CORS 等之后或之前，取决于是否想对它们也限流
// 放在这里比较合适：在日志和错误处理之后，安全和 CORS 之后，但在主要 API 路由之前
app.use('*', limiter); // <-- 应用速率限制器

// --- 6. 安全头部 ---
app.use('*', secureHeaders());

// --- 7. CORS ---
app.use('*', cors({
  origin: config.ALLOWED_DOMAINS,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400,
}));

// --- 8. 静态文件服务 ---
// 请求路径以 /public/ 开头的，尝试从 ./src/public 目录提供服务
// 放在速率限制之后，这样静态文件请求也会被计入限制
app.use('/public/*', serveStatic({ root: './src' }));

// =============================================================================
// == 挂载 API 路由 ==
// =============================================================================
// 将 routes/index.ts 中定义的 API 路由挂载到根路径 '/'
// 这些路由现在会受到上面注册的所有全局中间件的影响 (包括速率限制)
app.route('/', apiRoutes);

// =============================================================================
// == 处理 404 Not Found ==
// =============================================================================
// 处理所有未匹配到上述任何路由的请求
app.notFound(async (c) => {
  const requestId = c.get('requestId');
  try {
    const filePath = path.resolve(__dirname, 'views/404.html');
    const fileContent = await readFile(filePath, 'utf-8');
    pinoLogger.info({ path: c.req.path, filePath, requestId }, 'Serving 404.html for unmatched route');
    return c.html(fileContent, 404);
  } catch (error) {
    pinoLogger.error({ path: c.req.path, error: (error as Error).message, requestId }, 'Failed to read 404.html, returning fallback JSON 404');
    return c.json({ code: 404, message: '请求的资源未找到 (Not Found)' }, 404);
  }
});

// =============================================================================
// == 导出 Hono 应用实例 ==
// =============================================================================
export default app;
