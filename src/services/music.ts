import axios from 'axios';
import match from '@unblockneteasemusic/server';
import { logger } from '../utils/logger.js';
import { readPackageJson } from '../utils/package.js';
import { apiCache } from '../utils/cache.js';

// 定义支持的音源列表
export const DEFAULT_SOURCES = [
  "pyncmd",
  "kuwo",
  "bilibili",
  "migu",
  "kugou",
  "qq",
  //"youtube",
  //"youtube-dl",
  //"yt-dlp"
];

// 从环境变量获取API基础URL
const API_BASE_URL = process.env.MUSIC_API_URL || 'https://music-api.gdstudio.xyz/api.php';

// 获取User-Agent头
let userAgentCache: string | null = null;
export const getUserAgent = async (): Promise<string> => {
  if (userAgentCache) return userAgentCache;

  try {
    const packageJson = await readPackageJson();
    userAgentCache = `UNM-Server/${packageJson.version}`;
    return userAgentCache;
  } catch (error) {
    logger.error('获取版本号失败:', error as Error);
    return 'UNM-Server/unknown';
  }
};

// 重试配置
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 300,
  maxDelay: 3000,
  factor: 2
};

// 带重试的请求函数
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  let delay = retryConfig.initialDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error as Error;

      // 如果是最后一次尝试，则抛出错误
      if (attempt === retryConfig.maxRetries) {
        throw lastError;
      }

      // 记录重试信息
      logger.warn(`请求失败，正在重试 (${attempt + 1}/${retryConfig.maxRetries})`, {
        url,
        error: lastError.message
      });

      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, delay));

      // 指数退避策略
      delay = Math.min(delay * retryConfig.factor, retryConfig.maxDelay);
    }
  }

  // 这里不应该到达，但为了类型安全
  throw lastError;
}

// 获取音乐URL
export async function getMusicUrl(id: string | number, sources: string[] = DEFAULT_SOURCES): Promise<any> {
  // 构建缓存键
  const cacheKey = `music_url:${id}:${sources.join(',')}`;

  try {
    // 检查缓存
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`使用缓存的音乐URL数据`, {
        id,
        sources: sources.join(','),
        source: cachedData.source
      });
      return cachedData;
    }

    // 缓存未命中，从API获取数据
    logger.debug(`缓存未命中，从API获取音乐URL数据`, {
      id,
      sources: sources.join(',')
    });

    const data = await match(id, sources);

    // 处理代理URL
    const proxyUrl = process.env.PROXY_URL;
    let resultData = { ...data };

    if (proxyUrl && data.url && data.url.includes("kuwo")) {
      resultData.proxyUrl = proxyUrl + data.url.replace(/^http:\/\//, "http/");
    }

    // 缓存结果（有效期10分钟）
    apiCache.set(cacheKey, resultData, 10 * 60 * 1000);

    return resultData;
  } catch (error) {
    logger.error(`获取音乐URL失败`, error as Error);
    throw error;
  }
}

// 获取音乐封面图片
export async function getMusicCover(id: string | number): Promise<string> {
  // 构建缓存键
  const cacheKey = `music_cover:${id}`;

  try {
    // 检查缓存
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`使用缓存的音乐封面数据`, { id });
      return cachedData;
    }

    // 缓存未命中，从API获取数据
    logger.debug(`缓存未命中，从API获取音乐封面数据`, { id });

    // 网易云音乐API获取歌曲详情
    const url = `https://music.163.com/api/song/detail?ids=[${id}]`;
    const userAgent = await getUserAgent();

    const response = await fetchWithRetry<any>(url, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://music.163.com/',
        'Accept': 'application/json'
      }
    });

    let picUrl;
    if (response && response.songs && response.songs.length > 0 && response.songs[0].album.picUrl) {
      // 返回高质量图片
      picUrl = `${response.songs[0].album.picUrl}?param=800y800`;
    } else {
      // 如果无法获取封面，返回默认封面
      picUrl = 'https://p3.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg?param=200y200';
    }

    // 缓存结果（有效期1天，因为封面很少变化）
    apiCache.set(cacheKey, picUrl, 24 * 60 * 60 * 1000);

    return picUrl;
  } catch (error) {
    logger.error(`获取音乐封面失败`, error as Error);
    // 返回默认封面
    return 'https://p3.music.126.net/UeTuwE7pvjBpypWLudqukA==/3132508627578625.jpg?param=200y200';
  }
}

