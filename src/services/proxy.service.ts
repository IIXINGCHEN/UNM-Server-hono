// src/services/proxy.service.ts

// 导入应用配置 (需要 PROXY_URL)
import config from '../config';
// 导入日志记录器
import logger from '../utils/logger';

// 定义代理服务类
export class ProxyService {
  // 从配置中读取代理服务器的基础 URL
  private readonly proxyBaseUrl = config.PROXY_URL;

  /**
   * 根据原始 URL 构建代理 URL
   * @param originalUrl - 需要被代理的原始音乐 URL
   * @returns string | undefined - 如果满足代理条件且配置了代理 URL, 返回构建好的代理 URL; 否则返回 undefined
   */
  public buildProxyUrl(originalUrl: string): string | undefined {
    // 如果没有配置代理 URL, 或者原始 URL 不是有效字符串, 则不进行代理
    if (!this.proxyBaseUrl || typeof originalUrl !== 'string') {
      return undefined;
    }

    // 根据原代码逻辑, 只代理包含 '.kuwo.' 或 '/kuwo/' 的 URL
    // 这个判断条件可能需要根据实际 URL 格式进行调整
    const isKuwo = originalUrl.includes('.kuwo.') || originalUrl.includes('/kuwo/');

    // 如果是酷我音乐的 URL
    if (isKuwo) {
       // 严格复制原代码中的代理 URL 构建逻辑: PROXY_URL + originalUrl.replace(/^http:\/\//, "http/")
       // 这个逻辑比较特殊: 它移除了原始 URL 开头的 "http://", 然后在前面拼接 PROXY_URL。
       // 假设 PROXY_URL = "https://vcproxy.091017.xyz/"
       // 原始 URL = "http://mobi.kuwo.cn/mobi.s?f=kuwo&q=..."
       // 替换后 = "http/mobi.kuwo.cn/mobi.s?f=kuwo&q=..."
       // 最终结果 = "https://vcproxy.091017.xyz/http/mobi.kuwo.cn/mobi.s?f=kuwo&q=..."
       // 这依赖于代理服务器 (vcproxy.091017.xyz) 能正确处理这种路径格式。
       // 保留此逻辑以确保功能一致性, 但需注意其特殊性。
      const modifiedUrl = originalUrl.replace(/^http:\/\//, 'http/');
      // 拼接最终的代理 URL
      const proxyUrl = this.proxyBaseUrl + modifiedUrl;

      // 对构建的 URL 做一个简单的有效性检查 (尝试用 URL 构造函数解析)
      try {
          new URL(proxyUrl); // 如果解析不抛出错误, 认为 URL 格式基本有效
          // 记录调试日志, 说明成功构建了代理 URL
          logger.debug({ originalUrl, proxyUrl }, 'Built proxy URL for Kuwo source');
          // 返回构建好的代理 URL
          return proxyUrl;
      } catch (e) {
          // 如果 URL 解析失败, 说明构建的 URL 格式有问题
          // 记录警告日志
          logger.warn({ originalUrl, modifiedUrl, proxyBase: this.proxyBaseUrl, error: (e as Error).message },
            'Constructed proxy URL seems invalid. Review proxy logic and PROXY_URL format.');
          // 返回 undefined 表示无法生成有效的代理 URL
          return undefined;
      }
    }

    // 如果不是酷我音乐的 URL, 或者没有配置代理, 则不代理
    return undefined;
  }
}
