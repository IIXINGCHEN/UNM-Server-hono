// src/app.ts

// 导入 Hono 主类
import { Hono } from 'hono';
// 导入 Hono 内置或官方中间件
import { logger as honoLogger } from 'hono/logger'; // 请求日志中间件
import { secureHeaders } from 'hono/secure-headers'; // 安全头部中间件 (类似 Helmet)
import { cors } from 'hono/cors'; // CORS 中间件
import { serveStatic } from '@hono/serve-static'; // 静态文件服务中间件 (@hono/serve-static)
import { trimTrailingSlash } from 'hono/trailing-slash'; // 移除 URL 末尾斜杠的中间件
// import { bodyParse } from 'hono/body-parse'; // Hono v4+ 通常自动处理 JSON/Form Body

// 导入应用配置
import config from './config';
// 导入自定义的 Pino 日志记录器实例
import pinoLogger from './utils/logger';
// 导入主路由器 (包含所有 API 端点)
import apiRoutes from './routes'; // 之前在 routes/index.ts 中定义的 Hono 实例
// 导入自定义的 ApiError 类 (用于错误处理判断)
import { ApiError } from './services/externalApi.service';
// 导入控制器 (如果需要直接访问其方法, 例如 404 处理)
// import { musicControllerInstance } from './controllers/music.controller'; // 如果采用实例导出方式
// 或者按需实例化
import { MusicController } from './controllers/music.controller';
import { MusicMatchService } from './services/musicMatch.service';
import { ExternalApiService } from './services/externalApi.service';
import { ProxyService } from './services/proxy.service';
import { HTTPException } from 'hono/http-exception'; // Hono 内置的 HTTP 异常类

// ---- Hono 应用实例化 ----
// 创建 Hono 应用实例, 指定泛型 <{ Variables: { requestId?: string } }>
// 可以在 Context 中安全地设置和获取 requestId 类型
const app = new Hono<{ Variables: { requestId?: string } }>();

// ---- 实例化服务与控制器 (如果不在路由文件中实例化) ----
// 保持与 routes/index.ts 一致，这里不再重复实例化，直接使用导入的 apiRoutes
const musicMatchService = new MusicMatchService();
const externalApiService = new ExternalApiService();
const proxyService = new ProxyService();
const musicController = new MusicController(musicMatchService, externalApiService, proxyService);


// ---- 全局中间件注册 (按执行顺序) ----

// 1. 移除 URL 末尾的斜杠 (可选, 保持 URL 规范)
app.use('*', trimTrailingSlash());

// 2. 请求 ID 中间件 (自定义)
app.use('*', async (c, next) => {
  // 尝试从请求头获取 ID (例如来自上游代理), 否则生成新的 UUID
  const requestId = c.req.header('x-request-id') || crypto.randomUUID(); // 使用内置 crypto
  // 将 requestId 设置到 Hono 上下文变量中, 供后续中间件和处理器使用
  c.set('requestId', requestId);
  // 在响应头中也设置请求 ID, 便于客户端追踪
  c.header('X-Request-ID', requestId);
  // 继续处理请求
  await next();
});

// 3. 请求日志中间件 (使用 hono/logger)
// 可以自定义日志格式
app.use('*', honoLogger((message: string, ...rest: string[]) => {
  // 使用我们自己的 pinoLogger 实例来记录日志
  // 这里可以解析 message 和 rest 参数以获取更结构化的信息, 但简单起见直接记录
  // 从上下文中获取 requestId
  // 注意：hono/logger 可能在 requestId 设置之前或之后运行，取决于注册顺序
  // Hono v4 的 logger 可以接受一个 logger 函数来自定义
  // 这里我们用 pino 记录，可能需要调整确保 requestId 被捕获
  // 暂时保留 hono/logger 默认行为，它会输出到 console
  // TODO: 更好地将 hono/logger 与 pino 集成, 或者编写完全自定义的 pino 中间件
  pinoLogger.info({ logMessage: message, details: rest /*, requestId: c.get('requestId') - 如何在logFn里拿到c? */ }, 'Hono Request Log');
}));
// 或者使用完全自定义的 Pino 日志中间件 (替代 hono/logger)
/*
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  pinoLogger.info({
    req: { method: c.req.method, url: c.req.url, headers: Object.fromEntries(c.req.headers) }, // 可能需要过滤敏感头
    res: { status: c.res.status },
    responseTime: duration,
    requestId: c.get('requestId'),
  }, 'Request completed');
});
*/


