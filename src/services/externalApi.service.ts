// src/services/externalApi.service.ts

// 导入日志记录器
import logger from '../utils/logger';
// 导入应用配置 (主要用于获取 API URL)
import config from '../config';
// 导入应用常量 (包含 API 端点 URL)
import { API_ENDPOINTS } from '../constants';
// 导入 Node.js 内置的 URLSearchParams 用于构建查询字符串 (如果需要手动构建)
// import { URLSearchParams } from 'url'; // Hono 的 fetch 通常自带 URL 处理

// 定义外部 API 返回的音乐 URL 结果接口
export interface NcmMusicUrlResult {
  url: string; // 音乐文件的 URL
  proxyUrl?: string; // 代理 URL (如果需要且已生成, 由上层逻辑添加)
  [key: string]: any; // 允许其他属性
}

// 定义外部 API 返回的搜索结果项接口
export interface OtherMusicSearchResultItem {
  url_id: string; // 歌曲的 ID (原代码中称为 qqid)
  [key: string]: any; // 允许其他属性
}

// 定义外部 API 返回的其他来源音乐 URL 结果接口
export interface OtherMusicUrlResult {
  url: string; // 音乐文件的 URL
  [key: string]: any; // 允许其他属性
}

// 定义一个自定义错误类, 用于封装 API 请求相关的错误
export class ApiError extends Error {
  // HTTP 状态码 (例如 404, 500)
  status: number;
  // 可选的错误详情 (例如 API 返回的错误信息)
  details?: any;

