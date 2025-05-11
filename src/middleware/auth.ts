import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyAuthParam, extractQueryParams } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

/**
 * 需要鉴权的API路径
 * 格式: { 路径: 需要鉴权的查询参数type值数组 }
 */
const AUTH_REQUIRED_PATHS: Record<string, string[]> = {
  '/api/ncmget': ['url', 'pic', 'lrc'],
  '/api/match': ['url', 'pic', 'lrc'],
  '/api/otherget': ['url', 'pic', 'lrc']
};

/**
 * 检查请求是否需要鉴权
 * @param path 请求路径
 * @param type 请求类型参数
 * @returns 是否需要鉴权
 */
const isAuthRequired = (path: string, type?: string): boolean => {
  // 如果路径不在需要鉴权的列表中，则不需要鉴权
  if (!Object.keys(AUTH_REQUIRED_PATHS).some(p => path.startsWith(p))) {
    return false;
  }

  // 如果路径在列表中，但没有指定type参数，则不需要鉴权
  if (!type) {
    return false;
  }

  // 遍历需要鉴权的路径，检查当前路径是否匹配
  for (const [authPath, types] of Object.entries(AUTH_REQUIRED_PATHS)) {
    if (path.startsWith(authPath) && types.includes(type)) {
      return true;
    }
  }

  return false;
};

/**
 * API鉴权中间件
 * 验证需要鉴权的API请求
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const path = c.req.path;
  const type = c.req.query('type');
  const requestId = c.get('requestId') || 'unknown';

  // 检查是否需要鉴权
  if (!isAuthRequired(path, type)) {
    await next();
    return;
  }

  // 获取鉴权密钥
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    // 在生产环境中，如果未配置鉴权密钥，则拒绝请求
    if (process.env.NODE_ENV === 'production') {
      logger.error('生产环境未配置鉴权密钥', new Error('AUTH_SECRET not configured'), { requestId, path });
      return c.json({
        code: 500,
        message: '服务器配置错误',
        requestId
      }, 500, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    } else {
      // 在开发环境中，如果未配置鉴权密钥，则记录警告并跳过鉴权
      logger.warn('未配置鉴权密钥，跳过鉴权', { requestId, path });
      await next();
      return;
    }
  }

  // 获取鉴权参数
  const authParam = c.req.query('auth');
  if (!authParam) {
    logger.warn('请求缺少鉴权参数', { requestId, path, type });
    return c.json({
      code: 401,
      message: '缺少鉴权参数',
      requestId
    }, 401, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }

  // 提取查询参数（不包含auth参数）
  const queryParams = extractQueryParams(c.req.url);

  // 开发环境下，可以放宽鉴权要求
  if (process.env.NODE_ENV === 'development') {
    logger.debug('开发环境下，鉴权参数验证更宽松', { requestId, path, type });
  }

  // 添加详细日志，帮助诊断问题
  logger.debug(`鉴权参数验证: 路径=${path}, 类型=${type || '无'}, 参数长度=${authParam.length}`, {
    requestId,
    path,
    type,
    authParamPrefix: authParam.substring(0, 10) + '...',
    queryParamsKeys: Object.keys(queryParams),
    queryParamsCount: Object.keys(queryParams).length
  });

  // 验证鉴权参数
  const { valid, reason } = verifyAuthParam(authParam, path, queryParams, authSecret);
  if (!valid) {
    // 如果请求来自localhost，则允许跳过鉴权
    const isLocalhost = c.req.header('host')?.includes('localhost') || c.req.header('host')?.includes('127.0.0.1');
    if (isLocalhost) {
      logger.warn(`允许来自localhost的请求跳过鉴权验证`, {
        requestId,
        path,
        type,
        reason
      });
      await next();
      return;
    }

    // 其他情况下，拒绝请求
    logger.warn(`鉴权失败: ${reason}`, {
      requestId,
      path,
      type,
      reason,
      authParamParts: authParam.split('|').length,
      queryParamsJson: JSON.stringify(queryParams)
    });
    return c.json({
      code: 401,
      message: reason || '鉴权失败',
      requestId
    }, 401, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }

  // 鉴权通过
  logger.info('鉴权成功', { requestId, path, type });
  await next();
};
