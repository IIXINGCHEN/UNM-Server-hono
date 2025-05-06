// src/routes/index.ts

// 导入 Hono 应用类型 (用于创建子路由/应用实例)
import { Hono } from 'hono';
// 导入控制器类 (用于访问静态校验器和实例化控制器)
import { MusicController } from '../controllers/music.controller';
// 导入服务实例 (用于注入控制器)
import { MusicMatchService } from '../services/musicMatch.service';
import { ExternalApiService } from '../services/externalApi.service';
import { ProxyService } from '../services/proxy.service';

// 创建一个新的 Hono 实例作为主路由器
const app = new Hono();

// ---- 实例化服务和控制器 ----
// 在这里进行实例化和依赖注入 (简单方式)
const musicMatchService = new MusicMatchService();
const externalApiService = new ExternalApiService();
const proxyService = new ProxyService();
const musicController = new MusicController(
  musicMatchService,
  externalApiService,
  proxyService
);

// ---- 定义 API 路由 ----

// 定义 GET / 路由, 处理首页请求
app.get('/', musicController.renderIndexPage.bind(musicController));

// 定义 GET /info 路由, 处理应用信息请求
app.get('/info', musicController.getInfo.bind(musicController));

// 定义 GET /test 路由, 处理测试匹配请求
app.get('/test', musicController.testMatch.bind(musicController));

// 定义 GET /match 路由, 先应用查询参数校验中间件, 然后处理匹配请求
app.get(
  '/match',
  // 应用 Zod 校验器中间件 (引用控制器中定义的静态校验器)
  MusicController.validateMatchQuery,
  // 校验通过后, 执行控制器中的处理方法
  musicController.matchMusic.bind(musicController)
);

// 定义 GET /ncmget 路由, 先校验参数, 再处理获取 NCM 链接请求
app.get(
  '/ncmget',
  // 应用 Zod 校验器
  MusicController.validateNcmGetQuery,
  // 执行控制器处理方法
  musicController.getNcmTrack.bind(musicController)
);

// 定义 GET /otherget 路由, 先校验参数, 再处理搜索和获取链接请求
app.get(
  '/otherget',
  // 应用 Zod 校验器
  MusicController.validateOtherGetQuery,
  // 执行控制器处理方法
  musicController.getOtherTrack.bind(musicController)
);

// 添加 GET /health 健康检查路由 (这是一个好的实践)
app.get('/health', (c) => {
  // 返回简单的健康状态和时间戳
  return c.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// ---- 导出主路由器 ----
// 将配置好的 Hono 实例导出, 供 src/app.ts 挂载
export default app; // Hono 实例本身就可以被视为一个路由器
