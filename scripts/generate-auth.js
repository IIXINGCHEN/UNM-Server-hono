/**
 * 生成API鉴权参数的命令行工具
 * 
 * 使用方法:
 * node scripts/generate-auth.js [路径] [查询参数]
 * 
 * 示例:
 * node scripts/generate-auth.js /api/ncmget id=1962165898&type=url
 */

import dotenv from 'dotenv';
import { generateAuthParam } from '../dist/utils/auth.js';

// 加载环境变量
dotenv.config();

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node scripts/generate-auth.js [路径] [查询参数]');
  console.error('示例: node scripts/generate-auth.js /api/ncmget id=1962165898&type=url');
  process.exit(1);
}

const path = args[0];
const queryString = args[1];

// 解析查询参数
const queryParams = {};
queryString.split('&').forEach(param => {
  const [key, value] = param.split('=');
  if (key && value) {
    queryParams[key] = value;
  }
});

// 获取鉴权密钥
const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  console.error('错误: 未配置鉴权密钥 (AUTH_SECRET)');
  console.error('请在 .env 文件中设置 AUTH_SECRET');
  process.exit(1);
}

// 生成鉴权参数
const authParam = generateAuthParam(path, queryParams, authSecret);

// 输出结果
console.log('\n鉴权参数生成成功:');
console.log(`auth=${authParam}`);
console.log('\n完整请求URL:');
console.log(`${path}?${queryString}&auth=${authParam}`);
console.log('\n鉴权参数有效期为300秒\n');
