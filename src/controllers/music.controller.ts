// src/controllers/music.controller.ts

// 导入 Hono 的 Context 类型, 用于类型注解
import { Context } from 'hono';
// 导入 Zod 用于定义校验 Schema
import { z } from 'zod';
// 导入 Hono 的 Zod 校验中间件工厂函数
import { zValidator } from '@hono/zod-validator';

// 导入服务层类
import { MusicMatchService, MatchServiceResult } from '../services/musicMatch.service';
import { ExternalApiService, NcmMusicUrlResult, OtherMusicUrlResult, ApiError } from '../services/externalApi.service';
import { ProxyService } from '../services/proxy.service';
// 导入常量
import { APP_VERSION, DEFAULT_MATCH_SOURCES, VALID_NCM_BITRATES } from '../constants';
// 导入日志记录器
import logger from '../utils/logger';
// 导入应用配置
import config from '../config';

// 安全地导入 package.json 版本信息
let appVersion = APP_VERSION; // 使用常量作为备用
try {
  // Hono/ESM 环境下, 可以直接 import JSON
  const packageJson = await import('../../package.json', { assert: { type: 'json' } });
  appVersion = packageJson.default.version || appVersion;
} catch (error) {
  // 如果导入失败, 记录警告日志
  logger.warn('Could not read version from package.json during controller initialization.');
}

// --- Zod 校验 Schema 定义 ---

// /match 接口的查询参数校验 Schema
const matchQuerySchema = z.object({
  // 'id' 参数: 必须是字符串且不能为空
  id: z.string({ required_error: 'Query parameter "id" is required' })
         .min(1, { message: 'Query parameter "id" cannot be empty' }),
  // 'server' 参数: 可选字符串, 允许为空
  server: z.string().optional(),
});

// /ncmget 接口的查询参数校验 Schema
const ncmGetQuerySchema = z.object({
  // 'id' 参数: 必须是字符串且不能为空
  id: z.string({ required_error: 'Query parameter "id" is required' })
         .min(1, { message: 'Query parameter "id" cannot be empty' }),
  // 'br' 参数: 可选字符串, 必须是预定义的比特率之一, 默认为 '320'
  br: z.enum(VALID_NCM_BITRATES as [string, ...string[]]) // z.enum 需要一个非空元组
        .default('320')
        .optional(), // 标记为可选，因为有默认值
});

// /otherget 接口的查询参数校验 Schema
const otherGetQuerySchema = z.object({
  // 'name' 参数: 必须是字符串且不能为空
  name: z.string({ required_error: 'Query parameter "name" is required' })
          .min(1, { message: 'Query parameter "name" cannot be empty' }),
});


// --- 控制器类定义 ---

export class MusicController {
  // 服务实例变量 (通过构造函数注入)
  private musicMatchService: MusicMatchService;
  private externalApiService: ExternalApiService;
  private proxyService: ProxyService;

  /**
   * 构造函数: 注入服务依赖
   * @param musicMatchService - 音乐匹配服务实例
   * @param externalApiService - 外部 API 服务实例
   * @param proxyService - 代理服务实例
   */
  constructor(
    musicMatchService: MusicMatchService,
    externalApiService: ExternalApiService,
    proxyService: ProxyService
  ) {
    this.musicMatchService = musicMatchService;
    this.externalApiService = externalApiService;
    this.proxyService = proxyService;
  }

  // --- 路由处理方法 ---

  /**
   * 处理 GET / 请求 (渲染首页)
   * @param c - Hono 上下文对象
   * @returns Promise<Response> - Hono 期望返回 Response 对象或可序列化数据
   */
  public async renderIndexPage(c: Context): Promise<Response> {
     // 注意: Hono 没有内置的类似 koa-views 的 render 方法。
     // 我们需要实现一种方式来返回 HTML 文件内容。
     // 简单方式: 读取文件并返回 HTML 响应。
     // 更复杂方式: 集成模板引擎。
     // 这里暂时返回一个简单的文本响应，表示功能待实现或调整。
     // 后续在 app.ts 中配置静态文件服务或自定义中间件来处理 HTML 返回。
     logger.info({ path: c.req.path, requestId: c.get('requestId') }, 'Serving index page (placeholder)');
     return c.html('<h1>首页</h1><p>功能待通过静态文件服务或模板引擎实现。</p>'); // 返回 HTML 响应
  }

   /**
    * 处理 GET /info 请求 (返回应用信息)
    * @param c - Hono 上下文对象
    * @returns Response - 包含应用信息的 JSON 响应
    */
  public async getInfo(c: Context): Promise<Response> {
    // 获取请求 ID (假设已由日志中间件设置)
    const requestId = c.get('requestId');
    // 记录日志
    logger.info({ path: c.req.path, requestId }, 'Serving /info');
    // 返回 JSON 响应
    return c.json({
      code: 200, // 状态码 (业务码)
      version: appVersion, // 应用版本
      enable_flac: config.ENABLE_FLAC, // FLAC 配置状态
    });
  }

