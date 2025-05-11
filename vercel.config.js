/**
 * Vercel 部署配置文件
 * 用于指定 Vercel 部署时的特定配置
 */

module.exports = {
  // 使用 pnpm 作为包管理器
  packageManager: 'pnpm',

  // 构建命令
  buildCommand: 'pnpm install && pnpm build',

  // 输出目录
  outputDirectory: 'dist',

  // 环境变量
  env: {
    NODE_ENV: 'production'
  },

  // 构建设置
  build: {
    env: {
      NODE_ENV: 'production'
    }
  },

  // 路由配置
  routes: [
    {
      src: '/api/(.*)',
      dest: '/api/index.js'
    },
    {
      src: '/health',
      dest: '/api/index.js'
    },
    {
      src: '/metrics',
      dest: '/api/index.js'
    },
    {
      handle: 'filesystem'
    },
    {
      src: '/(.*)',
      dest: '/api/index.js'
    }
  ]
};
