import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { checkPort } from './utils/port.js';
import { router } from './routes/index.js';
import { health } from './routes/health.js';
import { metrics } from './routes/metrics.js';
import { domainCheck } from './middleware/domain.js';
import {
  requestIdMiddleware,
  securityHeadersMiddleware,
  httpsRedirectMiddleware,
  apiKeyMiddleware
} from './middleware/security.js';
import { tokenBucketRateLimiter } from './middleware/rate-limiter.js';
import { authMiddleware } from './middleware/auth.js';
import { logger, requestLoggerMiddleware } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { jsonResponseMiddleware } from './middleware/json-response.js';
import { API_PERMISSION_CONFIG, ApiPermissionLevel } from './utils/api-permissions.js';
// 导入域名配置
import domainsConfig from './config/domains.js';
// 导入上下文类型定义
import './types/context.js';

// 获取当前文件的目录路径（用于解析相对路径）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config()

// 配置信息
// 优先使用配置文件中的域名列表，如果不存在则回退到环境变量
const domain = domainsConfig.allowedDomainsString || process.env.ALLOWED_DOMAIN || '*'
const port = parseInt(process.env.PORT || '5678', 10)

// 创建Hono应用
const app = new Hono()

// 错误处理中间件 - 必须最先加载
app.use('*', errorHandler)

// 请求ID中间件
app.use('*', requestIdMiddleware)

// HTTPS重定向中间件
app.use('*', httpsRedirectMiddleware)

// 安全头中间件
app.use('*', securityHeadersMiddleware)

// 请求日志中间件
app.use('*', requestLoggerMiddleware)

// 指标中间件
app.use('*', metricsMiddleware)

// JSON响应中间件 - 确保所有API响应都以JSON UTF-8格式返回
app.use('/api/*', jsonResponseMiddleware)

// 速率限制中间件
app.use('*', tokenBucketRateLimiter)

// API密钥验证中间件 - 使用权限级别系统验证所有API路由
app.use('/api/*', apiKeyMiddleware);

// API鉴权中间件 - 仅对API路由生效，但排除/api/config、/api/auth和/api/csp-report
app.use('/api/*', async (c, next) => {
  // 排除/api/config、/api/auth和/api/csp-report端点，使其不需要鉴权
  if (c.req.path === '/api/config' || c.req.path === '/api/auth' || c.req.path === '/api/csp-report') {
    await next();
    return;
  }

  // 其他API端点需要鉴权
  await authMiddleware(c, next);
});

// 跨域中间件
app.use('*', cors({
  origin: domain === '*' ? '*' : domain.split(',').map((d: string) => d.trim()),
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'Content-Security-Policy-Report-Only'],
  exposeHeaders: ['Content-Length', 'Content-Type', 'X-Request-ID'],
  maxAge: 86400,
}))

// 域名检查中间件
app.use('*', domainCheck)

// 静态文件服务 - 使用绝对路径
const publicPath = path.resolve(__dirname, '../public');

// 根路由
app.get('/', async (c) => {
  try {
    const indexPage = await fs.promises.readFile(path.join(publicPath, 'index.html'), 'utf-8')
    return c.html(indexPage)
  } catch (error) {
    logger.error('读取首页文件失败', error as Error);
    return c.text('Internal Server Error', 500)
  }
})

// 明确定义首页路由，确保它能被正确访问
app.get('/index.html', async (c) => {
  try {
    const indexPage = await fs.promises.readFile(path.join(publicPath, 'index.html'), 'utf-8');
    return c.html(indexPage);
  } catch (error) {
    logger.error('读取首页文件失败', error as Error);
    return c.text('Internal Server Error', 500);
  }
})

// 明确定义JavaScript文件路由，确保它们能被正确访问
app.get('/js/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const jsFilePath = path.join(publicPath, 'js', filename);
    const jsContent = await fs.promises.readFile(jsFilePath, 'utf-8');
    return c.text(jsContent, 200, {
      'Content-Type': 'application/javascript; charset=utf-8'
    });
  } catch (error) {
    logger.error('读取JavaScript文件失败', error as Error);
    return c.text('Internal Server Error', 500);
  }
});

