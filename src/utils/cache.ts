/**
 * 缓存工具
 *
 * 提供内存缓存功能，用于缓存API响应和其他频繁访问的数据
 */

import { logger } from './logger.js';

// 缓存项接口
interface CacheItem<T> {
  value: T;
  expiry: number;
  hits: number;
  created: number;
  lastAccessed: number;
}

// 缓存统计接口
interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgTtl: number;
  oldestItem: number;
  newestItem: number;
}

/**
 * 内存缓存类
 */
class MemoryCache<T = any> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private maxSize: number;
  private defaultTtl: number;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupInterval: NodeJS.Timeout;

  /**
   * 创建缓存实例
   * @param name 缓存名称，用于日志
   * @param options 缓存选项
   */
  constructor(
    private name: string,
    options: {
      maxSize?: number;
      defaultTtl?: number;
      cleanupInterval?: number;
    } = {}
  ) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtl || 5 * 60 * 1000; // 默认5分钟

    // 定期清理过期缓存
    const cleanupIntervalMs = options.cleanupInterval || 60 * 1000; // 默认1分钟
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);

    // 使用debug级别记录单个缓存创建，避免在启动时产生过多日志
    logger.debug(`创建缓存: ${name}`, {
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl,
      cleanupInterval: cleanupIntervalMs
    });
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（毫秒）
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiry = now + (ttl || this.defaultTtl);

    this.cache.set(key, {
      value,
      expiry,
      hits: 0,
      created: now,
      lastAccessed: now
    });

    // 如果缓存超过最大大小，删除最旧的项
    if (this.cache.size > this.maxSize) {
      this.evictOldest();
    }

    logger.debug(`缓存设置: ${this.name}/${key}`, {
      expiry: new Date(expiry).toISOString(),
      ttl: ttl || this.defaultTtl
    });
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值或undefined（如果不存在或已过期）
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    const now = Date.now();

    // 如果缓存项不存在或已过期
    if (!item || item.expiry < now) {
      if (item) {
        // 缓存项存在但已过期，删除它
        this.cache.delete(key);
        logger.debug(`缓存过期: ${this.name}/${key}`);
      }

      this.misses++;
      return undefined;
    }

    // 更新访问统计
    item.hits++;
    item.lastAccessed = now;
    this.hits++;

    logger.debug(`缓存命中: ${this.name}/${key}`, {
      hits: item.hits,
      age: now - item.created
    });

    return item.value;
  }

  /**
   * 检查缓存项是否存在且未过期
   * @param key 缓存键
   * @returns 是否存在且未过期
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    return !!item && item.expiry > Date.now();
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    logger.debug(`缓存删除: ${this.name}/${key}`);
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info(`缓存清空: ${this.name}`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const now = Date.now();
    let oldestTime = now;
    let newestTime = 0;

    // 查找最旧和最新的缓存项
    for (const item of this.cache.values()) {
      if (item.created < oldestTime) {
        oldestTime = item.created;
      }
      if (item.created > newestTime) {
        newestTime = item.created;
      }
    }

    // 计算平均TTL
    let totalTtl = 0;
    for (const item of this.cache.values()) {
      totalTtl += (item.expiry - item.created);
    }
    const avgTtl = this.cache.size > 0 ? totalTtl / this.cache.size : 0;

    // 计算命中率
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      avgTtl,
      oldestItem: now - oldestTime,
      newestItem: now - newestTime
    };
  }

  /**
   * 清理过期缓存项
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`缓存清理: ${this.name}`, {
        expiredCount,
        remaining: this.cache.size
      });
    }
  }

  /**
   * 驱逐最旧的缓存项
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    // 查找最旧的缓存项
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestKey = key;
        oldestTime = item.lastAccessed;
      }
    }

    // 删除最旧的缓存项
    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`缓存驱逐: ${this.name}/${oldestKey}`, {
        age: Date.now() - oldestTime
      });
    }
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    logger.info(`缓存销毁: ${this.name}`);
  }
}

// 创建默认缓存实例
const defaultCache = new MemoryCache('default');

// 创建API响应缓存实例
const apiCache = new MemoryCache('api', {
  maxSize: 500,
  defaultTtl: 5 * 60 * 1000 // 5分钟
});

// 创建系统信息缓存实例
const systemCache = new MemoryCache('system', {
  maxSize: 50,
  defaultTtl: 60 * 1000 // 1分钟
});

// 导出缓存实例和类
export {
  MemoryCache,
  defaultCache,
  apiCache,
  systemCache
};
