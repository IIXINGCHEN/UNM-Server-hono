/**
 * Vercel 特定的构建辅助脚本 (CommonJS 格式)
 * 
 * 此脚本用于在 Vercel 环境中确保正确的构建过程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 项目根目录
const rootDir = process.cwd();

// 检查是否在 Vercel 环境中运行
const isVercel = process.env.VERCEL === '1';

console.log(`正在 ${isVercel ? 'Vercel' : '本地'} 环境中运行构建辅助脚本...`);

// 主函数
function main() {
  try {
    // 1. 确保目录结构
    ensureDirectories();
    
    // 2. 确保配置文件复制
    ensureConfigFiles();
    
    // 3. 验证构建结果
    validateBuild();
    
    console.log('Vercel 构建辅助脚本执行成功！');
  } catch (error) {
    console.error('Vercel 构建辅助脚本执行失败:', error);
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
