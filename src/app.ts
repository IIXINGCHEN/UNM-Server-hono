// src/app.ts

// =============================================================================
// == 核心依赖导入 ==
// =============================================================================
// 导入 Hono 主类, 用于创建应用实例
import { Hono } from 'hono';
// 导入 Hono 内置或官方中间件
import { logger as honoLogger } from 'hono/logger'; // 请求日志
import { secureHeaders } from 'hono/secure-headers'; // 安全头部 (类似 Helmet)
import { cors } from 'hono/cors'; // CORS 跨域资源共享
import { serveStatic } from '@hono/serve-static'; // 静态文件服务 (来自 @hono/serve-static 包)
import { trimTrailingSlash } from 'hono/trailing-slash'; // 移除 URL 末尾斜杠
import { HTTPException } from 'hono/http-exception'; // Hono 内置的 HTTP 异常类
// 导入 Node.js 文件系统和路径处理模块 (用于读取 HTML 文件)
import { readFile } from 'fs/promises';
import path from 'path';

// =============================================================================
// == 应用内部模块导入 ==
// =============================================================================
// 导入应用配置 (包含环境变量)
import config from './config';
// 导入自定义的 Pino 日志记录器实例
import pinoLogger from './utils/logger';
// 导入主路由器 (包含所有 API 端点, 由 src/routes/index.ts 定义)
import apiRoutes from './routes';
// 导入自定义的 ApiError 类 (用于更精确的错误处理)
import { ApiError } from './services/externalApi.service';
// 导入控制器 (如果需要直接调用其方法, 例如 404 处理)
import { MusicController } from './controllers/music.controller';
// 导入服务 (用于实例化控制器)
import { MusicMatchService } from './services/musicMatch.service';
import { ExternalApiService } from './services/externalApi.service';
import { ProxyService } from './services/proxy.service';

// =============================================================================
// == Hono 应用实例化 ==
// =============================================================================
// 创建 Hono 应用实例
// <{ Variables: { requestId?: string } }> 定义了 Hono 上下文 (c.var) 中可以安全存取的变量类型
const app = new Hono<{ Variables: { requestId?: string } }>();

// =============================================================================
// == 服务与控制器实例化 (如果不在路由文件中实例化) ==
// =============================================================================
// 为确保 MusicController 能在 app.notFound 中使用, 在此处实例化是合理的
// (或者将 notFound 逻辑移到路由模块中处理)
const musicMatchService = new MusicMatchService();
const externalApiService = new ExternalApiService();
const proxyService = new ProxyService();
const musicController = new MusicController(musicMatchService, externalApiService, proxyService);

// =============================================================================
// == 全局中间件注册 (按执行顺序非常重要!) ==
// =============================================================================

// --- 1. URL 规范化 ---
// 移除所有请求 URL 末尾可能存在的斜杠 (有助于路由匹配一致性)
app.use('*', trimTrailingSlash());

// --- 2. 请求 ID 生成与注入 ---
// 为每个进入的请求生成或获取一个唯一的追踪 ID
app.use('*', async (c, next) => {
  // 尝试从 'x-request-id' 请求头获取 (可能由上游代理设置)
  const requestId = c.req.header('x-request-id') || crypto.randomUUID(); // 否则使用内置 crypto 生成 UUID
  // 将 requestId 设置到 Hono 上下文变量中, 供后续流程使用
  c.set('requestId', requestId);
  // 在响应头中也添加 X-Request-ID, 便于客户端和日志系统关联追踪
  c.header('X-Request-ID', requestId);
  // 调用下一个中间件或路由处理器
  await next();
});

// --- 3. 请求日志 ---
// 使用 Hono 官方 logger (简单易用, 输出到控制台)
// 注意: 其日志格式可能不如 Pino 结构化, 且与 Pino 的集成可能需要自定义实现
app.use('*', honoLogger((message: string, ...rest: string[]) => {
  // 尝试获取上下文中的 requestId (可能因中间件顺序而取不到, hono/logger 本身不直接访问 Hono context var)
  // TODO: 改进此处, 使 hono/logger 能利用 requestId 或完全替换为自定义 Pino 中间件
  pinoLogger.info({ logMessage: message, details: rest }, 'Hono Request Log');
}));
/*
// 备选方案: 完全自定义的 Pino 请求日志中间件 (提供更结构化的日志)
app.use('*', async (c, next) => {
  const start = Date.now(); // 记录请求开始时间
  await next(); // 执行后续中间件和路由处理
  const duration = Date.now() - start; // 计算请求处理耗时
  // 使用 Pino 记录结构化日志
  pinoLogger.info({
    req: { // 请求相关信息
      method: c.req.method, // HTTP 方法
      url: c.req.url, // 请求 URL
      // headers: Object.fromEntries(c.req.headers) // 请求头 (注意过滤敏感信息!)
    },
    res: { // 响应相关信息
      status: c.res.status // HTTP 状态码
    },
    responseTime: duration, // 响应时间 (毫秒)
    requestId: c.get('requestId'), // 从上下文中获取请求 ID
  }, 'Request completed'); // 日志消息
});
*/

