/**
 * Vercel 环境变量设置脚本
 *
 * 此脚本用于在 Vercel 环境中设置必要的环境变量
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 检查是否在 Vercel 环境中运行
const isVercel = process.env.VERCEL === '1';

console.log(`正在 ${isVercel ? 'Vercel' : '本地'} 环境中设置环境变量...`);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 加载 .env.vercel 文件
const envPath = path.join(rootDir, '.env.vercel');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  const envConfig = dotenv.parse(fs.readFileSync(envPath));

  // 设置环境变量
  for (const key in envConfig) {
    if (Object.prototype.hasOwnProperty.call(envConfig, key)) {
      process.env[key] = envConfig[key];
      console.log(`设置环境变量: ${key}`);
    }
  }

  console.log('环境变量设置完成');
} else {
  console.warn(`环境变量文件不存在: ${envPath}`);
}

// 验证关键环境变量
const requiredEnvVars = [
  'API_KEY',
  'AUTH_SECRET',
  'ALLOWED_DOMAIN',
  'NODE_ENV',
  'MUSIC_API_URL'
];

const missingEnvVars = [];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`缺少必要的环境变量: ${key}`);
    missingEnvVars.push(key);
  }
}

if (missingEnvVars.length > 0) {
  console.warn(`以下必要的环境变量缺失: ${missingEnvVars.join(', ')}`);
  console.warn('这些环境变量对于项目正常运行是必要的，请确保在 Vercel 控制台中手动设置');
} else {
  console.log('所有必要的环境变量都已设置');
}

// 输出当前环境信息
console.log('当前环境信息:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`ALLOWED_DOMAIN: ${process.env.ALLOWED_DOMAIN}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`RATE_LIMIT: ${process.env.RATE_LIMIT}`);
console.log(`ENABLE_HTTPS: ${process.env.ENABLE_HTTPS}`);
console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL}`);
console.log(`ALLOW_CDN: ${process.env.ALLOW_CDN}`);
console.log(`ENABLE_FLAC: ${process.env.ENABLE_FLAC}`);
console.log(`SELECT_MAX_BR: ${process.env.SELECT_MAX_BR}`);
console.log(`FOLLOW_SOURCE_ORDER: ${process.env.FOLLOW_SOURCE_ORDER}`);

// 导出环境变量供其他模块使用
export default process.env;