  /**
   * 处理 GET /test 请求 (测试匹配服务)
   * @param c - Hono 上下文对象
   * @returns Promise<Response> - 包含测试结果的 JSON 响应
   */
  public async testMatch(c: Context): Promise<Response> {
    // 获取请求 ID
    const requestId = c.get('requestId');
    // 定义测试用的硬编码 ID 和音源
    const testId = 1962165898;
    const testSources = DEFAULT_MATCH_SOURCES; // 使用常量

    // 记录日志
    logger.info({ testId, testSources, path: c.req.path, requestId }, 'Executing /test route');
    // 调用音乐匹配服务
    const result: MatchServiceResult = await this.musicMatchService.matchTrack(testId, testSources, requestId);

    // 检查匹配结果
    if (result.status && result.data) {
      // 如果成功, 返回 200 和数据
      return c.json({
        code: 200,
        message: '获取成功 (Test)',
        data: result.data,
      });
    } else {
      // 如果失败, 返回 500 错误和失败信息
      // 注意: Hono 中设置状态码通常在返回响应时链式调用 .status() 或由 c.json() 推断,
      // 但这里我们返回包含业务码的 JSON, HTTP 状态码让全局错误处理器或默认设置处理 (通常为 200)。
      // 如果希望明确设置 HTTP 500, 应抛出错误或使用 c.res.status = 500。
      // 为保持与原 Koa 代码行为一致 (返回 JSON 但 HTTP 状态码可能需要调整), 这里仅返回错误 JSON。
      // 更好的做法是抛出一个错误让全局处理器处理。
      // throw new ApiError(`测试匹配失败: ${result.message || 'Unknown error'}`, 500);
       return c.json({
         code: 500, // 业务错误码
         message: `测试匹配失败: ${result.message || 'Unknown error'}`,
       }, 500); // 直接在 c.json 设置 HTTP 状态码
    }
  }

  /**
   * 处理 GET /match 请求 (匹配音乐) - 使用 Zod 校验中间件
   * 校验器实例 (导出供路由使用)
   */
  public static validateMatchQuery = zValidator('query', matchQuerySchema, (result, c) => {
      // 自定义校验失败时的处理
      if (!result.success) {
          logger.warn({ path: c.req.path, errors: result.error.issues, requestId: c.get('requestId') }, 'Validation failed for /match');
          // 返回 400 Bad Request 响应
          return c.json({
              code: 400,
              message: '参数不完整或无效',
              errors: result.error.issues, // 提供详细错误信息
          }, 400);
      }
  });

  /**
   * 处理 GET /match 请求的业务逻辑
   * @param c - Hono 上下文对象
   * @returns Promise<Response> - 包含匹配结果或错误的 JSON 响应
   */
  public async matchMusic(c: Context): Promise<Response> {
    // 获取请求 ID
    const requestId = c.get('requestId');
    // 获取已通过 zValidator 校验的查询参数
    // result.data 包含了校验成功并转换/添加默认值后的数据
    const validatedQuery = c.req.valid('query'); // 类型安全

    // 从校验结果中提取 id 和 server 参数
    const id = validatedQuery.id;
    // 解析 server 参数为音源数组, 如果未提供则使用默认值
    const sources = validatedQuery.server
      ? validatedQuery.server.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : DEFAULT_MATCH_SOURCES;

    // 记录日志
    logger.info({ id, sources, path: c.req.path, requestId }, 'Executing /match route');

    // 调用音乐匹配服务
    const result: MatchServiceResult = await this.musicMatchService.matchTrack(id, sources, requestId);

    // 处理匹配结果
    if (result.status && result.data) {
        // 尝试构建代理 URL
        const proxyUrl = this.proxyService.buildProxyUrl(result.data.url);
        // 准备响应数据, 如果有代理 URL 则包含它
        const responseData = {
            ...result.data,
            ...(proxyUrl && { proxyUrl: proxyUrl }) // 仅在 proxyUrl 存在时添加
        };
        // 返回成功的 JSON 响应
        return c.json({
            code: 200,
            message: '匹配成功',
            data: responseData,
        });
    } else {
        // 如果匹配失败, 返回 500 错误 JSON
        // throw new ApiError(`匹配失败: ${result.message || 'Unknown error'}`, 500);
         return c.json({
            code: 500,
            message: `匹配失败: ${result.message || 'Unknown error'}`,
         }, 500);
    }
  }

  /**
   * 处理 GET /ncmget 请求 (获取 NCM 链接) - 使用 Zod 校验中间件
   * 校验器实例
   */
   public static validateNcmGetQuery = zValidator('query', ncmGetQuerySchema, (result, c) => {
      if (!result.success) {
          logger.warn({ path: c.req.path, errors: result.error.issues, requestId: c.get('requestId') }, 'Validation failed for /ncmget');
          return c.json({
              code: 400,
              message: '参数不完整或无效 (id or br)',
              errors: result.error.issues,
          }, 400);
      }
  });

