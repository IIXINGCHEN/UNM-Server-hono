/**
 * UNM-Server-hono 构建前检查脚本
 *
 * 用于在构建前检查所有必要的文件是否存在
 * 如果缺少必要文件，将中止构建过程
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 必要的源文件列表
const requiredFiles = [
  // 核心配置文件
  'package.json',
  'tsconfig.json',
  // '.env', // 在Vercel部署时使用环境变量而非.env文件

  // 核心源文件
  'src/index.ts',
  'src/config/domains.ts',

  // 中间件文件
  'src/middleware/auth.ts',
  'src/middleware/domain.ts',
  'src/middleware/error-handler.ts',
  'src/middleware/json-response.ts',
  'src/middleware/metrics.ts',
  'src/middleware/rate-limiter.ts',
  'src/middleware/sanitizer.ts',
  'src/middleware/security.ts',
  'src/middleware/validator.ts',

  // 路由文件
  'src/routes/api.ts',
  'src/routes/csp-report.ts',
  'src/routes/health.ts',
  'src/routes/index.ts',
  'src/routes/metrics.ts',

  // 服务文件
  'src/services/music.ts',

  // 工具文件
  'src/utils/api-permissions.ts',
  'src/utils/auth.ts',
  'src/utils/cache.ts',
  'src/utils/ip.ts',
  'src/utils/logger.ts',
  'src/utils/package.ts',
  'src/utils/port.ts',
  'src/utils/response.ts',

  // 类型定义文件
  'src/types/context.ts',

  // 公共文件
  'public/index.html',
  'public/404.html',
  'public/favicon.png',

  // 构建脚本
  'scripts/convert-favicon.js',
  'scripts/copy-config.js'
];

// 目录结构检查
const requiredDirectories = [
  'src',
  'src/config',
  'src/middleware',
  'src/routes',
  'src/services',
  'src/utils',
  'src/types',
  'public',
  'scripts'
];

console.log(chalk.blue('=== UNM-Server-hono 构建前检查 ==='));

// 检查目录结构
console.log(chalk.cyan('检查目录结构...'));
let dirMissing = false;

for (const dir of requiredDirectories) {
  const dirPath = path.join(rootDir, dir);
  if (!fs.existsSync(dirPath)) {
    console.error(chalk.red(`错误: 缺少必要的目录: ${dir}`));
    dirMissing = true;
  }
}

if (dirMissing) {
  console.error(chalk.red('构建前检查失败: 缺少必要的目录'));
  process.exit(1);
} else {
  console.log(chalk.green('目录结构检查通过'));
}

// 检查必要的文件
console.log(chalk.cyan('检查必要的文件...'));
let fileMissing = false;
const missingFiles = [];

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`错误: 缺少必要的文件: ${file}`));
    fileMissing = true;
    missingFiles.push(file);
  }
}

if (fileMissing) {
  console.error(chalk.red('构建前检查失败: 缺少必要的文件'));
  console.error(chalk.red(`缺少的文件: ${missingFiles.join(', ')}`));
  process.exit(1);
} else {
  console.log(chalk.green('文件检查通过'));
}

// 检查package.json中的依赖
console.log(chalk.cyan('检查package.json中的依赖...'));
try {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // 检查必要的依赖
  const requiredDependencies = [
    '@hono/node-server',
    '@unblockneteasemusic/server',
    'axios',
    'dotenv',
    'hono'
  ];

  const missingDependencies = [];

  for (const dep of requiredDependencies) {
    if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
      console.error(chalk.red(`错误: 缺少必要的依赖: ${dep}`));
      missingDependencies.push(dep);
    }
  }

  if (missingDependencies.length > 0) {
    console.error(chalk.red('构建前检查失败: 缺少必要的依赖'));
    console.error(chalk.red(`缺少的依赖: ${missingDependencies.join(', ')}`));
    process.exit(1);
  } else {
    console.log(chalk.green('依赖检查通过'));
  }
} catch (error) {
  console.error(chalk.red(`检查package.json时出错: ${error.message}`));
  process.exit(1);
}

// 检查必要的环境变量（从.env文件或系统环境变量）
console.log(chalk.cyan('检查必要的环境变量...'));

// 检查必要的环境变量
const requiredEnvVars = [
  'PORT',
  'API_KEY',
  'AUTH_SECRET',
  'CLIENT_API_KEY'
];

const missingEnvVars = [];

// 首先检查系统环境变量
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    // 如果系统环境变量中没有，尝试从.env文件读取
    try {
      const envPath = path.join(rootDir, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        if (!envContent.includes(`${envVar} =`) && !envContent.includes(`${envVar}=`)) {
          console.error(chalk.red(`警告: 缺少环境变量: ${envVar}`));
          missingEnvVars.push(envVar);
        }
      } else {
        // 如果.env文件不存在且系统环境变量中也没有
        console.error(chalk.red(`警告: 缺少环境变量: ${envVar}`));
        missingEnvVars.push(envVar);
      }
    } catch (error) {
      console.error(chalk.red(`警告: 缺少环境变量: ${envVar}`));
      missingEnvVars.push(envVar);
    }
  }
}

if (missingEnvVars.length > 0) {
  // 在Vercel环境中，我们可能会在后续步骤中设置这些变量，所以只发出警告
  if (process.env.VERCEL) {
    console.warn(chalk.yellow('警告: 缺少一些环境变量，但在Vercel环境中构建将继续'));
    console.warn(chalk.yellow(`缺少的环境变量: ${missingEnvVars.join(', ')}`));
  } else {
    console.warn(chalk.yellow('警告: 缺少一些环境变量，但构建将继续'));
    console.warn(chalk.yellow(`缺少的环境变量: ${missingEnvVars.join(', ')}`));
  }
} else {
  console.log(chalk.green('环境变量检查通过'));
}

console.log(chalk.green('构建前检查通过，可以继续构建'));
