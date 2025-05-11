import { Context } from 'hono';
import { getConnInfo } from './conninfo.js';

/**
 * 获取客户端IP的辅助函数
 * 按照以下优先级获取IP:
 * 1. X-Forwarded-For 头 (取第一个IP)
 * 2. CF-Connecting-IP 头 (Cloudflare)
 * 3. getConnInfo 辅助函数 (Hono推荐方式)
 * 4. c.env.incoming.socket.remoteAddress (Node.js)
 * 5. 'unknown' (如果都获取不到)
 */
export const getClientIp = (c: Context): string => {
  const forwardedFor = c.req.header('X-Forwarded-For');
  const cfIp = c.req.header('CF-Connecting-IP');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  } else if (cfIp) {
    return cfIp;
  } else {
    try {
      const connInfo = getConnInfo(c);
      return connInfo.remote.address || 'unknown';
    } catch (error) {
      // 如果 getConnInfo 失败，返回未知
      return 'unknown';
    }
  }
};