// --- 4. 全局错误处理 ---
// 使用 app.onError 捕获所有路由和中间件中未被捕获的错误
app.onError((err, c) => {
  // 从上下文中获取请求 ID
  const requestId = c.get('requestId');
  // 初始化默认错误状态码和响应体
  let statusCode = 500; // 默认 500 Internal Server Error
  const errorResponse: { code: number; message: string; stack?: string; details?: any; requestId?: string } = {
    code: statusCode, // 业务状态码, 初始同 HTTP 状态码
    message: '服务器内部错误 (Internal Server Error)', // 默认错误消息
    requestId: requestId, // 带上请求 ID
  };

  // --- 错误类型判断与处理 ---
  if (err instanceof HTTPException) {
    // 如果是 Hono 内置的 HTTP 异常 (通常由 c.req.parseBody 等或手动抛出)
    statusCode = err.status; // 使用异常本身的状态码
    errorResponse.message = err.message; // 使用异常本身的消息
  } else if (err instanceof ApiError) {
    // 如果是我们自定义的 ApiError (通常由服务层抛出)
    statusCode = err.status; // 使用自定义的状态码
    errorResponse.message = err.message; // 使用自定义的消息
    errorResponse.details = err.details; // 包含自定义的错误详情
  } else if (err instanceof Error) {
    // 如果是标准的 JavaScript Error 对象
    errorResponse.message = err.message; // 使用其 message 属性
  }
  // 其他未知类型的错误，保持默认的 500 和消息

  // 设置最终的业务码 (通常与 HTTP 状态码一致)
  errorResponse.code = statusCode;

  // --- 开发环境附加信息 ---
  // 如果是开发环境，并且错误对象有堆栈信息，则附加到响应体中
  if (config.NODE_ENV === 'development' && err instanceof Error && err.stack) {
    errorResponse.stack = err.stack;
  }

  // --- 记录详细错误日志 ---
  // 使用 Pino 记录结构化的错误信息
  pinoLogger.error({
    err: { // 错误详情
      message: (err as Error).message || 'Unknown error object', // 错误消息
      stack: (err as Error).stack, // 堆栈跟踪
      status: statusCode, // 最终确定的状态码
      details: (err as any).details, // 自定义详情 (如果有)
      ...(err instanceof Error ? { name: err.name } : {}), // 错误名称 (如果是 Error)
    },
    requestId: requestId, // 请求 ID
    url: c.req.url, // 请求 URL
    method: c.req.method, // 请求方法
  }, `Error handled: ${statusCode} - ${errorResponse.message}`); // 日志消息

  // --- 返回 JSON 错误响应 ---
  // 使用 c.json() 返回响应体, 并设置相应的 HTTP 状态码
  return c.json(errorResponse, statusCode);
});

// --- 5. 安全头部 ---
// 应用 Hono 的 secureHeaders 中间件, 添加常见的安全相关 HTTP 响应头
// 例如: X-Frame-Options, X-Content-Type-Options, Referrer-Policy 等
app.use('*', secureHeaders()); // 使用默认配置即可满足大部分需求

// --- 6. CORS (跨域资源共享) ---
// 应用 Hono 的 cors 中间件
app.use('*', cors({
  // origin: 允许访问的来源域列表, 从配置中读取
  // 可以是字符串数组, 也可以是函数进行动态判断
  origin: config.ALLOWED_DOMAINS, // ['http://localhost:3000', 'https://yourdomain.com']
  // allowMethods: 允许的 HTTP 方法列表
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // allowHeaders: 允许的自定义请求头列表
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID'],
  // credentials: 是否允许跨域请求携带凭证 (例如 Cookie)
  credentials: true,
  // maxAge: OPTIONS 预检请求的结果可以被缓存的时间 (秒)
  maxAge: 86400, // 24 hours
}));

// --- 7. 静态文件服务 ---
// 配置 @hono/serve-static 中间件来服务 /public 目录下的静态文件
// root: 指定静态文件的根目录 (相对于项目根目录)
// 注意: 路径是相对于项目运行时的根目录
// 例如, 请求 /public/styles.css 会尝试提供 src/public/styles.css 文件
app.use('/public/*', serveStatic({ root: './src' }));


// =============================================================================
// == 挂载 API 路由 ==
// =============================================================================
// 将在 src/routes/index.ts 中定义的所有 API 路由挂载到根路径 '/' 下
app.route('/', apiRoutes);


// =============================================================================
// == 处理 404 Not Found ==
// =============================================================================
// 使用 Hono 的 app.notFound() 方法来处理所有未匹配到任何路由的请求
app.notFound(async (c) => {
  // 获取请求 ID
  const requestId = c.get('requestId');
  try {
    // 构建 404 HTML 页面的文件路径
    const filePath = path.resolve(__dirname, 'views/404.html'); // 相对于 src/app.ts 编译后的位置 (dist/)
    // 异步读取文件内容
    const fileContent = await readFile(filePath, 'utf-8');
    // 记录日志
    pinoLogger.info({ path: c.req.path, filePath, requestId }, 'Serving 404.html for unmatched route');
    // 返回 404 状态码和 HTML 内容
    return c.html(fileContent, 404);
  } catch (error) {
    // 如果读取 404.html 文件也失败了 (例如文件丢失)
    pinoLogger.error({ path: c.req.path, error: (error as Error).message, requestId }, 'Failed to read 404.html, returning fallback JSON 404');
    // 返回一个标准的 JSON 404 错误作为最终的后备方案
    return c.json({ code: 404, message: '请求的资源未找到 (Not Found)' }, 404);
  }
});


// =============================================================================
// == 导出 Hono 应用实例 ==
// =============================================================================
// 导出配置好的 Hono 应用实例
// 这是 Vercel 等 Serverless 平台需要的入口点
// 也是 src/server.ts (用于 Node.js 启动) 需要导入的实例
export default app;
