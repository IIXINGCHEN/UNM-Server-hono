/**
 * UNM-Server-hono 构建后检查脚本
 *
 * 用于在构建后检查所有必要的文件是否已正确复制到目标目录
 * 如果缺少必要文件，将发出警告并提供修复建议
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

// 必要的构建输出文件列表
const requiredOutputFiles = [
  // 核心文件
  'dist/index.js',
  'dist/config/domains.js',

  // 中间件文件
  'dist/middleware/auth.js',
  'dist/middleware/domain.js',
  'dist/middleware/error-handler.js',
  'dist/middleware/json-response.js',
  'dist/middleware/metrics.js',
  'dist/middleware/rate-limiter.js',
  'dist/middleware/sanitizer.js',
  'dist/middleware/security.js',
  'dist/middleware/validator.js',

  // 路由文件
  'dist/routes/api.js',
  'dist/routes/csp-report.js',
  'dist/routes/health.js',
  'dist/routes/index.js',
  'dist/routes/metrics.js',

  // 服务文件
  'dist/services/music.js',

  // 工具文件
  'dist/utils/api-permissions.js',
  'dist/utils/auth.js',
  'dist/utils/cache.js',
  'dist/utils/ip.js',
  'dist/utils/logger.js',
  'dist/utils/package.js',
  'dist/utils/port.js', // 编译后的文件名是.js
  'dist/utils/response.js',

  // 类型定义文件
  'dist/types/context.js',

  // 公共文件
  'public/index.html',
  'public/404.html',
  'public/favicon.ico'
];

// 目录结构检查
const requiredOutputDirectories = [
  'dist',
  'dist/config',
  'dist/middleware',
  'dist/routes',
  'dist/services',
  'dist/utils',
  'dist/types',
  'public'
];

console.log(chalk.blue('=== UNM-Server 构建后检查 ==='));

// 检查目录结构
console.log(chalk.cyan('检查输出目录结构...'));
let dirMissing = false;
const missingDirs = [];

for (const dir of requiredOutputDirectories) {
  const dirPath = path.join(rootDir, dir);
  if (!fs.existsSync(dirPath)) {
    console.error(chalk.red(`错误: 缺少必要的输出目录: ${dir}`));
    dirMissing = true;
    missingDirs.push(dir);
  }
}

if (dirMissing) {
  console.error(chalk.red('构建后检查失败: 缺少必要的输出目录'));
  console.error(chalk.red(`缺少的目录: ${missingDirs.join(', ')}`));
  console.error(chalk.yellow('建议: 检查TypeScript编译配置，确保输出目录正确设置'));
} else {
  console.log(chalk.green('输出目录结构检查通过'));
}

// 检查必要的输出文件
console.log(chalk.cyan('检查必要的输出文件...'));
let fileMissing = false;
const missingFiles = [];

for (const file of requiredOutputFiles) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`错误: 缺少必要的输出文件: ${file}`));
    fileMissing = true;
    missingFiles.push(file);
  }
}

if (fileMissing) {
  console.error(chalk.red('构建后检查失败: 缺少必要的输出文件'));
  console.error(chalk.red(`缺少的文件: ${missingFiles.join(', ')}`));

  // 提供修复建议
  console.error(chalk.yellow('修复建议:'));

  // 检查是否缺少dist/config/domains.js
  if (missingFiles.includes('dist/config/domains.js')) {
    console.error(chalk.yellow('1. 确保scripts/copy-config.js脚本正确运行，复制配置文件到dist目录'));
    console.error(chalk.yellow('   可以手动运行: node scripts/copy-config.js'));
  }

  // 检查是否缺少public/favicon.ico
  if (missingFiles.includes('public/favicon.ico')) {
    console.error(chalk.yellow('2. 确保scripts/convert-favicon.js脚本正确运行，转换favicon.png到favicon.ico'));
    console.error(chalk.yellow('   可以手动运行: node scripts/convert-favicon.js'));
  }

  // 检查是否缺少TypeScript编译输出文件
  const tsMissingFiles = missingFiles.filter(file => file.startsWith('dist/') && file.endsWith('.js'));
  if (tsMissingFiles.length > 0) {
    console.error(chalk.yellow('3. 确保TypeScript编译正确完成，检查tsconfig.json配置'));
    console.error(chalk.yellow('   可以手动运行: npx tsc'));
  }
} else {
  console.log(chalk.green('输出文件检查通过'));
}

// 验证dist/index.js的完整性
console.log(chalk.cyan('验证dist/index.js的完整性...'));
try {
  const indexPath = path.join(rootDir, 'dist/index.js');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  // 检查关键导入语句
  const requiredImports = [
    'import { serve } from',
    'import { Hono } from',
    'import domainsConfig from',
    'import { router } from',
    'import { health } from',
    'import { metrics } from'
  ];

  const missingImports = [];

  for (const importStmt of requiredImports) {
    if (!indexContent.includes(importStmt)) {
      console.error(chalk.red(`错误: dist/index.js中缺少必要的导入语句: ${importStmt}`));
      missingImports.push(importStmt);
    }
  }

  if (missingImports.length > 0) {
    console.error(chalk.red('dist/index.js完整性检查失败: 缺少必要的导入语句'));
    console.error(chalk.yellow('建议: 检查src/index.ts文件，确保所有必要的导入语句都存在'));
  } else {
    console.log(chalk.green('dist/index.js完整性检查通过'));
  }
} catch (error) {
  console.error(chalk.red(`验证dist/index.js时出错: ${error.message}`));
}

// 验证dist/config/domains.js的完整性
console.log(chalk.cyan('验证dist/config/domains.js的完整性...'));
try {
  const domainsPath = path.join(rootDir, 'dist/config/domains.js');
  const domainsContent = fs.readFileSync(domainsPath, 'utf-8');

  // 检查关键内容
  const requiredContent = [
    'allowedDomains',
    'allowedDomainsString',
    'export default'
  ];

  const missingContent = [];

  for (const content of requiredContent) {
    if (!domainsContent.includes(content)) {
      console.error(chalk.red(`错误: dist/config/domains.js中缺少必要的内容: ${content}`));
      missingContent.push(content);
    }
  }

  if (missingContent.length > 0) {
    console.error(chalk.red('dist/config/domains.js完整性检查失败: 缺少必要的内容'));
    console.error(chalk.yellow('建议: 检查src/config/domains.ts文件，确保所有必要的内容都存在'));
  } else {
    console.log(chalk.green('dist/config/domains.js完整性检查通过'));
  }
} catch (error) {
  console.error(chalk.red(`验证dist/config/domains.js时出错: ${error.message}`));
}

// 总结
if (dirMissing || fileMissing) {
  console.log(chalk.red('构建后检查发现问题，请查看上面的错误信息和修复建议'));
  // 不退出进程，只发出警告
} else {
  console.log(chalk.green('构建后检查通过，所有必要的文件都已正确复制到目标目录'));
}

// 启动验证建议
console.log(chalk.cyan('建议执行以下命令验证构建结果:'));
console.log(chalk.cyan('pnpm start'));
