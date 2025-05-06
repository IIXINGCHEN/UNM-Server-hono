// src/server.ts

// 导入 Node.js 的 http 模块 (用于类型提示和可能的优雅关停)
import http from 'http';
// 导入 Hono 应用实例 (从 src/app.ts 导出)
import app from './app';
// 导入应用配置 (获取端口号等)
import config from './config';
// 导入日志记录器
import logger from './utils/logger';
// 导入 Hono Node.js 服务器适配器
import { serve } from '@hono/node-server';
// 导入用于监听信号的函数 (如果需要实现优雅关停)
// import { gracefulShutdown } from 'node-schedule'; // 这是一个例子, 需要合适的库或自己实现

// 定义服务器实例变量, 用于优雅关停
let serverInstance: http.Server | null = null;

// 检查是否在 Vercel 环境中运行 (Vercel 会设置 VERCEL_ENV 变量)
// 或者是否在测试环境中 (避免在测试导入时启动服务器)
if (!process.env.VERCEL_ENV && config.NODE_ENV !== 'test') {
  // 如果不是 Vercel 或测试环境, 则启动 Node.js 服务器

  // 使用 @hono/node-server 的 serve 函数启动服务器
  serverInstance = serve({
    // fetch 函数来自 Hono app 实例, 处理请求
    fetch: app.fetch,
    // 指定监听的端口号, 来自配置
    port: config.PORT,
  }, (info) => {
    // 服务器成功启动后的回调函数
    logger.info(`✅ Server listening on http://localhost:${info.port} in ${config.NODE_ENV} mode`);
  });

  // ---- (可选) 实现优雅关停逻辑 ----
  // Node.js 的 serve 函数可能不直接返回标准的 http.Server 实例的 close 方法
  // 需要查阅 @hono/node-server 文档或源码确认如何正确关闭服务器
  // 以下是基于标准 http.Server 的示例逻辑, 可能需要调整

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    // 尝试关闭服务器 (如果 serverInstance 提供了 close 方法)
    if (serverInstance && typeof (serverInstance as any).close === 'function') {
       (serverInstance as any).close((err?: Error) => {
         if (err) {
           logger.error({ err }, 'Error during server close');
           process.exit(1); // 关闭出错, 强制退出
         } else {
           logger.info('HTTP server closed successfully.');
           // 在这里可以添加其他清理逻辑 (例如关闭数据库连接)
           process.exit(0); // 正常退出
         }
       });
    } else {
        logger.warn('Server instance does not support close() or is null. Exiting directly.');
        process.exit(0); // 无法优雅关闭, 直接退出
    }


    // 设置超时强制退出, 防止关停过程卡死
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000); // 10 秒超时
  };

  // 监听终止信号
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // 监听中断信号 (例如 Ctrl+C)
  process.on('SIGINT', () => shutdown('SIGINT'));

} else if (process.env.VERCEL_ENV) {
  // 如果在 Vercel 环境中
  logger.info(`🚀 Application starting in Vercel environment (NODE_ENV: ${config.NODE_ENV}). HTTP server managed by Vercel.`);
  // 在 Vercel 中, 不需要手动启动服务器, @vercel/node 会处理 src/app.ts 导出的 Hono 实例
} else if (config.NODE_ENV === 'test') {
   // 如果在测试环境
   logger.info('Application starting in test mode. Server not started.');
}

// 对于 Node.js 进程的未捕获异常和未处理的 Promise rejection, 添加监听器
process.on('unhandledRejection', (reason, promise) => {
  // 记录严重的错误日志
  logger.fatal({ reason, promise }, 'Unhandled Rejection at Promise');
  // 考虑是否需要在此类事件后关闭服务器, 取决于应用的健壮性需求
  // shutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  // 记录致命错误日志
  logger.fatal({ err: error }, 'Uncaught Exception. Shutting down...');
  // 对于未捕获异常, 通常应尽快停止进程, 因为应用状态可能已损坏
  // 尝试优雅关闭, 但预期可能需要强制退出
  if (serverInstance && typeof (serverInstance as any).close === 'function') {
    (serverInstance as any).close(() => {
      process.exit(1); // 强制退出
    });
    setTimeout(() => process.exit(1), 5000); // 超时强制退出
  } else {
      process.exit(1); // 直接强制退出
  }
});

// 此文件主要用于本地启动, 通常不导出内容, 除非有特殊需要
// export default serverInstance;
