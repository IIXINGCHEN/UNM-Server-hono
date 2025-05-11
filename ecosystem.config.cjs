// 读取.env文件并解析环境变量
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
  "PORT": processEnvValue(envConfig.PORT) || "5678",
  "API_KEY": processEnvValue(envConfig.API_KEY) || "",
  "AUTH_SECRET": processEnvValue(envConfig.AUTH_SECRET) || "",
  "CLIENT_API_KEY": processEnvValue(envConfig.CLIENT_API_KEY) || "",
  "ALLOWED_DOMAIN": processEnvValue(envConfig.ALLOWED_DOMAIN) || "*.ixincghen.org.cn,*.axincghen.com,*.ixincghen.top,*.imixc.top,localhost,127.0.0.1",
  "ENABLE_HTTPS": processEnvValue(envConfig.ENABLE_HTTPS) || "false",
  "RATE_LIMIT": processEnvValue(envConfig.RATE_LIMIT) || "300",
  "ALLOW_CDN": processEnvValue(envConfig.ALLOW_CDN) || "true",
  "ENABLE_FLAC": processEnvValue(envConfig.ENABLE_FLAC) || "true",
  "SELECT_MAX_BR": processEnvValue(envConfig.SELECT_MAX_BR) || "true",
  "FOLLOW_SOURCE_ORDER": processEnvValue(envConfig.FOLLOW_SOURCE_ORDER) || "true",
  "MUSIC_API_URL": processEnvValue(envConfig.MUSIC_API_URL) || "https://music-api.gdstudio.xyz/api.php",
  "LOG_LEVEL": processEnvValue(envConfig.LOG_LEVEL) || "info",
  "PROXY_URL": processEnvValue(envConfig.PROXY_URL) || "",
  "NETEASE_COOKIE": processEnvValue(envConfig.NETEASE_COOKIE) || "",
  "JOOX_COOKIE": processEnvValue(envConfig.JOOX_COOKIE) || "",
  "MIGU_COOKIE": processEnvValue(envConfig.MIGU_COOKIE) || "",
  "QQ_COOKIE": processEnvValue(envConfig.QQ_COOKIE) || "",
  "YOUTUBE_KEY": processEnvValue(envConfig.YOUTUBE_KEY) || ""
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
}