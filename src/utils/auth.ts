import * as crypto from 'crypto';
import { logger } from './logger.js';

/**
 * 鉴权相关工具函数
 *
 * 用于生成和验证API鉴权参数
 * 鉴权格式: auth=签名|时间戳|随机数
 * 签名算法: HMAC-SHA256(密钥, 时间戳|随机数|路径|查询参数)
 * 有效期: 300秒
 */

// 鉴权参数有效期（秒）
export const AUTH_EXPIRY_SECONDS = 300;

// 随机数缓存，用于防止重放攻击
// 格式: { 随机数: 过期时间戳 }
const nonceCache: Record<string, number> = {};

// 签名缓存，用于减少重复计算
// 格式: { 缓存键: { signature: 签名, expiry: 过期时间戳 } }
interface SignatureCacheEntry {
  signature: string;
  expiry: number;
}
const signatureCache: Record<string, SignatureCacheEntry> = {};

// 清理过期的随机数缓存
const cleanupNonceCache = () => {
  const now = Math.floor(Date.now() / 1000);
  let expiredCount = 0;

  for (const nonce in nonceCache) {
    if (nonceCache[nonce] < now) {
      delete nonceCache[nonce];
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    logger.debug(`清理了 ${expiredCount} 个过期的随机数缓存`);
  }
};

// 清理过期的签名缓存
const cleanupSignatureCache = () => {
  const now = Math.floor(Date.now() / 1000);
  let expiredCount = 0;

  for (const key in signatureCache) {
    if (signatureCache[key].expiry < now) {
      delete signatureCache[key];
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    logger.debug(`清理了 ${expiredCount} 个过期的签名缓存`);
  }
};

// 每小时清理一次缓存
setInterval(() => {
  cleanupNonceCache();
  cleanupSignatureCache();
}, 60 * 60 * 1000);

// 生成随机数
export const generateNonce = (length: number = 8): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * 生成签名
 * @param timestamp 时间戳（秒）
 * @param nonce 随机数
 * @param path 请求路径
 * @param query 查询参数（不包含auth参数）
 * @param secret 密钥
 * @returns 签名
 */
export const generateSignature = (
  timestamp: number,
  nonce: string,
  path: string,
  query: Record<string, string>,
  secret: string
): string => {
  // 构建缓存键
  const cacheKey = `${timestamp}|${nonce}|${path}|${JSON.stringify(query)}`;

  // 检查缓存
  if (signatureCache[cacheKey] && signatureCache[cacheKey].expiry > Math.floor(Date.now() / 1000)) {
    logger.debug('使用缓存的签名', { path, timestamp, nonce });
    return signatureCache[cacheKey].signature;
  }

  // 按字母顺序排序查询参数
  const sortedQuery = Object.keys(query)
    .sort()
    .map(key => `${key}=${query[key]}`)
    .join('&');

  // 构建签名字符串: 时间戳|随机数|路径|查询参数
  const signString = `${timestamp}|${nonce}|${path}|${sortedQuery}`;

  // 使用HMAC-SHA256算法生成签名
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signString);
  const signature = hmac.digest('hex');

  // 缓存签名，有效期与鉴权参数相同
  signatureCache[cacheKey] = {
    signature,
    expiry: Math.floor(Date.now() / 1000) + AUTH_EXPIRY_SECONDS
  };

  return signature;
};

/**
 * 生成完整的鉴权参数
 * @param path 请求路径
 * @param query 查询参数（不包含auth参数）
 * @param secret 密钥
 * @returns 完整的鉴权参数 (签名|时间戳|随机数)
 */
export const generateAuthParam = (
  path: string,
  query: Record<string, string>,
  secret: string
): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const signature = generateSignature(timestamp, nonce, path, query, secret);
  return `${signature}|${timestamp}|${nonce}`;
};

/**
 * 验证鉴权参数
 * @param authParam 鉴权参数 (签名|时间戳|随机数)
 * @param path 请求路径
 * @param query 查询参数（不包含auth参数）
 * @param secret 密钥
 * @returns 验证结果 {valid: boolean, reason?: string}
 */
export const verifyAuthParam = (
  authParam: string,
  path: string,
  query: Record<string, string>,
  secret: string
): { valid: boolean; reason?: string } => {
  // 解析鉴权参数
  const parts = authParam.split('|');
  if (parts.length !== 3) {
    return { valid: false, reason: '鉴权参数格式无效' };
  }

  const [signature, timestampStr, nonce] = parts;
  const timestamp = parseInt(timestampStr, 10);

  // 验证时间戳
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(timestamp) || now - timestamp > AUTH_EXPIRY_SECONDS) {
    return { valid: false, reason: '鉴权参数已过期' };
  }

  // 验证随机数是否已使用（防止重放攻击）
  if (nonceCache[nonce]) {
    return { valid: false, reason: '随机数已使用，疑似重放攻击' };
  }

  // 将随机数添加到缓存，过期时间为当前时间戳加上有效期
  nonceCache[nonce] = now + AUTH_EXPIRY_SECONDS;

  // 验证签名
  const expectedSignature = generateSignature(timestamp, nonce, path, query, secret);

  // 添加详细的签名验证日志
  logger.debug(`签名验证详情`, {
    path,
    timestamp,
    nonce,
    queryParamsCount: Object.keys(query).length,
    providedSignature: signature.substring(0, 10) + '...',
    expectedSignature: expectedSignature.substring(0, 10) + '...',
    signatureMatch: signature === expectedSignature
  });

  if (signature !== expectedSignature) {
    return { valid: false, reason: '签名无效' };
  }

  return { valid: true };
};

/**
 * 从请求URL中提取查询参数（不包含auth参数）
 * @param url 请求URL
 * @returns 查询参数对象
 */
export const extractQueryParams = (url: string): Record<string, string> => {
  const urlObj = new URL(url);
  const params: Record<string, string> = {};

  urlObj.searchParams.forEach((value, key) => {
    if (key !== 'auth') {
      params[key] = value;
    }
  });

  return params;
};

/**
 * 清除所有缓存（用于测试）
 */
export const clearCaches = () => {
  Object.keys(nonceCache).forEach(key => delete nonceCache[key]);
  Object.keys(signatureCache).forEach(key => delete signatureCache[key]);
  logger.debug('已清除所有鉴权缓存');
};
