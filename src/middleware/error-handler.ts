import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../utils/logger.js';

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    // 获取请求ID
    const requestId = c.get('requestId') || 'unknown';

    // 处理Hono的HTTP异常
    if (error instanceof HTTPException) {
      const status = error.status;
      const message = error.message || getDefaultErrorMessage(status);
      const cause = ((error as any).cause as Record<string, any>) || {};

      // 记录错误日志
      logger.warn(`HTTP异常: ${status} ${message}`, {
        requestId,
        status,
        path: c.req.path,
        method: c.req.method,
        ...cause
      });

      // 返回JSON响应
      return c.json({
        code: status,
        message,
        requestId,
        ...(process.env.NODE_ENV === 'development' && cause && { details: cause })
      }, status, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 处理其他未知异常
    const err = error as Error;

    // 记录错误日志
    logger.error(`服务器错误: ${err.message}`, err, {
      requestId,
      path: c.req.path,
      method: c.req.method
    });

    // 返回通用错误响应
    return c.json({
      code: 500,
      message: process.env.NODE_ENV === 'development'
        ? `服务器错误: ${err.message}`
        : '服务器内部错误',
      requestId
    }, 500);
  }
};

// 获取默认错误消息
const getDefaultErrorMessage = (status: number): string => {
  switch (status) {
    case 400: return '请求参数无效';
    case 401: return '未授权访问';
    case 403: return '禁止访问';
    case 404: return '资源不存在';
    case 405: return '请求方法不允许';
    case 408: return '请求超时';
    case 409: return '资源冲突';
    case 413: return '请求实体过大';
    case 429: return '请求过于频繁';
    case 500: return '服务器内部错误';
    case 502: return '网关错误';
    case 503: return '服务不可用';
    case 504: return '网关超时';
    default: return '未知错误';
  }
};


