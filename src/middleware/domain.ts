import { Context, Next } from 'hono';
import { logger } from '../utils/logger.js';
import { getClientIp } from '../utils/ip.js';
import domainsConfig from '../config/domains.js';

export const domainCheck = async (c: Context, next: Next) => {
  // 优先使用配置文件中的域名列表，如果不存在则回退到环境变量
  const envAllowedDomains = process.env.ALLOWED_DOMAIN || '*';
  const allowedDomains = domainsConfig.allowedDomainsString || envAllowedDomains;

  // 检查域名配置
  if (allowedDomains === '*') {
    // 在生产环境中，如果允许所有域名，则记录警告
    if (process.env.NODE_ENV === 'production') {
      logger.warn('生产环境允许所有域名访问，存在安全风险', {
        ip: getClientIp(c),
        path: c.req.path
      });
    }
    await next();
    return;
  }

  // 使用配置文件中的域名列表，如果不存在则解析环境变量
  const domainList = domainsConfig.allowedDomains || allowedDomains.split(',').map((d: string) => d.trim());

  // 确保Vercel域名也被允许
  if (!domainList.includes('vercel.app') && !domainList.includes('*.vercel.app') && !domainList.includes('unm-server-hono.vercel.app')) {
    domainList.push('unm-server-hono.vercel.app');
    logger.info('已自动添加Vercel域名到允许列表', { domain: 'unm-server-hono.vercel.app' });
  }

  // 获取请求的来源
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');

  // 检查是否是本地请求
  const ip = getClientIp(c);
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip === '::ffff:127.0.0.1') {
    // 本地请求，允许通过
    await next();
    return;
  }

  // 检查Origin头
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;

      // 检查完全匹配
      if (domainList.includes(hostname) || domainList.includes(origin)) {
        await next();
        return;
      }

      // 检查通配符匹配
      for (const domain of domainList) {
        if (domain.startsWith('*.') && hostname.endsWith(domain.substring(1))) {
          await next();
          return;
        }
      }

      // 特殊处理Vercel域名
      if (hostname.endsWith('.vercel.app') || hostname === 'vercel.app') {
        logger.info('允许Vercel域名访问', { origin });
        await next();
        return;
      }
    } catch (error) {
      logger.warn(`无效的Origin头: ${origin}`);
    }
  }

  // 检查Referer头
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const hostname = refererUrl.hostname;

      // 检查完全匹配
      if (domainList.includes(hostname) || domainList.includes(referer)) {
        await next();
        return;
      }

      // 检查通配符匹配
      for (const domain of domainList) {
        if (domain.startsWith('*.') && hostname.endsWith(domain.substring(1))) {
          await next();
          return;
        }
      }

      // 特殊处理Vercel域名
      if (hostname.endsWith('.vercel.app') || hostname === 'vercel.app') {
        logger.info('允许Vercel域名访问', { referer });
        await next();
        return;
      }
    } catch (error) {
      logger.warn(`无效的Referer头: ${referer}`);
    }
  }

  // 特殊处理Vercel环境
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    logger.info('在Vercel环境中运行，允许请求通过', { ip: getClientIp(c) });
    await next();
    return;
  }

  // 记录被拒绝的请求
  logger.warn(`域名检查失败，拒绝访问`, {
    origin,
    referer,
    allowedDomains: domainList,
    ip: getClientIp(c)
  });

  return c.json({
    code: 403,
    message: '请通过正确的域名访问'
  }, 403);
};