// 4. 全局错误处理 (使用 app.onError)
app.onError((err, c) => {
  // 获取请求 ID
  const requestId = c.get('requestId');
  // 默认错误状态码
  let statusCode = 500;
  // 准备错误响应体
  const errorResponse: { code: number; message: string; stack?: string; details?: any; requestId?: string } = {
    code: statusCode, // 业务码默认为 HTTP 状态码
    message: 'Internal Server Error', // 默认消息
    requestId: requestId,
  };

  // 判断错误类型
  if (err instanceof HTTPException) {
    // 如果是 Hono 内置的 HTTP 异常
    statusCode = err.status; // 使用异常自带的状态码
    errorResponse.message = err.message; // 使用异常自带的消息
  } else if (err instanceof ApiError) {
    // 如果是我们自定义的 API 错误
    statusCode = err.status; // 使用自定义状态码
    errorResponse.message = err.message; // 使用自定义消息
    errorResponse.details = err.details; // 添加自定义详情
  } else if (err instanceof Error) {
    // 其他标准 Error 对象
    errorResponse.message = err.message; // 使用错误消息
  }

  // 设置最终的业务码（可以与HTTP状态码不同，但通常保持一致或有关联）
  errorResponse.code = statusCode;

  // 在开发环境下添加堆栈信息
  if (config.NODE_ENV === 'development' && err instanceof Error && err.stack) {
    errorResponse.stack = err.stack;
  }

  // 使用 Pino 记录详细错误日志
  pinoLogger.error({
    err: {
      message: (err as Error).message,
      stack: (err as Error).stack,
      status: statusCode,
      details: (err as any).details, // 记录可能的详情
      ...(err instanceof Error ? { name: err.name } : {}),
    },
    requestId: requestId,
    url: c.req.url,
    method: c.req.method,
  }, `Error handled: ${statusCode} - ${errorResponse.message}`);

  // 返回 JSON 格式的错误响应, 并设置 HTTP 状态码
  return c.json(errorResponse, statusCode);
});

// 5. 安全头部中间件 (Hono 版 Helmet)
app.use('*', secureHeaders()); // 使用默认配置, 可按需定制

// 6. CORS 中间件
app.use('*', cors({
  // 配置允许的来源, 从我们的配置模块读取
  origin: config.ALLOWED_DOMAINS, // Hono CORS 支持字符串数组
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // 允许的方法
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID'], // 允许的请求头
  credentials: true, // 是否允许携带凭证 (例如 Cookie)
  maxAge: 86400, // OPTIONS 预检请求的缓存时间 (秒)
}));

// 7. 静态文件服务 (服务 src/public 目录下的文件)
// 请求 /public/* 的路径会尝试从 src/public 提供文件
app.use('/public/*', serveStatic({ root: './src' })); // root 相对于项目根目录

// ---- 挂载 API 路由 ----
// 将在 routes/index.ts 中定义的所有路由挂载到 / (根路径) 下
app.route('/', apiRoutes);

// ---- 处理 404 Not Found ----
// Hono v4 推荐使用 app.notFound
app.notFound((c) => {
   // 调用控制器中的 404 处理方法 (如果需要渲染特定页面)
   // return musicController.handleNotFound(c);
   // 或者直接返回 JSON 响应
   logger.info({ path: c.req.path, requestId: c.get('requestId') }, 'Route not found (404)');
   return c.json({ code: 404, message: '请求的资源未找到 (Not Found)' }, 404);
});


// ---- 导出 Hono 应用实例 ----
// 供 Vercel 或 src/server.ts 使用
export default app;
