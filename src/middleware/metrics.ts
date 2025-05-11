import { Context, Next } from 'hono';
import { logger } from '../utils/logger.js';

/**
 * 请求计数器
 * 格式: { [路径]: { total: 总数, success: 成功数, error: 错误数 } }
 */
const requestCounts: Record<string, { total: number; success: number; error: number }> = {};

/**
 * 响应时间统计
 * 格式: { [路径]: { count: 计数, total: 总时间, min: 最小时间, max: 最大时间, avg: 平均时间 } }
 */
const responseTimes: Record<string, { count: number; total: number; min: number; max: number; avg: number }> = {};

/**
 * 错误统计
 * 格式: { [路径]: { [状态码]: 计数 } }
 */
const errorCounts: Record<string, Record<number, number>> = {};

/**
 * 最近的请求
 * 格式: { timestamp: 时间戳, path: 路径, method: 方法, status: 状态码, duration: 持续时间 }[]
 */
const recentRequests: Array<{
  timestamp: number;
  path: string;
  method: string;
  status: number;
  duration: number;
  requestId: string;
}> = [];

// 最大保存的最近请求数
const MAX_RECENT_REQUESTS = 100;

/**
 * 性能监控中间件
 * 收集请求计数、响应时间等指标
 */
export const metricsMiddleware = async (c: Context, next: Next) => {
  // 获取请求信息
  const path = c.req.path;
  const method = c.req.method;
  const requestId = c.get('requestId') || 'unknown';
  
  // 初始化计数器
  if (!requestCounts[path]) {
    requestCounts[path] = { total: 0, success: 0, error: 0 };
  }
  
  // 初始化响应时间统计
  if (!responseTimes[path]) {
    responseTimes[path] = { count: 0, total: 0, min: Infinity, max: 0, avg: 0 };
  }
  
  // 初始化错误计数器
  if (!errorCounts[path]) {
    errorCounts[path] = {};
  }
  
  // 增加请求计数
  requestCounts[path].total++;
  
  // 记录开始时间
  const startTime = process.hrtime();
  
  try {
    // 执行下一个中间件
    await next();
    
    // 获取响应状态码
    const status = c.res.status;
    
    // 计算响应时间
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1e6; // 毫秒
    
    // 更新响应时间统计
    const timeStats = responseTimes[path];
    timeStats.count++;
    timeStats.total += duration;
    timeStats.min = Math.min(timeStats.min, duration);
    timeStats.max = Math.max(timeStats.max, duration);
    timeStats.avg = timeStats.total / timeStats.count;
    
    // 更新请求计数
    if (status >= 200 && status < 400) {
      requestCounts[path].success++;
    } else {
      requestCounts[path].error++;
      
      // 更新错误计数
      if (!errorCounts[path][status]) {
        errorCounts[path][status] = 0;
      }
      errorCounts[path][status]++;
    }
    
    // 添加到最近的请求
    recentRequests.unshift({
      timestamp: Date.now(),
      path,
      method,
      status,
      duration,
      requestId
    });
    
    // 限制最近请求的数量
    if (recentRequests.length > MAX_RECENT_REQUESTS) {
      recentRequests.pop();
    }
  } catch (error) {
    // 增加错误计数
    requestCounts[path].error++;
    
    // 更新错误计数
    const status = 500;
    if (!errorCounts[path][status]) {
      errorCounts[path][status] = 0;
    }
    errorCounts[path][status]++;
    
    // 计算响应时间
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1e6; // 毫秒
    
    // 添加到最近的请求
    recentRequests.unshift({
      timestamp: Date.now(),
      path,
      method,
      status,
      duration,
      requestId
    });
    
    // 限制最近请求的数量
    if (recentRequests.length > MAX_RECENT_REQUESTS) {
      recentRequests.pop();
    }
    
    // 重新抛出错误
    throw error;
  }
};

/**
 * 获取指标数据
 * @returns 指标数据
 */
export const getMetrics = () => {
  return {
    requestCounts,
    responseTimes,
    errorCounts,
    recentRequests,
    summary: {
      totalRequests: Object.values(requestCounts).reduce((sum, counts) => sum + counts.total, 0),
      successRequests: Object.values(requestCounts).reduce((sum, counts) => sum + counts.success, 0),
      errorRequests: Object.values(requestCounts).reduce((sum, counts) => sum + counts.error, 0),
      averageResponseTime: Object.values(responseTimes).reduce((sum, times) => sum + times.avg, 0) / Object.keys(responseTimes).length || 0,
    }
  };
};

/**
 * 重置指标数据
 */
export const resetMetrics = () => {
  Object.keys(requestCounts).forEach(path => {
    requestCounts[path] = { total: 0, success: 0, error: 0 };
  });
  
  Object.keys(responseTimes).forEach(path => {
    responseTimes[path] = { count: 0, total: 0, min: Infinity, max: 0, avg: 0 };
  });
  
  Object.keys(errorCounts).forEach(path => {
    errorCounts[path] = {};
  });
  
  recentRequests.length = 0;
  
  logger.info('指标数据已重置');
};
