// src/services/musicMatch.service.ts

// 尝试性导入 @unblockneteasemusic/server，假设它可能没有完美的 TS 类型定义
// @ts-ignore // 如果确实没有类型或类型有问题，使用此注释忽略 TS 检查
import UnblockNeteasemusicServer from '@unblockneteasemusic/server';
// 导入我们自己的日志记录器实例
import logger from '../utils/logger';
// 导入应用配置，用于读取相关设置
import config from '../config';

// 定义匹配结果的数据结构接口 (如果能从库的实际输出推断出更精确的类型更好)
// 这是一个通用的占位符类型
export interface MatchData {
  url: string; // 必须包含的 URL 字段
  br?: number; // 可选的比特率
  size?: number; // 可选的文件大小
  md5?: string; // 可选的 MD5 哈希
  [key: string]: any; // 允许包含其他未明确定义的属性
}

// 定义服务方法返回结果的接口
export interface MatchServiceResult {
  status: boolean; // 标记操作是否成功 (来自库或我们的判断)
  data?: MatchData; // 如果成功，包含匹配到的数据
  message?: string; // 如果失败或有警告，包含相关信息
  [key: string]: any; // 允许包含其他可能的返回属性
}


// 需要了解 @unblockneteasemusic/server 导出的具体内容。
// 可能是函数，也可能是包含 match 方法的对象。这里假设它是一个对象包含 match 方法。
// 如果 UnblockNeteasemusicServer 本身就是函数，则直接使用。
const matchFunction = UnblockNeteasemusicServer.match || UnblockNeteasemusicServer;

// 定义音乐匹配服务类
export class MusicMatchService {
  // 构造函数 (目前为空，未来可用于初始化设置)
  constructor() {
    // 库的初始化可能在这里进行，或者它可能自动读取环境变量。
    // 根据原项目的配置文件推断，它似乎依赖 process.env 中的环境变量:
    // NETEASE_COOKIE, JOOX_COOKIE, MIGU_COOKIE, QQ_COOKIE, YOUTUBE_KEY
    // ENABLE_FLAC, SELECT_MAX_BR, FOLLOW_SOURCE_ORDER
    // 我们的 config 模块已确保这些变量被加载和校验。
  }

  /**
   * 调用 @unblockneteasemusic/server 库进行音源匹配
   * @param id - 歌曲 ID (字符串或数字)
   * @param sources - 要查询的音源列表 (字符串数组)
   * @param requestId - (可选) 请求追踪 ID，用于日志关联
   * @returns Promise<MatchServiceResult> - 包含匹配状态和数据的 Promise
   */
  public async matchTrack(id: string | number, sources: string[], requestId?: string): Promise<MatchServiceResult> {
    try {
      // 记录调试日志，说明正在尝试匹配
      logger.debug({ trackId: id, sources, requestId }, 'Attempting to match track using @unblockneteasemusic/server');

      // 调用库的核心匹配函数。需要确认其确切的参数和返回值。
      // 假设它返回一个 Promise，解析为包含 URL 的对象或在失败时抛出错误。
      // 将配置中的相关选项传递给库（如果它支持通过选项对象配置的话）。
      const result: MatchData = await matchFunction(id, sources, {
          ENABLE_FLAC: config.ENABLE_FLAC,
          SELECT_MAX_BR: config.SELECT_MAX_BR,
          FOLLOW_SOURCE_ORDER: config.FOLLOW_SOURCE_ORDER,
          // 其他 Cookie 和 Key (如果库需要通过选项传递)
          netease_cookie: config.NETEASE_COOKIE,
          joox_cookie: config.JOOX_COOKIE,
          migu_cookie: config.MIGU_COOKIE,
          qq_cookie: config.QQ_COOKIE,
          youtube_key: config.YOUTUBE_KEY,
      });

      // 检查结果是否有效 (至少包含 url)
      if (result && result.url) {
        // 记录成功匹配的信息日志
        logger.info({ trackId: id, resultUrl: result.url, requestId }, 'Track matched successfully');
        // 返回成功的状态和数据
        return { status: true, data: result };
      } else {
        // 如果库成功返回但结果无效 (例如没有 url), 记录警告
        logger.warn({ trackId: id, result, requestId }, 'Track matching did not return a valid URL or expected format');
        // 返回失败状态和说明信息
        return { status: false, message: 'Match successful but no URL found or result format unexpected.', data: result };
      }
    } catch (error: any) {
      // 如果库调用过程中发生异常
      // 记录错误日志，包含错误信息和堆栈跟踪
      logger.error({ trackId: id, error: error.message, stack: error.stack, requestId }, 'Error during track matching');
      // 返回失败状态和错误消息
      return { status: false, message: error.message || 'Matching failed due to an unexpected error.' };
    }
  }
}
