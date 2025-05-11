/**
 * API权限级别定义和验证工具
 *
 * 实现客户端密钥和服务器密钥分离模式，提高API安全性
 */

import { Context } from 'hono';

/**
 * API权限级别枚举
 */
export enum ApiPermissionLevel {
  /**
   * 公开API - 无需任何密钥即可访问
   * 例如: /api/config, /api/csp-report
   */
  PUBLIC = 'public',

  /**
   * 客户端API - 需要客户端API密钥
   * 例如: /api/info, /api/auth
   */
  CLIENT = 'client',

  /**
   * 服务器API - 需要服务器API密钥
   * 例如: 敏感操作、管理功能
   */
  SERVER = 'server'
}

/**
 * API端点权限配置
 * 格式: { 路径: 权限级别 }
 */
export const API_PERMISSION_CONFIG: Record<string, ApiPermissionLevel> = {
  // 公开API
  '/api/config': ApiPermissionLevel.PUBLIC,
  '/api/csp-report': ApiPermissionLevel.PUBLIC,

  // 客户端API
  '/api/info': ApiPermissionLevel.CLIENT,
  '/api/auth': ApiPermissionLevel.CLIENT,
  '/api/search': ApiPermissionLevel.CLIENT,
  '/api/match': ApiPermissionLevel.CLIENT,  // 添加 match 接口到客户端API

  // 默认所有其他API为服务器级别
  // 包括音乐URL、封面、歌词等敏感资源
};

/**
 * 获取API端点的权限级别
 * @param path API路径
 * @returns 权限级别
 */
export const getApiPermissionLevel = (path: string): ApiPermissionLevel => {
  // 检查是否有明确配置
  if (path in API_PERMISSION_CONFIG) {
    return API_PERMISSION_CONFIG[path];
  }

  // 默认为服务器级别（最高权限）
  return ApiPermissionLevel.SERVER;
};

/**
 * 验证API密钥是否有权限访问指定级别的API
 * @param providedKey 提供的API密钥
 * @param requiredLevel 所需的权限级别
 * @returns 验证结果 {valid: boolean, reason?: string}
 */
export const validateApiKeyPermission = (
  providedKey: string | null,
  requiredLevel: ApiPermissionLevel
): { valid: boolean; reason?: string } => {
  // 获取环境变量中的密钥
  const serverApiKey = process.env.API_KEY;
  const clientApiKey = process.env.CLIENT_API_KEY;

  // 公开API无需验证密钥
  if (requiredLevel === ApiPermissionLevel.PUBLIC) {
    return { valid: true };
  }

  // 未提供密钥
  if (!providedKey) {
    return { valid: false, reason: 'API密钥缺失' };
  }

  // 验证服务器级别API
  if (requiredLevel === ApiPermissionLevel.SERVER) {
    // 只有服务器API密钥可以访问服务器级别API
    if (providedKey === serverApiKey) {
      return { valid: true };
    }
    return { valid: false, reason: '无权访问服务器级别API' };
  }

  // 验证客户端级别API
  if (requiredLevel === ApiPermissionLevel.CLIENT) {
    // 服务器API密钥和客户端API密钥都可以访问客户端级别API
    if (providedKey === serverApiKey || providedKey === clientApiKey) {
      return { valid: true };
    }
    return { valid: false, reason: 'API密钥无效' };
  }

  // 未知权限级别
  return { valid: false, reason: '未知权限级别' };
};

/**
 * 获取请求中提供的API密钥
 * @param c Hono上下文
 * @returns 提供的API密钥或null
 */
export const getProvidedApiKey = (c: Context): string | null => {
  return c.req.header('X-API-Key') || c.req.query('api_key') || null;
};

/**
 * 验证请求的来源是否合法
 * @param c Hono上下文
 * @returns 验证结果 {valid: boolean, reason?: string}
 */
export const validateOrigin = (c: Context): { valid: boolean; reason?: string } => {
  const origin = c.req.header('Origin') || '';
  const referer = c.req.header('Referer') || '';
  const host = c.req.header('Host') || '';

  // 本地主机始终允许（开发环境）
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  if (isLocalhost) {
    return { valid: true };
  }

  // 非生产环境可以放宽限制
  if (process.env.NODE_ENV !== 'production') {
    return { valid: true };
  }

  // 生产环境中严格验证来源
  const allowedDomains = (process.env.ALLOWED_DOMAIN || '').split(',').map(d => d.trim());

  // 使用完整URL匹配而不是includes
  const isAllowedOrigin = allowedDomains.some(domain => {
    return origin === `http://${domain}` || origin === `https://${domain}`;
  });

  // 验证Referer（如果Origin不存在）
  const isAllowedReferer = !origin && allowedDomains.some(domain => {
    return referer.startsWith(`http://${domain}/`) || referer.startsWith(`https://${domain}/`);
  });

  if (isAllowedOrigin || isAllowedReferer) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `非法来源: ${origin || referer || 'unknown'}`
  };
};


