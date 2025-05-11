/**
 * Vercel 特定的构建脚本
 *
 * 此脚本用于在 Vercel 环境中确保正确的构建过程
 * 主要解决以下问题：
 * 1. 确保使用 pnpm 作为包管理器
 * 2. 确保配置文件正确复制到 dist 目录
 * 3. 确保静态文件正确处理
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前文件的目录路径
// __dirname 在 CommonJS 中已经可用

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 检查是否在 Vercel 环境中运行
const isVercel = process.env.VERCEL === '1';

console.log(`正在 ${isVercel ? 'Vercel' : '本地'} 环境中运行构建脚本...`);

// 主函数
async function main() {
  try {
    // 1. 确保目录结构
    ensureDirectories();

    // 2. 运行构建命令
    runBuild();

    // 3. 确保配置文件复制
    ensureConfigFiles();

    // 4. 验证构建结果
    validateBuild();

    console.log('Vercel 构建脚本执行成功！');
  } catch (error) {
    console.error('Vercel 构建脚本执行失败:', error);
    process.exit(1);
  }
}

// 确保必要的目录结构存在
function ensureDirectories() {
  console.log('确保目录结构...');

  const directories = [
    'dist',
    'dist/config',
    'dist/middleware',
    'dist/routes',
    'dist/services',
    'dist/utils',
    'dist/types'
  ];

  for (const dir of directories) {
    const dirPath = path.join(rootDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`创建目录: ${dirPath}`);
    }
  }
}

// 运行构建命令
function runBuild() {
  console.log('运行构建命令...');

  try {
    // 运行 TypeScript 编译
    execSync('npx typescript@latest --version', { stdio: 'inherit', cwd: rootDir });
    execSync('npx typescript@latest --build tsconfig.json', { stdio: 'inherit', cwd: rootDir });
    console.log('TypeScript 编译完成');

    // 运行 favicon 转换
    execSync('node scripts/convert-favicon.js', { stdio: 'inherit', cwd: rootDir });
    console.log('Favicon 转换完成');

    // 运行配置文件复制
    execSync('node scripts/copy-config.js', { stdio: 'inherit', cwd: rootDir });
    console.log('配置文件复制完成');
  } catch (error) {
    console.error('构建命令执行失败:', error);
    throw error;
  }
}

// 确保配置文件正确复制
function ensureConfigFiles() {
  console.log('确保配置文件正确复制...');

  const srcConfigDir = path.join(rootDir, 'src', 'config');
  const distConfigDir = path.join(rootDir, 'dist', 'config');

  // 确保目标目录存在
  if (!fs.existsSync(distConfigDir)) {
    fs.mkdirSync(distConfigDir, { recursive: true });
  }

  // 手动复制配置文件
  try {
    const files = fs.readdirSync(srcConfigDir);
    const jsFiles = files.filter(file => file.endsWith('.js'));

    for (const file of jsFiles) {
      const srcPath = path.join(srcConfigDir, file);
      const distPath = path.join(distConfigDir, file);

      fs.copyFileSync(srcPath, distPath);
      console.log(`手动复制文件: ${srcPath} -> ${distPath}`);
    }

    // 确保Vercel静态目录存在
    const vercelPublicDir = path.join(rootDir, '.vercel', 'output', 'static');
    if (!fs.existsSync(vercelPublicDir)) {
      fs.mkdirSync(vercelPublicDir, { recursive: true });
      console.log(`创建Vercel静态目录: ${vercelPublicDir}`);
    }

    // 复制所有public目录下的文件到Vercel静态目录
    const publicDir = path.join(rootDir, 'public');

    // 递归复制函数
    function copyRecursive(src, dest) {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();

      if (isDirectory) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }

        fs.readdirSync(src).forEach(childItemName => {
          copyRecursive(
            path.join(src, childItemName),
            path.join(dest, childItemName)
          );
        });
      } else {
        fs.copyFileSync(src, dest);
        console.log(`复制文件: ${src} -> ${dest}`);
      }
    }

    // 复制public目录到Vercel静态目录
    copyRecursive(publicDir, vercelPublicDir);
    console.log('所有静态文件已复制到Vercel部署目录');
  } catch (error) {
    console.error('复制配置文件时出错:', error);
    throw error;
  }
}

// 验证构建结果
function validateBuild() {
  console.log('验证构建结果...');

  // 检查关键文件是否存在
  const requiredFiles = [
    'dist/index.js',
    'dist/config/domains.js'
  ];

  const missingFiles = [];

  for (const file of requiredFiles) {
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`错误: 缺少必要的文件: ${file}`);
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`构建验证失败: 缺少必要的文件: ${missingFiles.join(', ')}`);
  }

  console.log('构建验证通过');
}

// 执行主函数
main();