  /**
   * 构造 ApiError 实例
   * @param message - 错误消息
   * @param status - HTTP 状态码 (默认 500)
   * @param details - 额外错误详情
   */
  constructor(message: string, status: number = 500, details?: any) {
    super(message); // 调用父类 Error 的构造函数
    this.name = 'ApiError'; // 设置错误名称
    this.status = status; // 设置状态码
    this.details = details; // 设置详情
    // 修正 V8 (Node.js) 中的堆栈跟踪信息
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// 定义调用外部 API 的服务类
export class ExternalApiService {
  // 从常量中获取外部 API 的基础 URL
  private readonly baseUrl = API_ENDPOINTS.GDSTUDIO_MUSIC_API;
  // 设置 fetch 请求的超时时间 (毫秒)
  private readonly fetchTimeoutMs = 10000; // 10 秒

  /**
   * 执行 fetch 请求的私有辅助方法
   * @param url - 请求的完整 URL
   * @param options - fetch 请求的选项 (例如 method, headers, body)
   * @param requestId - (可选) 请求追踪 ID
   * @returns Promise<T> - 解析 API 响应 JSON 数据的 Promise
   * @throws {ApiError} - 如果请求失败或超时, 抛出 ApiError
   */
  private async performFetch<T>(url: string, options: RequestInit = {}, requestId?: string): Promise<T> {
    // 创建 AbortController 用于控制请求超时
    const controller = new AbortController();
    // 设置超时定时器, 超时后调用 abort()
    const timeoutId = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      // 记录调试日志, 说明正在发起 fetch 请求
      logger.debug({ url, options: { ...options, signal: undefined }, requestId }, 'Performing fetch to external API'); // Don't log signal

      // 执行 fetch 请求
      const response = await fetch(url, {
        ...options, // 合并传入的选项
        signal: controller.signal, // 关联 AbortController 的 signal
        headers: { // 设置请求头
            'Accept': 'application/json', // 指定接受 JSON 响应
            'User-Agent': `unm-server-hono/${process.env.npm_package_version || '1.1.0'}`, // 表明我们的应用身份
            ...(requestId ? { 'X-Request-ID': requestId } : {}), // 如果有追踪 ID, 添加到请求头
            ...options.headers, // 合并传入的自定义头
        },
      });
      // 请求已发出 (无论成功失败), 清除超时定时器
      clearTimeout(timeoutId);

      // 检查响应状态码是否表示成功 (例如 200-299)
      if (!response.ok) {
        // 如果响应失败, 尝试读取响应体文本作为错误信息
        const errorText = await response.text().catch(() => 'Could not read error response body');
        // 记录警告日志
        logger.warn({ url, status: response.status, response: errorText, requestId }, 'External API request failed');
        // 抛出 ApiError, 包含状态码和响应体
        throw new ApiError(`API request failed with status ${response.status}`, response.status, errorText);
      }

      // 如果响应成功, 解析 JSON 响应体
      const data = await response.json() as T;
      // 记录调试日志, 说明请求成功 (可以选择性记录响应数据)
      logger.debug({ url, requestId /*, responseData: data */ }, 'External API request successful'); // Avoid logging potentially large data
      // 返回解析后的数据
      return data;

    } catch (error: any) {
      // 捕获 fetch 过程中的任何错误 (网络错误, 超时错误, JSON 解析错误等)
      // 确保超时定时器被清除
      clearTimeout(timeoutId);
      // 检查是否是 AbortError (超时)
      if (error.name === 'AbortError') {
         // 记录超时错误日志
         logger.error({ url, timeout: this.fetchTimeoutMs, requestId }, 'External API request timed out');
         // 抛出表示网关超时的 ApiError
         throw new ApiError('External API request timed out', 504); // 504 Gateway Timeout
      }
      // 记录其他类型的错误日志
      logger.error({ url, error: error.message, stack: error.stack, requestId }, 'Error during fetch to external API');
      // 如果错误本身已经是 ApiError, 直接重新抛出
      if (error instanceof ApiError) {
          throw error;
      }
      // 否则, 将原始错误包装成 ApiError 再抛出
      throw new ApiError(error.message || 'Failed to fetch from external API', 500);
    }
  }

  /**
   * 获取网易云 (NCM) 音乐 URL
   * @param id - 歌曲 ID
   * @param br - 比特率 ('128', '320', '999' 等)
   * @param requestId - (可选) 请求追踪 ID
   * @returns Promise<NcmMusicUrlResult> - 包含 URL 的结果
   */
  public async getNcmMusicUrl(id: string, br: string, requestId?: string): Promise<NcmMusicUrlResult> {
    // 构建请求 URL
    const apiUrl = new URL(this.baseUrl);
    apiUrl.searchParams.append('types', 'url'); // API 参数: 类型为 url
    apiUrl.searchParams.append('id', id); // API 参数: 歌曲 ID
    apiUrl.searchParams.append('br', br); // API 参数: 比特率

    // 调用 fetch 辅助方法, 期望返回 { url: string } 结构
    return this.performFetch<{ url: string }>(apiUrl.toString(), {}, requestId);
  }

  /**
   * 搜索其他来源的音乐
   * @param name - 歌曲名称
   * @param source - 音源 (默认 'kuwo')
   * @param count - 返回结果数量 (默认 1)
   * @param page - 分页页码 (默认 1)
   * @param requestId - (可选) 请求追踪 ID
   * @returns Promise<OtherMusicSearchResultItem[]> - 搜索结果数组
   */
  public async searchOtherMusic(name: string, source: string = 'kuwo', count: number = 1, page: number = 1, requestId?: string): Promise<OtherMusicSearchResultItem[]> {
    // 构建请求 URL
    const apiUrl = new URL(this.baseUrl);
    apiUrl.searchParams.append('types', 'search'); // API 参数: 类型为 search
    apiUrl.searchParams.append('source', source); // API 参数: 音源
    apiUrl.searchParams.append('name', name); // API 参数: 歌曲名
    apiUrl.searchParams.append('count', count.toString()); // API 参数: 数量
    apiUrl.searchParams.append('pages', page.toString()); // API 参数: 页码

    // 调用 fetch 辅助方法, 期望返回结果项数组
    return this.performFetch<OtherMusicSearchResultItem[]>(apiUrl.toString(), {}, requestId);
  }

  /**
   * 获取其他来源音乐的 URL (通过 ID)
   * @param id - 歌曲 ID (从搜索结果中获取)
   * @param source - 音源 (默认 'kuwo')
   * @param br - 比特率 (默认 '999')
   * @param requestId - (可选) 请求追踪 ID
   * @returns Promise<OtherMusicUrlResult> - 包含 URL 的结果
   */
  public async getOtherMusicUrl(id: string, source: string = 'kuwo', br: string = '999', requestId?: string): Promise<OtherMusicUrlResult> {
    // 构建请求 URL
    const apiUrl = new URL(this.baseUrl);
    apiUrl.searchParams.append('types', 'url'); // API 参数: 类型为 url
    apiUrl.searchParams.append('source', source); // API 参数: 音源
    apiUrl.searchParams.append('id', id); // API 参数: 歌曲 ID
    apiUrl.searchParams.append('br', br); // API 参数: 比特率

    // 调用 fetch 辅助方法, 期望返回 { url: string } 结构
    return this.performFetch<{ url: string }>(apiUrl.toString(), {}, requestId);
  }
}