  /**
   * 处理 GET /ncmget 请求的业务逻辑
   * @param c - Hono 上下文对象
   * @returns Promise<Response> - 包含 NCM 链接或错误的 JSON 响应
   */
  public async getNcmTrack(c: Context): Promise<Response> {
    // 获取请求 ID
    const requestId = c.get('requestId');
    // 获取已校验的查询参数
    const validatedQuery = c.req.valid('query');
    // 提取 id 和 br (br 已有默认值 '320')
    const { id, br } = validatedQuery;

    // 记录日志
    logger.info({ id, br, path: c.req.path, requestId }, 'Executing /ncmget route');

    try {
        // 调用外部 API 服务获取 NCM 链接
        const result: NcmMusicUrlResult = await this.externalApiService.getNcmMusicUrl(id, br ?? '320', requestId); // Use validated br

        // 尝试构建代理 URL
        const proxyUrl = this.proxyService.buildProxyUrl(result.url);
        // 准备响应数据
        const responseData = {
            id,
            br: br ?? '320', // 返回实际使用的 br (包括默认值)
            url: result.url,
            ...(proxyUrl && { proxyUrl: proxyUrl })
        };

        // 返回成功的 JSON 响应
        return c.json({
            code: 200,
            message: '请求成功',
            data: responseData,
        });
    } catch (error) {
       // 如果 externalApiService 抛出 ApiError 或其他错误
       // 让 Hono 的全局错误处理器 (app.onError) 来处理
       throw error; // 重新抛出错误
    }
  }

  /**
   * 处理 GET /otherget 请求 (搜索并获取其他来源链接) - 使用 Zod 校验中间件
   * 校验器实例
   */
  public static validateOtherGetQuery = zValidator('query', otherGetQuerySchema, (result, c) => {
      if (!result.success) {
          logger.warn({ path: c.req.path, errors: result.error.issues, requestId: c.get('requestId') }, 'Validation failed for /otherget');
          return c.json({
              code: 400,
              message: '参数不完整或无效 (name)',
              errors: result.error.issues,
          }, 400);
      }
  });

  /**
   * 处理 GET /otherget 请求的业务逻辑
   * @param c - Hono 上下文对象
   * @returns Promise<Response> - 包含音乐链接或错误的 JSON 响应
   */
  public async getOtherTrack(c: Context): Promise<Response> {
    // 获取请求 ID
    const requestId = c.get('requestId');
    // 获取已校验的查询参数
    const validatedQuery = c.req.valid('query');
    // 提取 name
    const { name } = validatedQuery;

    // 记录日志
    logger.info({ name, path: c.req.path, requestId }, 'Executing /otherget route');

    try {
      // 步骤 1: 调用外部 API 服务按名称搜索歌曲 (硬编码 kuwo 源)
      const searchResults = await this.externalApiService.searchOtherMusic(name, 'kuwo', 1, 1, requestId);

      // 检查搜索结果是否有效
      if (!searchResults || searchResults.length === 0 || !searchResults[0].url_id) {
        // 如果未找到, 抛出 404 错误
        throw new ApiError('未找到匹配的歌曲 (Song not found in search)', 404);
      }

      // 从第一个结果中获取歌曲 ID
      const trackId = searchResults[0].url_id;
      // 记录调试日志
      logger.debug({ name, foundTrackId: trackId, requestId }, 'Found track ID from search');

      // 步骤 2: 调用外部 API 服务使用 ID 获取音乐 URL (硬编码 kuwo 源和 br 999)
      const result: OtherMusicUrlResult = await this.externalApiService.getOtherMusicUrl(trackId, 'kuwo', '999', requestId);

       // 尝试构建代理 URL
       const proxyUrl = this.proxyService.buildProxyUrl(result.url);
       // 准备响应数据
       const responseData = {
            url: result.url,
            ...(proxyUrl && { proxyUrl: proxyUrl })
       };

      // 返回成功的 JSON 响应
      return c.json({
        code: 200,
        message: '请求成功',
        data: responseData,
      });

    } catch (error) {
      // 如果搜索或获取 URL 过程中出错 (包括上面抛出的 404 ApiError)
      // 让 Hono 的全局错误处理器来处理
      throw error; // 重新抛出错误
    }
  }

  /**
   * 处理 404 Not Found (将在 app.ts 中通过 app.notFound() 配置)
   * @param c - Hono 上下文对象
   * @returns Promise<Response>
   */
   public async handleNotFound(c: Context): Promise<Response> {
      // 同样, 返回 HTML 文件需要特殊处理
      logger.info({ path: c.req.path, requestId: c.get('requestId') }, 'Serving 404 page (placeholder)');
      return c.html('<h1>404 - 未找到页面</h1><p>您访问的资源不存在。</p>', 404); // 返回 404 HTML 响应
   }
}

// --- 实例化控制器 ---
// (我们将在路由文件中或应用入口处进行实例化和注入)
// export const musicControllerInstance = new MusicController(
//   new MusicMatchService(),
//   new ExternalApiService(),
//   new ProxyService()
// );
