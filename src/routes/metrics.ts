import { Hono } from 'hono';
import { getMetrics, resetMetrics } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';
import os from 'os';
import { readPackageJson } from '../utils/package.js';

// 创建指标路由实例
const metrics = new Hono();

// 服务启动时间
const startTime = Date.now();

// 系统信息缓存
let systemInfoCache: any = null;
let systemInfoCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1分钟缓存

/**
 * 获取系统信息
 * @returns 系统信息对象
 */
async function getSystemInfo() {
  const now = Date.now();
  
  // 如果缓存有效，直接返回缓存
  if (systemInfoCache && now - systemInfoCacheTime < CACHE_TTL) {
    return systemInfoCache;
  }
  
  try {
    const packageJson = await readPackageJson();
    
    // 收集系统信息
    const systemInfo = {
      version: packageJson.version,
      uptime: Math.floor((now - startTime) / 1000), // 秒
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cpus: os.cpus().length,
        memory: {
          total: Math.round(os.totalmem() / (1024 * 1024)), // MB
          free: Math.round(os.freemem() / (1024 * 1024)), // MB
          usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) // 百分比
        },
        loadAvg: os.loadavg()
      }
    };
    
    // 更新缓存
    systemInfoCache = systemInfo;
    systemInfoCacheTime = now;
    
    return systemInfo;
  } catch (error) {
    logger.error('获取系统信息失败', error as Error);
    
    // 返回基本信息
    return {
      version: 'unknown',
      uptime: Math.floor((now - startTime) / 1000),
      error: 'Failed to get system info'
    };
  }
}

/**
 * 获取指标数据
 */
metrics.get('/', async (c) => {
  try {
    // 获取系统信息
    const systemInfo = await getSystemInfo();
    
    // 获取指标数据
    const metricsData = getMetrics();
    
    // 返回指标数据
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      metrics: metricsData
    });
  } catch (error) {
    logger.error('获取指标数据失败', error as Error);
    
    return c.json({
      status: 'error',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 重置指标数据
 */
metrics.post('/reset', async (c) => {
  try {
    // 重置指标数据
    resetMetrics();
    
    // 返回成功
    return c.json({
      status: 'ok',
      message: '指标数据已重置',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('重置指标数据失败', error as Error);
    
    return c.json({
      status: 'error',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * 获取Prometheus格式的指标数据
 */
metrics.get('/prometheus', async (c) => {
  try {
    // 获取指标数据
    const metricsData = getMetrics();
    const systemInfo = await getSystemInfo();
    
    // 构建Prometheus格式的指标数据
    let prometheusMetrics = '';
    
    // 添加系统信息
    prometheusMetrics += '# HELP unm_system_info System information\n';
    prometheusMetrics += '# TYPE unm_system_info gauge\n';
    prometheusMetrics += `unm_system_info{version="${systemInfo.version}",node_version="${process.version}"} 1\n`;
    
    // 添加系统内存信息
    prometheusMetrics += '# HELP unm_system_memory_total_mb Total system memory in MB\n';
    prometheusMetrics += '# TYPE unm_system_memory_total_mb gauge\n';
    prometheusMetrics += `unm_system_memory_total_mb ${systemInfo.system.memory.total}\n`;
    
    prometheusMetrics += '# HELP unm_system_memory_free_mb Free system memory in MB\n';
    prometheusMetrics += '# TYPE unm_system_memory_free_mb gauge\n';
    prometheusMetrics += `unm_system_memory_free_mb ${systemInfo.system.memory.free}\n`;
    
    prometheusMetrics += '# HELP unm_system_memory_usage_percent System memory usage in percent\n';
    prometheusMetrics += '# TYPE unm_system_memory_usage_percent gauge\n';
    prometheusMetrics += `unm_system_memory_usage_percent ${systemInfo.system.memory.usage}\n`;
    
    // 添加系统负载信息
    prometheusMetrics += '# HELP unm_system_load_avg System load average\n';
    prometheusMetrics += '# TYPE unm_system_load_avg gauge\n';
    prometheusMetrics += `unm_system_load_avg{period="1m"} ${systemInfo.system.loadAvg[0]}\n`;
    prometheusMetrics += `unm_system_load_avg{period="5m"} ${systemInfo.system.loadAvg[1]}\n`;
    prometheusMetrics += `unm_system_load_avg{period="15m"} ${systemInfo.system.loadAvg[2]}\n`;
    
    // 添加请求计数
    prometheusMetrics += '# HELP unm_request_total Total number of requests\n';
    prometheusMetrics += '# TYPE unm_request_total counter\n';
    Object.entries(metricsData.requestCounts).forEach(([path, counts]) => {
      prometheusMetrics += `unm_request_total{path="${path}",type="total"} ${counts.total}\n`;
      prometheusMetrics += `unm_request_total{path="${path}",type="success"} ${counts.success}\n`;
      prometheusMetrics += `unm_request_total{path="${path}",type="error"} ${counts.error}\n`;
    });
    
    // 添加响应时间
    prometheusMetrics += '# HELP unm_response_time_ms Response time in milliseconds\n';
    prometheusMetrics += '# TYPE unm_response_time_ms gauge\n';
    Object.entries(metricsData.responseTimes).forEach(([path, times]) => {
      if (times.count > 0) {
        prometheusMetrics += `unm_response_time_ms{path="${path}",type="avg"} ${times.avg}\n`;
        prometheusMetrics += `unm_response_time_ms{path="${path}",type="min"} ${times.min}\n`;
        prometheusMetrics += `unm_response_time_ms{path="${path}",type="max"} ${times.max}\n`;
      }
    });
    
    // 添加错误计数
    prometheusMetrics += '# HELP unm_error_total Total number of errors\n';
    prometheusMetrics += '# TYPE unm_error_total counter\n';
    Object.entries(metricsData.errorCounts).forEach(([path, errors]) => {
      Object.entries(errors).forEach(([status, count]) => {
        prometheusMetrics += `unm_error_total{path="${path}",status="${status}"} ${count}\n`;
      });
    });
    
    // 添加摘要信息
    prometheusMetrics += '# HELP unm_summary_total_requests Total number of requests\n';
    prometheusMetrics += '# TYPE unm_summary_total_requests gauge\n';
    prometheusMetrics += `unm_summary_total_requests ${metricsData.summary.totalRequests}\n`;
    
    prometheusMetrics += '# HELP unm_summary_success_requests Total number of successful requests\n';
    prometheusMetrics += '# TYPE unm_summary_success_requests gauge\n';
    prometheusMetrics += `unm_summary_success_requests ${metricsData.summary.successRequests}\n`;
    
    prometheusMetrics += '# HELP unm_summary_error_requests Total number of error requests\n';
    prometheusMetrics += '# TYPE unm_summary_error_requests gauge\n';
    prometheusMetrics += `unm_summary_error_requests ${metricsData.summary.errorRequests}\n`;
    
    prometheusMetrics += '# HELP unm_summary_average_response_time Average response time in milliseconds\n';
    prometheusMetrics += '# TYPE unm_summary_average_response_time gauge\n';
    prometheusMetrics += `unm_summary_average_response_time ${metricsData.summary.averageResponseTime}\n`;
    
    // 返回Prometheus格式的指标数据
    return c.text(prometheusMetrics, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  } catch (error) {
    logger.error('获取Prometheus格式的指标数据失败', error as Error);
    
    return c.text(`# ERROR: ${(error as Error).message || 'Unknown error'}`, 500, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  }
});

export { metrics };
