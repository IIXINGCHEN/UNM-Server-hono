/**
 * 为Vercel部署创建临时.env文件的脚本
 * 
 * 此脚本在Vercel部署过程中运行，从Vercel环境变量或vercel.json中获取配置
 * 并创建一个临时的.env文件，以便构建过程能够正常进行
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// 打印带颜色的消息
function logInfo(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function logError(message) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

// 检查是否在Vercel环境中
function isVercelEnvironment() {
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true';
}

// 从vercel.json读取环境变量
function readVercelJsonEnv() {
  try {
    const vercelJsonPath = path.join(rootDir, 'vercel.json');
    if (!fs.existsSync(vercelJsonPath)) {
      logWarning('vercel.json文件不存在');
      return {};
    }

    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    return vercelJson.env || {};
  } catch (error) {
    logError(`读取vercel.json时出错: ${error.message}`);
    return {};
  }
}

// 创建临时.env文件
function createTempEnvFile() {
  logInfo('正在创建临时.env文件...');

  // 必要的环境变量列表
  const requiredEnvVars = [
    'PORT',
    'API_KEY',
    'AUTH_SECRET',
    'CLIENT_API_KEY',
    'ALLOWED_DOMAIN',
    'NODE_ENV',
    'RATE_LIMIT',
    'ENABLE_HTTPS',
    'LOG_LEVEL',
    'ALLOW_CDN',
    'MUSIC_API_URL',
    'ENABLE_FLAC',
    'SELECT_MAX_BR',
    'FOLLOW_SOURCE_ORDER'
  ];

  // 从vercel.json读取环境变量
  const vercelJsonEnv = readVercelJsonEnv();

  // 合并环境变量（优先使用系统环境变量，其次使用vercel.json中的值）
  const envVars = {};
  for (const key of requiredEnvVars) {
    envVars[key] = process.env[key] || vercelJsonEnv[key] || '';
  }

  // 设置默认值
  if (!envVars.PORT) envVars.PORT = '3000';
  if (!envVars.NODE_ENV) envVars.NODE_ENV = 'production';
  if (!envVars.RATE_LIMIT) envVars.RATE_LIMIT = '300';
  if (!envVars.ENABLE_HTTPS) envVars.ENABLE_HTTPS = 'false';
  if (!envVars.LOG_LEVEL) envVars.LOG_LEVEL = 'info';
  if (!envVars.ALLOW_CDN) envVars.ALLOW_CDN = 'true';
  if (!envVars.ENABLE_FLAC) envVars.ENABLE_FLAC = 'true';
  if (!envVars.SELECT_MAX_BR) envVars.SELECT_MAX_BR = 'true';
  if (!envVars.FOLLOW_SOURCE_ORDER) envVars.FOLLOW_SOURCE_ORDER = 'true';
  
  // 为Vercel部署设置临时的API密钥和认证密钥（如果未提供）
  if (!envVars.API_KEY) {
    envVars.API_KEY = 'temp_api_key_for_vercel_build_' + Date.now();
    logWarning(`未提供API_KEY，使用临时值: ${envVars.API_KEY}`);
  }
  
  if (!envVars.AUTH_SECRET) {
    envVars.AUTH_SECRET = 'temp_auth_secret_for_vercel_build_' + Date.now();
    logWarning(`未提供AUTH_SECRET，使用临时值: ${envVars.AUTH_SECRET}`);
  }
  
  if (!envVars.CLIENT_API_KEY) {
    envVars.CLIENT_API_KEY = 'temp_client_api_key_for_vercel_build_' + Date.now();
    logWarning(`未提供CLIENT_API_KEY，使用临时值: ${envVars.CLIENT_API_KEY}`);
  }

  if (!envVars.ALLOWED_DOMAIN) {
    envVars.ALLOWED_DOMAIN = '*.ixincghen.org.cn,*.axincghen.com,*.ixincghen.top,*.imixc.top,unm-server-hono.vercel.app,*.vercel.app,vercel.app,localhost,127.0.0.1';
    logWarning(`未提供ALLOWED_DOMAIN，使用默认值`);
  }

  // 生成.env文件内容
  let envContent = '# 此文件由scripts/create-vercel-env.js自动生成，用于Vercel部署\n';
  envContent += '# 生成时间: ' + new Date().toISOString() + '\n\n';

  for (const [key, value] of Object.entries(envVars)) {
    envContent += `${key} = ${value}\n`;
  }

  // 写入.env文件
  const envPath = path.join(rootDir, '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');

  logSuccess('临时.env文件创建成功');
  logInfo('文件路径: ' + envPath);
}

// 主函数
function main() {
  logInfo('Vercel环境临时.env文件创建工具');

  if (isVercelEnvironment()) {
    logInfo('检测到Vercel环境，开始创建临时.env文件');
    createTempEnvFile();
  } else {
    logInfo('非Vercel环境，无需创建临时.env文件');
  }
}

// 执行主函数
main();
