/**
 * Vercel 环境变量设置脚本
 * 
 * 此脚本用于自动设置 Vercel 项目的环境变量
 * 从 .env 文件读取环境变量，并使用 Vercel CLI 设置到 Vercel 项目中
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

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
  blue: '\x1b[34m'
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

// 检查 Vercel CLI 是否已安装
function checkVercelCli() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// 检查是否已登录 Vercel
function checkVercelLogin() {
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// 从 .env 文件读取环境变量
function loadEnvVars() {
  const envPath = path.join(rootDir, '.env');
  
  if (!fs.existsSync(envPath)) {
    logError('.env 文件不存在，请先创建 .env 文件');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  return dotenv.parse(envContent);
}

// 设置 Vercel 环境变量
function setVercelEnv(envVars) {
  logInfo('开始设置 Vercel 环境变量...');
  
  // 必要的环境变量列表
  const requiredEnvVars = [
    'API_KEY',
    'AUTH_SECRET',
    'ALLOWED_DOMAIN',
    'NODE_ENV',
    'MUSIC_API_URL'
  ];
  
  // 检查必要的环境变量是否存在
  const missingEnvVars = requiredEnvVars.filter(key => !envVars[key]);
  
  if (missingEnvVars.length > 0) {
    logWarning(`以下必要的环境变量缺失: ${missingEnvVars.join(', ')}`);
    logWarning('这些环境变量对于项目正常运行是必要的，请确保在 Vercel 控制台中手动设置');
  }
  
  // 设置环境变量
  for (const [key, value] of Object.entries(envVars)) {
    try {
      // 跳过空值
      if (!value) {
        logWarning(`跳过空值环境变量: ${key}`);
        continue;
      }
      
      logInfo(`设置环境变量: ${key}`);
      
      // 使用 Vercel CLI 设置环境变量
      execSync(`vercel env add ${key} production`, { stdio: 'pipe' });
      
      // 输入环境变量值
      execSync(`echo ${value}`, { stdio: 'pipe' });
      
      logSuccess(`环境变量 ${key} 设置成功`);
    } catch (error) {
      logError(`设置环境变量 ${key} 失败: ${error.message}`);
    }
  }
  
  logInfo('环境变量设置完成，请确保在 Vercel 控制台中检查环境变量是否正确');
}

// 主函数
async function main() {
  // 检查 Vercel CLI
  if (!checkVercelCli()) {
    logError('Vercel CLI 未安装，请先安装 Vercel CLI');
    logInfo('可以使用以下命令安装: pnpm add -g vercel');
    process.exit(1);
  }
  
  // 检查 Vercel 登录状态
  if (!checkVercelLogin()) {
    logWarning('未登录 Vercel，请先登录');
    execSync('vercel login', { stdio: 'inherit' });
  }
  
  // 加载环境变量
  const envVars = loadEnvVars();
  
  // 设置 Vercel 环境变量
  setVercelEnv(envVars);
}

// 执行主函数
main().catch(error => {
  logError(`脚本执行失败: ${error.message}`);
  process.exit(1);
});
