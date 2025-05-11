import { Hono } from 'hono';
import { logger } from '../utils/logger.js';

// 创建CSP报告路由实例
const cspReport = new Hono();

/**
 * 接收CSP违规报告
 */
cspReport.post('/', async (c) => {
  try {
    const requestId = c.req.header('X-Request-ID') || 'unknown';
    const report = await c.req.json();

    // 记录CSP违规报告
    logger.warn('CSP违规报告', {
      requestId,
      report,
      userAgent: c.req.header('User-Agent') || 'unknown'
    });

    return c.json({
      code: 200,
      message: "CSP报告已接收",
      requestId
    }, 200, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  } catch (error) {
    logger.error("处理CSP报告失败", error as Error);
    return c.json({
      code: 400,
      message: "处理CSP报告失败"
    }, 400, {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }
});

export { cspReport };
