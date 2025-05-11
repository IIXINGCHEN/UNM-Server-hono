#!/usr/bin/env node

/**
 * UNM-Server-hono 生产环境部署脚本 (ES模块版本)
 *
 * 此脚本用于安全地部署应用到生产环境，包括：
 * - 环境准备和验证
 * - 安全配置生成
 * - 依赖安装
 * - 应用构建
 * - 应用启动
 * - 基本健康检查
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import readline from 'readline';
import os from 'os';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出函数
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// 日志函数
const log = {
    info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
    success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
    warn: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
    error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
    step: (message) => console.log(`\n${colors.cyan}[STEP]${colors.reset} ${message}`),
    security: (message) => console.log(`${colors.magenta}[SECURITY]${colors.reset} ${message}`)
};

// 创建用户交互界面
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 询问用户问题
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// 生成随机密钥
const generateSecureKey = (length = 32) => {
    return crypto.randomBytes(Math.ceil(length * 3 / 4))
        .toString('base64')
        .slice(0, length)
        .replace(/\+/g, '!')
        .replace(/\//g, '@')
        .replace(/=/g, '_');
};

// 检查Node.js版本
const checkNodeVersion = () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion < 16) {
        log.error(`需要Node.js v16或更高版本，当前版本: ${nodeVersion}`);
        process.exit(1);
    }

    log.success(`Node.js版本检查通过: ${nodeVersion}`);
};

// 检查pnpm是否安装
const checkPnpm = () => {
    try {
        const pnpmVersion = execSync('pnpm --version', { stdio: 'pipe' }).toString().trim();
        log.success(`pnpm版本检查通过: ${pnpmVersion}`);
    } catch (error) {
        log.error('未检测到pnpm，请先安装pnpm: npm install -g pnpm');
        process.exit(1);
    }
};

// 检查项目文件
const checkProjectFiles = () => {
    const requiredFiles = ['package.json', 'tsconfig.json', 'src/index.ts'];

    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            log.error(`缺少必要的项目文件: ${file}`);
            process.exit(1);
        }
    }

    log.success('项目文件检查通过');
};

// 创建或更新.env文件
const setupEnvFile = async (isInteractive = true) => {
    const envPath = path.join(process.cwd(), '.env');

    // 直接使用指定的环境变量内容
    const envContent = `# 服务端口
PORT = 5678

# 允许的域名 (生产环境应设置为具体域名，多个域名用逗号分隔)
ALLOWED_DOMAIN = 'example.com,api.example.com,localhost,127.0.0.1'

# 是否开启接口反代（若无需接口则不填）
PROXY_URL = https://vcproxy.imixc.top

# 安全配置
NODE_ENV = production  # 生产环境设置为 production
RATE_LIMIT = 100       # 每IP每分钟最大请求数
API_KEY = "strong_api_key_for_production"  # API访问密钥，生产环境必须设置
AUTH_SECRET = "strong_auth_secret_for_production"  # API鉴权密钥，用于生成和验证鉴权参数
ENABLE_HTTPS = true    # 是否强制使用HTTPS
LOG_LEVEL = info       # 日志级别: debug, info, warn, error
ALLOW_CDN = true       # 是否允许加载CDN资源（如Tailwind、Font Awesome等）

# 音乐API地址
MUSIC_API_URL = https://music-api.gdstudio.xyz/api.php

### UnblockNeteaseMusic 设置项
## 歌曲启用无损音质
ENABLE_FLAC = true
## 启用无损音质时，是否选择音质最高的
SELECT_MAX_BR = true
## 严格按照配置音源设置顺序进行匹配
FOLLOW_SOURCE_ORDER = true
## Cookie设置项; 推荐在Vercel等平台进行环境变量的设置或者设置github secret
# 网易云 cookie
# 格式：MUSIC_U=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NETEASE_COOKIE = ""
# JOOX cookie
# 格式：JOOX_COOKIE="wmid=<your_wmid>; session_key=<your_session_key>"
JOOX_COOKIE	= ""
# 咪咕 cookie
# 格式：MIGU_COOKIE="<your_aversionid>"
MIGU_COOKIE	= ""
# qq cookie
# 格式：QQ_COOKIE="uin=<your_uin>; qm_keyst=<your_qm_keyst>"
QQ_COOKIE = ""
# Youtube 密钥
# 格式：YOUTUBE_KEY="<your_data_api_key>"
YOUTUBE_KEY = ""`;

    // 写入.env文件
    fs.writeFileSync(envPath, envContent);
    log.success('.env文件已更新为指定内容');

    // 显示安全提示
    log.security('API密钥和鉴权密钥已设置，请妥善保管这些密钥');
    log.security('不要将.env文件提交到版本控制系统');

    // 解析环境变量以返回
    const envVars = {
        PORT: '5678',
        ALLOWED_DOMAIN: 'example.com,api.example.com,localhost,127.0.0.1',
        PROXY_URL: 'https://vcproxy.imixc.top',
        NODE_ENV: 'production',
        RATE_LIMIT: '100',
        API_KEY: 'strong_api_key_for_production',
        AUTH_SECRET: 'strong_auth_secret_for_production',
        ENABLE_HTTPS: 'true',
        LOG_LEVEL: 'info',
        ALLOW_CDN: 'true',
        MUSIC_API_URL: 'https://music-api.gdstudio.xyz/api.php',
        ENABLE_FLAC: 'true',
        SELECT_MAX_BR: 'true',
        FOLLOW_SOURCE_ORDER: 'true',
        NETEASE_COOKIE: '',
        JOOX_COOKIE: '',
        MIGU_COOKIE: '',
        QQ_COOKIE: '',
        YOUTUBE_KEY: ''
    };

    return envVars;
};

// 安装依赖
const installDependencies = () => {
    log.step('安装项目依赖');

    try {
        // 首先安装所有依赖（包括开发依赖）用于构建
        log.info('执行: pnpm install');
        execSync('pnpm install', { stdio: 'inherit' });
        log.success('依赖安装完成');
    } catch (error) {
        log.error('依赖安装失败');
        log.error(error.message);
        process.exit(1);
    }
};

// 构建项目
const buildProject = () => {
    log.step('构建项目');

    try {
        log.info('执行: pnpm build');
        execSync('pnpm build', { stdio: 'inherit' });
        log.success('项目构建完成');

        // 构建完成后，重新安装仅生产依赖，以减小生产环境的依赖大小
        log.info('执行: pnpm install --prod');
        execSync('pnpm install --prod', { stdio: 'inherit' });
        log.success('生产依赖安装完成');
    } catch (error) {
        log.error('项目构建失败');
        log.error(error.message);
        process.exit(1);
    }
};

// 创建PM2配置文件
const createPM2Config = (envVars) => {
    log.step('创建PM2配置文件');

    // 注意：pm2Config变量不再直接使用，而是通过模板字符串生成配置文件

    // 创建logs目录
    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs', { recursive: true });
    }

    // 创建动态读取.env的PM2配置文件
    const pm2ConfigTemplate = `// 读取.env文件并解析环境变量
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 尝试加载.env文件
let envConfig = {};
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envConfig = dotenv.parse(envFile);
    console.log('成功从.env文件加载配置');
  } else {
    console.warn('.env文件不存在，将使用默认配置');
  }
} catch (error) {
  console.error('加载.env文件时出错:', error);
}

// 处理环境变量中的引号
const processEnvValue = (value) => {
  if (typeof value !== 'string') return value;

  // 移除值两端的单引号或双引号
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  } else if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
};

// 构建环境变量配置
const envVars = {
  "NODE_ENV": processEnvValue(envConfig.NODE_ENV) || "production",
  "PORT": processEnvValue(envConfig.PORT) || "${envVars.PORT || '5678'}",
  "API_KEY": processEnvValue(envConfig.API_KEY) || "${envVars.API_KEY || ''}",
  "AUTH_SECRET": processEnvValue(envConfig.AUTH_SECRET) || "${envVars.AUTH_SECRET || ''}",
  "CLIENT_API_KEY": processEnvValue(envConfig.CLIENT_API_KEY) || "${envVars.CLIENT_API_KEY || ''}",
  "ALLOWED_DOMAIN": processEnvValue(envConfig.ALLOWED_DOMAIN) || "${envVars.ALLOWED_DOMAIN || '*.ixincghen.org.cn,*.axincghen.com,*.ixincghen.top,*.imixc.top,localhost,127.0.0.1'}",
  "ENABLE_HTTPS": processEnvValue(envConfig.ENABLE_HTTPS) || "${envVars.ENABLE_HTTPS || 'false'}",
  "RATE_LIMIT": processEnvValue(envConfig.RATE_LIMIT) || "${envVars.RATE_LIMIT || '300'}",
  "ALLOW_CDN": processEnvValue(envConfig.ALLOW_CDN) || "${envVars.ALLOW_CDN || 'true'}",
  "ENABLE_FLAC": processEnvValue(envConfig.ENABLE_FLAC) || "${envVars.ENABLE_FLAC || 'true'}",
  "SELECT_MAX_BR": processEnvValue(envConfig.SELECT_MAX_BR) || "${envVars.SELECT_MAX_BR || 'true'}",
  "FOLLOW_SOURCE_ORDER": processEnvValue(envConfig.FOLLOW_SOURCE_ORDER) || "${envVars.FOLLOW_SOURCE_ORDER || 'true'}",
  "MUSIC_API_URL": processEnvValue(envConfig.MUSIC_API_URL) || "${envVars.MUSIC_API_URL || 'https://music-api.gdstudio.xyz/api.php'}",
  "LOG_LEVEL": processEnvValue(envConfig.LOG_LEVEL) || "${envVars.LOG_LEVEL || 'info'}",
  "PROXY_URL": processEnvValue(envConfig.PROXY_URL) || "${envVars.PROXY_URL || ''}",
  "NETEASE_COOKIE": processEnvValue(envConfig.NETEASE_COOKIE) || "${envVars.NETEASE_COOKIE || ''}",
  "JOOX_COOKIE": processEnvValue(envConfig.JOOX_COOKIE) || "${envVars.JOOX_COOKIE || ''}",
  "MIGU_COOKIE": processEnvValue(envConfig.MIGU_COOKIE) || "${envVars.MIGU_COOKIE || ''}",
  "QQ_COOKIE": processEnvValue(envConfig.QQ_COOKIE) || "${envVars.QQ_COOKIE || ''}",
  "YOUTUBE_KEY": processEnvValue(envConfig.YOUTUBE_KEY) || "${envVars.YOUTUBE_KEY || ''}"
};

module.exports = {
  "apps": [
    {
      "name": "unm-server",
      "script": "dist/index.js",
      "instances": 1,
      "exec_mode": "fork",
      "env": envVars,
      "max_memory_restart": "500M",
      "log_date_format": "YYYY-MM-DD HH:mm:ss",
      "error_file": "logs/error.log",
      "out_file": "logs/output.log",
      "merge_logs": true,
      "log_type": "json",
      "watch": false,
      "max_restarts": 10,
      "restart_delay": 5000
    }
  ]
}`;

    // 写入PM2配置文件
    fs.writeFileSync('ecosystem.config.cjs', pm2ConfigTemplate);
    log.success('PM2配置文件已创建: ecosystem.config.cjs');
    log.info('配置文件已设置为动态读取.env文件');
};

// 检查PM2是否安装
const checkPM2 = () => {
    try {
        const pm2Version = execSync('pm2 --version', { stdio: 'pipe' }).toString().trim();
        log.success(`PM2版本检查通过: ${pm2Version}`);
        return true;
    } catch (error) {
        log.warn('未检测到PM2，将使用node直接启动');
        return false;
    }
};

// 启动应用
const startApp = (hasPM2) => {
    log.step('启动应用');

    if (hasPM2) {
        try {
            log.info('使用PM2启动应用');
            execSync('pm2 start ecosystem.config.cjs', { stdio: 'inherit' });
            log.success('应用已通过PM2启动');

            // 显示应用状态
            log.info('PM2应用状态:');
            execSync('pm2 status', { stdio: 'inherit' });
        } catch (error) {
            log.error('PM2启动应用失败');
            log.error(error.message);
            process.exit(1);
        }
    } else {
        log.info('使用node直接启动应用');
        log.info('注意: 这种方式不提供进程管理，建议在生产环境使用PM2');

        const nodeProcess = spawn('node', ['dist/index.js'], {
            detached: true,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });

        nodeProcess.on('error', (error) => {
            log.error(`启动应用失败: ${error.message}`);
            process.exit(1);
        });

        log.success('应用已启动');
    }
};

// 健康检查
const healthCheck = async (envVars) => {
    log.step('执行健康检查');

    // 等待服务器启动
    log.info('等待服务器启动...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const port = envVars.PORT || '5678';
    const url = `http://localhost:${port}`;

    try {
        log.info(`检查服务器是否响应: ${url}`);

        // 使用curl或wget检查服务器是否响应
        let command = '';
        if (process.platform === 'win32') {
            command = `curl -s -o nul -w "%%{http_code}" ${url}`;
        } else {
            command = `curl -s -o /dev/null -w "%{http_code}" ${url}`;
        }

        const statusCode = execSync(command, { stdio: 'pipe' }).toString().trim();

        if (statusCode === '200') {
            log.success(`健康检查通过: 服务器返回状态码 ${statusCode}`);
        } else {
            log.warn(`健康检查警告: 服务器返回状态码 ${statusCode}`);
        }
    } catch (error) {
        log.error('健康检查失败: 无法连接到服务器');
        log.error('请检查服务器日志以获取更多信息');
    }
};

// 显示系统信息
const showSystemInfo = () => {
    log.step('系统信息');

    const systemInfo = {
        platform: os.platform(),
        release: os.release(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
        freemem: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
        uptime: `${Math.round(os.uptime() / 3600)} hours`
    };

    console.log(JSON.stringify(systemInfo, null, 2));
};

// 显示部署摘要
const showDeploySummary = (envVars) => {
    log.step('部署摘要');

    console.log(`
${colors.green}部署完成!${colors.reset}

${colors.cyan}应用信息:${colors.reset}
- 名称: UNM-Server-hono
- 环境: ${colors.green}生产环境${colors.reset}
- 端口: ${envVars.PORT}
- 允许的域名: ${envVars.ALLOWED_DOMAIN || '无限制'}
- HTTPS: ${envVars.ENABLE_HTTPS === 'true' ? colors.green + '启用' + colors.reset : colors.yellow + '禁用' + colors.reset}
- API速率限制: ${envVars.RATE_LIMIT} 请求/分钟

${colors.cyan}访问地址:${colors.reset}
- 本地: http://localhost:${envVars.PORT}
${envVars.ALLOWED_DOMAIN ? `- 生产: ${envVars.ENABLE_HTTPS === 'true' ? 'https' : 'http'}://${envVars.ALLOWED_DOMAIN.split(',')[0]}` : ''}

${colors.cyan}管理命令:${colors.reset}
${checkPM2() ? `- 查看状态: ${colors.green}pm2 status${colors.reset}
- 查看日志: ${colors.green}pm2 logs unm-server${colors.reset}
- 重启应用: ${colors.green}pm2 restart unm-server${colors.reset}
- 停止应用: ${colors.green}pm2 stop unm-server${colors.reset}` : `- 停止应用: ${colors.green}使用进程管理器停止Node.js进程${colors.reset}`}

${colors.cyan}安全提示:${colors.reset}
- API密钥和鉴权密钥已设置，请妥善保管
- 不要将.env文件提交到版本控制系统
- 定期更换API密钥和鉴权密钥
- 考虑设置防火墙规则，只允许必要的端口访问

${colors.cyan}下一步:${colors.reset}
- 设置反向代理（如Nginx）以提供HTTPS支持
- 配置域名解析
- 设置监控和告警
- 配置自动备份
  `);
};

// 主函数
const main = async () => {
    console.log(`
${colors.cyan}========================================${colors.reset}
${colors.green}UNM-Server-hono 生产环境部署脚本${colors.reset}
${colors.cyan}========================================${colors.reset}
`);

    try {
        // 检查环境
        log.step('环境检查');
        checkNodeVersion();
        checkPnpm();
        checkProjectFiles();

        // 显示系统信息
        showSystemInfo();

        // 设置环境变量
        const envVars = await setupEnvFile(true);

        // 安装依赖
        installDependencies();

        // 构建项目
        buildProject();

        // 创建PM2配置
        const hasPM2 = checkPM2();
        if (hasPM2) {
            createPM2Config(envVars);
        }

        // 启动应用
        startApp(hasPM2);

        // 健康检查
        await healthCheck(envVars);

        // 显示部署摘要
        showDeploySummary(envVars);

    } catch (error) {
        log.error(`部署过程中出现错误: ${error.message}`);
        process.exit(1);
    } finally {
        // 关闭readline接口
        rl.close();
    }
};

// 执行主函数
main();