// 获取音乐歌词
export async function getMusicLyric(id: string | number): Promise<string> {
  // 构建缓存键
  const cacheKey = `music_lyric:${id}`;

  try {
    // 检查缓存
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`使用缓存的音乐歌词数据`, { id });
      return cachedData;
    }

    // 缓存未命中，从API获取数据
    logger.debug(`缓存未命中，从API获取音乐歌词数据`, { id });

    // 网易云音乐API获取歌词
    const url = `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`;
    const userAgent = await getUserAgent();

    const response = await fetchWithRetry<any>(url, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://music.163.com/',
        'Accept': 'application/json'
      }
    });

    let lyric;
    if (response && response.lrc && response.lrc.lyric) {
      lyric = response.lrc.lyric;
    } else {
      // 如果无法获取歌词，返回默认歌词
      lyric = "[00:00.000] 暂无歌词";
    }

    // 缓存结果（有效期1天，因为歌词很少变化）
    apiCache.set(cacheKey, lyric, 24 * 60 * 60 * 1000);

    return lyric;
  } catch (error) {
    logger.error(`获取音乐歌词失败`, error as Error);
    // 返回默认歌词
    return "[00:00.000] 暂无歌词";
  }
}

// 通过名称搜索音乐
export async function searchMusic(name: string, source: string = 'kuwo'): Promise<any> {
  // 构建缓存键
  const cacheKey = `music_search:${name}:${source}`;

  try {
    // 检查缓存
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`使用缓存的音乐搜索数据`, { name, source });
      return cachedData;
    }

    // 缓存未命中，从API获取数据
    logger.debug(`缓存未命中，从API获取音乐搜索数据`, { name, source });

    // 构造歌曲搜索 API 请求
    const searchUrl = new URL(process.env.MUSIC_API_URL || API_BASE_URL);
    searchUrl.searchParams.append("types", "search");
    searchUrl.searchParams.append("source", source);
    searchUrl.searchParams.append("name", name);
    searchUrl.searchParams.append("count", "1");
    searchUrl.searchParams.append("pages", "1");

    const userAgent = await getUserAgent();
    const searchResult = await fetchWithRetry<any>(searchUrl.toString(), {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });

    if (!searchResult || !searchResult[0] || !searchResult[0].url_id) {
      throw new Error("未找到匹配的音乐");
    }

    // 缓存结果（有效期1小时）
    apiCache.set(cacheKey, searchResult[0], 60 * 60 * 1000);

    return searchResult[0];
  } catch (error) {
    logger.error(`搜索音乐失败`, error as Error);
    throw error;
  }
}

// 通过ID和音源获取音乐URL
export async function getMusicUrlBySource(id: string, source: string = 'kuwo', br: string = '999'): Promise<any> {
  // 构建缓存键
  const cacheKey = `music_url_source:${id}:${source}:${br}`;

  try {
    // 检查缓存
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      logger.debug(`使用缓存的音源音乐URL数据`, { id, source, br });
      return cachedData;
    }

    // 缓存未命中，从API获取数据
    logger.debug(`缓存未命中，从API获取音源音乐URL数据`, { id, source, br });

    // 获取音乐URL
    const musicUrl = new URL(process.env.MUSIC_API_URL || API_BASE_URL);
    musicUrl.searchParams.append("types", "url");
    musicUrl.searchParams.append("source", source);
    musicUrl.searchParams.append("id", id);
    musicUrl.searchParams.append("br", br);

    const userAgent = await getUserAgent();
    const musicResult = await fetchWithRetry<any>(musicUrl.toString(), {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });

    if (!musicResult || !musicResult.url) {
      throw new Error("未找到音乐URL");
    }

    // 缓存结果（有效期10分钟）
    apiCache.set(cacheKey, musicResult, 10 * 60 * 1000);

    return musicResult;
  } catch (error) {
    logger.error(`获取音乐URL失败`, error as Error);
    throw error;
  }
}
