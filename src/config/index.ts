// src/config/index.ts

// 导入 dotenv 用于从 .env 文件加载环境变量
import dotenv from 'dotenv';
// 导入 Joi 用于环境变量的结构校验 (也可以换用 Zod)
import Joi from 'joi';
// 导入 path 用于解析文件路径
import path from 'path';

// 配置 dotenv，使其加载项目根目录下的 .env 文件
// __dirname 指向当前文件(config/index.ts)所在的目录 (src/config)
// path.resolve 解析出绝对路径: /path/to/project/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 定义环境变量的接口，明确每个变量的类型
// 这有助于 TypeScript 进行类型检查
interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test'; // 运行环境
  PORT: number; // 服务监听端口
  ALLOWED_DOMAINS: string[]; // 允许的 CORS 域名列表 (从逗号分隔字符串解析而来)
  PROXY_URL?: string; // 可选的代理服务器 URL
  ENABLE_FLAC: boolean; // 是否启用 FLAC 音质 (来自原配置)
  SELECT_MAX_BR: boolean; // 是否选择最高比特率 (来自原配置)
  FOLLOW_SOURCE_ORDER: boolean; // 是否按顺序匹配音源 (来自原配置)
  NETEASE_COOKIE?: string; // 可选的网易云 Cookie
  JOOX_COOKIE?: string; // 可选的 JOOX Cookie
  MIGU_COOKIE?: string; // 可选的咪咕 Cookie
  QQ_COOKIE?: string; // 可选的 QQ Cookie
  YOUTUBE_KEY?: string; // 可选的 YouTube API Key
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'; // 日志级别
  API_GDSTUDIO_URL: string; // 外部 API 的基础 URL
}

// 使用 Joi 定义环境变量的校验 Schema
// Joi.object<EnvironmentVariables>() 指定了校验结果应符合的环境变量接口
const envVarsSchema = Joi.object<EnvironmentVariables>({
  // NODE_ENV: 必须是 'development', 'production', 'test' 之一, 默认为 'development'
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  // PORT: 必须是数字, 默认为 5678
  PORT: Joi.number().default(5678),
  // ALLOWED_DOMAINS: 必须是字符串, 不能为空, 用于描述目的 (后续会解析)
  ALLOWED_DOMAINS: Joi.string().required().description('Comma separated list of allowed domains for CORS'),
  // PROXY_URL: 可选字符串, 必须是有效的 http 或 https URL, 可以为空字符串
  PROXY_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').optional(),
  // ENABLE_FLAC: 必须是布尔值, 默认为 true
  ENABLE_FLAC: Joi.boolean().default(true),
  // SELECT_MAX_BR: 必须是布尔值, 默认为 true
  SELECT_MAX_BR: Joi.boolean().default(true),
  // FOLLOW_SOURCE_ORDER: 必须是布尔值, 默认为 true
  FOLLOW_SOURCE_ORDER: Joi.boolean().default(true),
  // NETEASE_COOKIE: 可选字符串, 可以为空
  NETEASE_COOKIE: Joi.string().allow('').optional(),
  // JOOX_COOKIE: 可选字符串, 可以为空
  JOOX_COOKIE: Joi.string().allow('').optional(),
  // MIGU_COOKIE: 可选字符串, 可以为空
  MIGU_COOKIE: Joi.string().allow('').optional(),
  // QQ_COOKIE: 可选字符串, 可以为空
  QQ_COOKIE: Joi.string().allow('').optional(),
  // YOUTUBE_KEY: 可选字符串, 可以为空
  YOUTUBE_KEY: Joi.string().allow('').optional(),
  // LOG_LEVEL: 必须是指定的日志级别之一, 默认为 'info'
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent').default('info'),
  // API_GDSTUDIO_URL: 必须是有效的 URI 字符串, 默认为指定地址
  API_GDSTUDIO_URL: Joi.string().uri().default('https://music-api.gdstudio.xyz/api.php'),
})
// .unknown(true) 允许存在 Schema 中未定义的其他环境变量 (例如系统变量)
.unknown(true);

// 使用 process.env (Node.js 提供的环境变量对象) 对 Schema 进行校验
// .prefs({ errors: { label: 'key' } }) 配置 Joi 在报错时使用环境变量名作为标签
const { error, value: validatedEnvVars } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

// 如果校验出错 (例如缺少必要变量或类型错误), 抛出错误, 阻止应用启动
if (error) {
  throw new Error(`❌ Config validation error: ${error.message}`);
}

// 特殊处理: 将逗号分隔的 ALLOWED_DOMAINS 字符串解析为字符串数组
// 先检查是否存在, 然后用 ',' 分割, trim() 去除两端空格, filter() 移除空字符串
const parsedAllowedDomains = validatedEnvVars.ALLOWED_DOMAINS
  ? validatedEnvVars.ALLOWED_DOMAINS.split(',').map(domain => domain.trim()).filter(domain => domain.length > 0)
  : ['*']; // 如果解析失败或原始字符串为空, 默认允许所有 ('*')

// 创建最终的配置对象, 类型为 EnvironmentVariables
const config: EnvironmentVariables = {
  // 展开所有已校验和设置默认值的环境变量
  ...validatedEnvVars,
  // 使用解析后的 ALLOWED_DOMAINS 数组覆盖原始字符串
  ALLOWED_DOMAINS: parsedAllowedDomains,
};

// 默认导出最终的配置对象, 供应用其他部分导入使用
export default config;