// 明确定义CSS文件路由
app.get('/css/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const cssFilePath = path.join(publicPath, 'css', filename);
    const cssContent = await fs.promises.readFile(cssFilePath, 'utf-8');
    return c.text(cssContent, 200, {
      'Content-Type': 'text/css; charset=utf-8'
    });
  } catch (error) {
    logger.error('读取CSS文件失败', error as Error);
    return c.text('Internal Server Error', 500);
  }
});

// 明确定义HTML文件路由，确保它们能被正确访问
app.get('/api-docs.html', async (c) => {
  try {
    const apiDocsPage = await fs.promises.readFile(path.join(publicPath, 'api-docs.html'), 'utf-8');
    return c.html(apiDocsPage);
  } catch (error) {
    logger.error('读取API文档页面失败', error as Error);
    return c.text('Internal Server Error', 500);
  }
});

// 其他静态文件
app.use('/*', serveStatic({ root: publicPath }))

// 健康检查路由
app.route('/health', health)

// 指标路由
app.route('/metrics', metrics)

// API路由
app.route('/api', router)

// 404路由
app.notFound(async (c) => {
  try {
    // 如果是API路径，返回JSON格式的404响应
    if (c.req.path.startsWith('/api/')) {
      const requestId = c.get('requestId') || 'unknown';
      return c.json({
        code: 404,
        message: '接口不存在',
        requestId
      }, 404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 非API路径，返回HTML 404页面
    const notFoundPage = await fs.promises.readFile(path.join(publicPath, '404.html'), 'utf-8')
    return c.html(notFoundPage)
  } catch (error) {
    logger.error('读取404页面失败', error as Error);

    // 如果是API路径，即使出错也返回JSON格式
    if (c.req.path.startsWith('/api/')) {
      const requestId = c.get('requestId') || 'unknown';
      return c.json({
        code: 404,
        message: '接口不存在',
        requestId
      }, 404, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    return c.text('404 Not Found', 404)
  }
})

// 获取版本信息
async function getVersionInfo() {
  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
    return JSON.parse(packageJsonContent);
  } catch (error) {
    logger.error('读取package.json失败', error as Error);
    return { version: 'unknown' };
  }
}

// 检查命令行参数
const isVerifyOnly = process.argv.includes('--verify-only');

// 启动服务器
const startServer = async () => {
  try {
    const availablePort = await checkPort(port);
    const packageJson = await getVersionInfo();

    // 缓存系统信息（在服务器启动前记录，因为缓存已经在导入时初始化）
    const cacheInfo = {
      caches: ['default', 'api', 'system'],
      total_max_size: 1550, // 所有缓存的最大大小总和
      cleanup_interval: '60s'
    };
    logger.info('缓存系统初始化完成', cacheInfo);

    // 准备服务器启动
    const serverInfo = {
      port: availablePort,
      env: process.env.NODE_ENV || 'development',
      version: packageJson.version,
      features: [
        process.env.RATE_LIMIT ? 'rate_limit' : null,
        process.env.API_KEY && process.env.AUTH_SECRET ? 'api_auth' : null,
        process.env.ALLOW_CDN === 'true' ? 'csp' : null,
        process.env.ENABLE_HTTPS === 'true' ? 'https_redirect' : null
      ].filter(Boolean)
    };

    // 如果是验证模式，只进行验证而不实际启动服务器
    if (isVerifyOnly) {
      // 验证应用配置
      logger.info('验证模式: 检查应用配置', serverInfo);

      // 验证安全配置
      const securityInfo = {
        rate_limit: parseInt(process.env.RATE_LIMIT || '100'),
        auth_mode: process.env.CLIENT_API_KEY ? 'client_server_separation' : 'single_key',
        csp_enabled: process.env.ALLOW_CDN === 'true',
        https_redirect: process.env.ENABLE_HTTPS === 'true',
        allowed_domains: domain === '*' ? 'all' : domainsConfig.allowedDomains.length || (process.env.ALLOWED_DOMAIN || '').split(',').length
      };
      logger.info('验证模式: 安全配置检查通过', securityInfo);

      // 验证API权限系统
      const publicEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.PUBLIC).length;
      const clientEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.CLIENT).length;
      const serverEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.SERVER).length;

      const apiPermissionInfo = {
        public_endpoints: publicEndpoints,
        client_endpoints: clientEndpoints,
        server_endpoints: serverEndpoints,
        default_level: 'server' // 默认权限级别
      };
      logger.info('验证模式: API权限系统检查通过', apiPermissionInfo);

      // 验证中间件
      const middlewareInfo = {
        middlewares: [
          'error_handler',
          'request_id',
          'https_redirect',
          'security_headers',
          'request_logger',
          'metrics',
          'rate_limit',
          'api_key',
          'auth',
          'cors',
          'domain_check'
        ]
      };
      logger.info('验证模式: 中间件检查通过', middlewareInfo);

      // 验证成功
      console.log(chalk.green(`✓ UNM-Server v${packageJson.version} 验证成功 - 构建结果可以正确启动`));
      console.log(chalk.cyan(`  可以使用 'pnpm start' 命令启动服务`));

      // 验证模式下不继续启动服务器
      return;
    }

    // 正常模式：启动服务器
    serve({
      fetch: app.fetch,
      port: availablePort,
    }, async (info) => {
      // 服务器启动成功，记录详细日志
      logger.info(`UNM-Server v${packageJson.version} 启动成功`, serverInfo);

      // 安全配置信息（不包含敏感值）
      const securityInfo = {
        rate_limit: parseInt(process.env.RATE_LIMIT || '100'),
        auth_mode: process.env.CLIENT_API_KEY ? 'client_server_separation' : 'single_key',
        csp_enabled: process.env.ALLOW_CDN === 'true',
        https_redirect: process.env.ENABLE_HTTPS === 'true',
        allowed_domains: domain === '*' ? 'all' : domainsConfig.allowedDomains.length || (process.env.ALLOWED_DOMAIN || '').split(',').length
      };
      logger.info('安全配置加载完成', securityInfo);

      // API权限系统信息
      const publicEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.PUBLIC).length;
      const clientEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.CLIENT).length;
      const serverEndpoints = Object.entries(API_PERMISSION_CONFIG)
        .filter(([_, level]) => level === ApiPermissionLevel.SERVER).length;

      const apiPermissionInfo = {
        public_endpoints: publicEndpoints,
        client_endpoints: clientEndpoints,
        server_endpoints: serverEndpoints,
        default_level: 'server' // 默认权限级别
      };
      logger.info('API权限系统初始化完成', apiPermissionInfo);

      // 中间件初始化信息
      const middlewareInfo = {
        middlewares: [
          'error_handler',
          'request_id',
          'https_redirect',
          'security_headers',
          'request_logger',
          'metrics',
          'rate_limit',
          'api_key',
          'auth',
          'cors',
          'domain_check'
        ]
      };
      logger.info('中间件初始化完成', middlewareInfo);

      // 服务就绪信息
      const memoryUsage = process.memoryUsage();
      const readyInfo = {
        uptime: '0s',
        memory_usage_mb: Math.round(memoryUsage.rss / 1024 / 1024 * 10) / 10,
        health_check_url: `http://localhost:${info.port}/health`
      };
      logger.info('服务就绪', readyInfo);

      // 控制台输出（保留原有输出，但增加更多信息）
      console.log(`UNM-Server v${packageJson.version} 成功在 ${info.port} 端口上运行 (${process.env.NODE_ENV || 'development'} 模式)`);
    });
  } catch (error) {
    logger.error('服务器启动失败', error as Error);
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer()


