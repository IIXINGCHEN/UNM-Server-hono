// src/utils/logger.ts

// 导入 pino 日志库
import pino from 'pino';
// 导入我们经过校验的应用配置
import config from '../config';

// 创建 pino 日志记录器实例
const logger = pino({
  // 设置日志记录的最低级别, 来自配置 (例如 'info', 'debug')
  level: config.LOG_LEVEL,
  // 配置日志输出的格式 (transport)
  transport:
    // 检查是否处于开发环境
    config.NODE_ENV === 'development'
      // 如果是开发环境, 使用 pino-pretty 进行美化输出
      ? {
          target: 'pino-pretty', // 指定 pino-pretty 作为目标
          options: {
            colorize: true, // 启用彩色输出
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', // 定义时间戳格式
            ignore: 'pid,hostname', // 忽略日志中的进程 ID 和主机名, 使输出更简洁
          },
        }
      // 如果不是开发环境 (例如生产环境), 不设置 transport, pino 默认输出 JSON 格式
      : undefined,
});

// 默认导出创建好的 logger 实例, 供全应用使用
export default logger;
