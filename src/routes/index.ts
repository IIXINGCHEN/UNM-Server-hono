// src/routes/index.ts

// =============================================================================
// == 核心依赖导入 ==
// =============================================================================
// 导入 Hono 主类 (主要用于类型或创建子路由实例, 如果需要)
import { Hono } from 'hono';
// 导入 Node.js 文件系统和路径处理 API (用于读取 index.html)
import { readFile } from 'fs/promises';
import path from 'path';
// 导入 Hono 内置异常类 (用于文件读取失败时抛出)
import { HTTPException } from 'hono/http-exception';

// =============================================================================
// == 应用内部模块导入 ==
// =============================================================================
// 导入控制器类 (用于访问其静态校验器和方法)
import { MusicController } from '../controllers/music.controller';
// 导入服务类 (用于实例化控制器)
import { MusicMatchService } from '../services/musicMatch.service';
import { ExternalApiService } from '../services/externalApi.service';
import { ProxyService } from '../services/proxy.service';
// 导入日志记录器
import pinoLogger from '../utils/logger'; // 确保路径正确

// =============================================================================
// == Hono 路由实例创建 ==
// =============================================================================
// 创建一个新的 Hono 实例, 作为本模块管理的路由集合
// 这个实例将被导出并挂载到主应用 (src/app.ts)
const app = new Hono();

// =============================================================================
// == 服务与控制器实例化 ==
// =============================================================================
// 在此模块内实例化所有需要的服务和控制器
// 这是依赖注入的一种简单形式 (在路由模块级别进行)
const musicMatchService = new MusicMatchService();
const externalApiService = new ExternalApiService();
const proxyService = new ProxyService();
const musicController = new MusicController(
  musicMatchService,
  externalApiService,
  proxyService
);

// =============================================================================
// == API 路由定义 ==
// =============================================================================

// --- 根路径 / ---
// 定义 GET / 路由, 用于提供首页 HTML
app.get('/', async (c) => {
  // 获取请求 ID (从上下文变量)
  const requestId = c.get('requestId');
  try {
    // 构建 index.html 文件的绝对路径
    // __dirname 指向当前文件 (routes/index.ts) 编译后的位置 (dist/routes/)
    // 因此需要回退两级到项目根目录下的 src/views
    const filePath = path.resolve(__dirname, '../../src/views/index.html');
    // 异步读取文件内容, 指定编码为 utf-8
    const fileContent = await readFile(filePath, 'utf-8');
    // 记录提供服务的日志
    pinoLogger.info({ path: c.req.path, filePath, requestId }, 'Serving index.html');
    // 使用 c.html() 方法返回 HTML 内容
    // Hono 会自动设置 Content-Type 为 text/html
    return c.html(fileContent);
  } catch (error) {
    // 如果读取文件过程中发生错误 (例如文件不存在)
    // 记录错误日志
    pinoLogger.error({ path: c.req.path, error: (error as Error).message, requestId }, 'Failed to read index.html');
    // 抛出 HTTP 500 异常, 让全局错误处理器处理
    // 这样可以返回统一的 JSON 错误格式
    throw new HTTPException(500, { message: '无法加载首页 (Could not load index page)' });
  }
});

// --- /info 端点 ---
// 定义 GET /info 路由, 不需要校验器, 直接绑定控制器方法
// .bind(musicController) 确保方法内的 this 指向正确的控制器实例
app.get('/info', musicController.getInfo.bind(musicController));

// --- /test 端点 ---
// 定义 GET /test 路由, 用于测试匹配功能
app.get('/test', musicController.testMatch.bind(musicController));

// --- /match 端点 ---
// 定义 GET /match 路由
// 1. 使用 MusicController 中定义的静态 Zod 校验器中间件 validateMatchQuery
// 2. 如果校验通过, 则执行 musicController 的 matchMusic 方法
app.get(
  '/match',
  MusicController.validateMatchQuery, // 应用校验器
  musicController.matchMusic.bind(musicController) // 绑定处理方法
);

// --- /ncmget 端点 ---
// 定义 GET /ncmget 路由
// 1. 应用 validateNcmGetQuery 校验器
// 2. 执行 getNcmTrack 方法
app.get(
  '/ncmget',
  MusicController.validateNcmGetQuery, // 应用校验器
  musicController.getNcmTrack.bind(musicController) // 绑定处理方法
);

// --- /otherget 端点 ---
// 定义 GET /otherget 路由
// 1. 应用 validateOtherGetQuery 校验器
// 2. 执行 getOtherTrack 方法
app.get(
  '/otherget',
  MusicController.validateOtherGetQuery, // 应用校验器
  musicController.getOtherTrack.bind(musicController) // 绑定处理方法
);

// --- /health 端点 ---
// 定义 GET /health 路由, 提供简单的健康检查
app.get('/health', (c) => {
  // 直接返回包含状态和时间戳的 JSON 响应
  return c.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// =============================================================================
// == 导出路由实例 ==
// =============================================================================
// 将配置好所有路由的 Hono 实例导出
// 供主应用文件 (src/app.ts) 导入并使用 app.route('/', ...) 挂载
export default app;
