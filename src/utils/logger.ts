import { Context } from 'hono';
import { getClientIp } from './ip.js';

// 日志级别
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 日志级别优先级
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// 获取当前配置的日志级别
const getCurrentLogLevel = (): LogLevel => {
  const configLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return ['debug', 'info', 'warn', 'error'].includes(configLevel)
    ? configLevel
    : 'info';
};

// 检查是否应该记录该级别的日志
const shouldLog = (level: LogLevel): boolean => {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
};

// 格式化日志消息
const formatLogMessage = (
  level: LogLevel,
  message: string,
  context?: Record<string, any>
): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
};

// 安全地序列化对象，避免循环引用
const safeStringify = (obj: any): string => {
  const cache: any[] = [];
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.includes(value)) {
        return '[Circular]';
      }
      cache.push(value);
    }
    // 过滤掉可能的敏感信息
    if (
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('key')
    ) {
      return '[REDACTED]';
    }
    return value;
  }, 2);
};

// 日志记录器
export const logger = {
  debug: (message: string, context?: Record<string, any>) => {
    if (shouldLog('debug')) {
      console.debug(formatLogMessage('debug', message, context));
    }
  },

  info: (message: string, context?: Record<string, any>) => {
    if (shouldLog('info')) {
      console.info(formatLogMessage('info', message, context));
    }
  },

  warn: (message: string, context?: Record<string, any>) => {
    if (shouldLog('warn')) {
      console.warn(formatLogMessage('warn', message, context));
    }
  },

  error: (message: string, error?: Error, context?: Record<string, any>) => {
    if (shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error && {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack
        })
      };
      console.error(formatLogMessage('error', message, errorContext));
    }
  },

  // 记录请求日志
  request: (c: Context, startTime: number) => {
    if (!shouldLog('info')) return;

    const endTime = Date.now();
    const duration = endTime - startTime;
    const requestId = c.get('requestId') || 'unknown';
    const method = c.req.method;
    const url = c.req.url;
    const status = c.res.status;
    const userAgent = c.req.header('User-Agent') || 'unknown';
    const referer = c.req.header('Referer') || '-';
    // 获取客户端IP
    const ip = getClientIp(c);

    const logContext = {
      requestId,
      method,
      url,
      status,
      duration: `${duration}ms`,
      ip,
      userAgent,
      referer
    };

    // 根据状态码选择日志级别
    if (status >= 500) {
      logger.error(`请求失败: ${method} ${url}`, undefined, logContext);
    } else if (status >= 400) {
      logger.warn(`请求异常: ${method} ${url}`, logContext);
    } else {
      logger.info(`请求完成: ${method} ${url}`, logContext);
    }
  }
};

// 请求日志中间件
export const requestLoggerMiddleware = async (c: Context, next: Next) => {
  const startTime = Date.now();

  try {
    await next();
  } finally {
    logger.request(c, startTime);
  }
};

// 导出Next类型
import { Next } from 'hono';
