/**
 * UNM-Server-hono 域名配置文件
 * 
 * 此文件用于集中管理所有允许访问的域名
 * 在生产环境中应设置为具体域名，避免使用通配符
 */

// 允许的域名列表
export const allowedDomains = [
  // 主域名
  '*.ixincghen.org.cn',
  '*.axincghen.com',
  '*.ixincghen.top',
  '*.imixc.top',
  
  // 本地开发域名
  'localhost',
  '127.0.0.1'
];

// 将域名列表转换为逗号分隔的字符串，用于环境变量
export const allowedDomainsString = allowedDomains.join(',');

// 导出默认配置
export default {
  allowedDomains,
  allowedDomainsString
};
