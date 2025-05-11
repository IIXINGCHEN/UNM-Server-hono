/**
 * JSON响应中间件
 *
 * 确保所有API响应都以JSON UTF-8格式返回
 */

import { Context, Next } from 'hono';

/**
 * JSON响应中间件
 * 确保所有API响应都设置了正确的Content-Type头，包括UTF-8字符编码
 */
export const jsonResponseMiddleware = async (c: Context, next: Next) => {
  // 继续处理请求
  await next();

  // 如果响应已经设置了Content-Type，但没有指定charset，添加charset=utf-8
  const contentType = c.res.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json') && !contentType.includes('charset=')) {
    c.res.headers.set('Content-Type', `${contentType}; charset=utf-8`);
  } else if (!contentType && c.res.headers.get('Content-Length')) {
    // 如果没有设置Content-Type但有内容，假设是JSON并设置正确的Content-Type
    c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
  }
};
