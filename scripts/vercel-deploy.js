/**
 * Vercel 部署准备脚本
 *
 * 此脚本用于准备 Vercel 部署所需的文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

console.log('准备 Vercel 部署...');

// 1. 确保已构建
if (!fs.existsSync(path.join(rootDir, 'dist', 'index.js'))) {
  console.log('项目尚未构建，开始构建...');
  execSync('pnpm build', { stdio: 'inherit' });
}

// 2. 复制 vercel-package.json 到 .vercel/package.json
const vercelDir = path.join(rootDir, '.vercel');
if (!fs.existsSync(vercelDir)) {
  fs.mkdirSync(vercelDir, { recursive: true });
}

try {
  const packageJson = fs.readFileSync(path.join(rootDir, 'vercel-package.json'), 'utf-8');
  fs.writeFileSync(path.join(vercelDir, 'package.json'), packageJson);
  console.log('已复制 vercel-package.json 到 .vercel/package.json');
} catch (error) {
  console.error('复制 package.json 失败:', error);
}

// 3. 确保 .vercel/output 目录存在
const outputDir = path.join(vercelDir, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 3.1 确保 .vercel/output/static 目录存在
const staticDir = path.join(outputDir, 'static');
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

// 4. 复制 dist 目录到 .vercel/output/dist
const distDir = path.join(rootDir, 'dist');
const outputDistDir = path.join(outputDir, 'dist');

if (fs.existsSync(distDir)) {
  // 如果输出目录已存在，先删除
  if (fs.existsSync(outputDistDir)) {
    fs.rmSync(outputDistDir, { recursive: true, force: true });
  }

  // 复制目录
  fs.mkdirSync(outputDistDir, { recursive: true });

  // 复制文件
  const copyDir = (src, dest) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  copyDir(distDir, outputDistDir);
  console.log('已复制 dist 目录到 .vercel/output/dist');
} else {
  console.error('dist 目录不存在，请先构建项目');
  process.exit(1);
}

// 5. 复制 public 目录到 .vercel/output/static
const publicDir = path.join(rootDir, 'public');
const outputPublicDir = path.join(outputDir, 'static');

if (fs.existsSync(publicDir)) {
  // 如果输出目录已存在，先删除
  if (fs.existsSync(outputPublicDir)) {
    fs.rmSync(outputPublicDir, { recursive: true, force: true });
  }

  // 复制目录
  fs.mkdirSync(outputPublicDir, { recursive: true });

  // 复制文件
  const copyDir = (src, dest) => {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  copyDir(publicDir, outputPublicDir);
  console.log('已复制 public 目录到 .vercel/output/static');
} else {
  console.error('public 目录不存在');
  process.exit(1);
}

// 6. 创建 .vercel/output/config.json
const configJson = {
  "version": 3,
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/dist/index.js"
    },
    {
      "src": "/health",
      "dest": "/dist/index.js"
    },
    {
      "src": "/metrics",
      "dest": "/dist/index.js"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "ALLOWED_DOMAIN": "*.ixincghen.org.cn,*.axincghen.com,*.ixincghen.top,*.imixc.top,localhost,127.0.0.1",
    "RATE_LIMIT": "300",
    "ENABLE_HTTPS": "false",
    "LOG_LEVEL": "info",
    "ALLOW_CDN": "true",
    "ENABLE_FLAC": "true",
    "SELECT_MAX_BR": "true",
    "FOLLOW_SOURCE_ORDER": "true",
    "MUSIC_API_URL": "https://music-api.gdstudio.xyz/api.php"
  }
};

fs.writeFileSync(path.join(outputDir, 'config.json'), JSON.stringify(configJson, null, 2));
console.log('已创建 .vercel/output/config.json');

console.log('Vercel 部署准备完成，可以使用 vercel --prod 命令部署');
