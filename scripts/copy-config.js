/**
 * UNM-Server-hono 配置文件复制脚本
 *
 * 用于在构建过程中复制配置文件到dist目录
 * 这是必要的，因为TypeScript编译器不会自动复制.js文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 源目录和目标目录
const srcConfigDir = path.join(rootDir, 'src', 'config');
const distConfigDir = path.join(rootDir, 'dist', 'config');

// 确保目标目录存在
if (!fs.existsSync(distConfigDir)) {
  fs.mkdirSync(distConfigDir, { recursive: true });
  console.log(`创建目录: ${distConfigDir}`);
}

// 复制配置文件
try {
  // 读取源目录中的所有文件
  const files = fs.readdirSync(srcConfigDir);
  
  // 过滤出.js文件
  const jsFiles = files.filter(file => file.endsWith('.js'));
  
  // 复制每个.js文件
  for (const file of jsFiles) {
    const srcPath = path.join(srcConfigDir, file);
    const distPath = path.join(distConfigDir, file);
    
    fs.copyFileSync(srcPath, distPath);
    console.log(`复制文件: ${srcPath} -> ${distPath}`);
  }
  
  console.log('配置文件复制完成');
} catch (error) {
  console.error('复制配置文件时出错:', error);
  process.exit(1);
}
