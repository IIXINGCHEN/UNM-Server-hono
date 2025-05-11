/**
 * 参数规范化中间件
 * 
 * 用于清理和规范化请求参数，防止XSS和注入攻击
 */

import { Context, Next } from 'hono';
import { logger } from '../utils/logger.js';

// 规范化配置接口
interface SanitizeConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array';
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: string[];
    transform?: (value: string) => string;
  };
}

/**
 * HTML转义函数
 * @param str 需要转义的字符串
 * @returns 转义后的字符串
 */
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * SQL注入防护函数
 * @param str 需要检查的字符串
 * @returns 清理后的字符串
 */
export const preventSqlInjection = (str: string): string => {
  // 移除SQL注入相关的关键字和字符
  return str
    .replace(/(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|UNION|CREATE|WHERE)(\b)/gi, '')
    .replace(/[;'"`\\]/g, '');
};

/**
 * 创建参数规范化中间件
 * @param config 规范化配置
 * @param source 参数来源
 * @returns 中间件函数
 */
export const createSanitizer = (
  config: SanitizeConfig,
  source: 'query' | 'body' | 'params' = 'query'
) => {
  return async (c: Context, next: Next) => {
    // 获取数据源
    let data: Record<string, any>;
    if (source === 'query') {
      // 创建一个可修改的查询参数对象
      data = Object.fromEntries(
        new URL(c.req.url).searchParams.entries()
      );
    } else if (source === 'params') {
      data = { ...c.req.param() };
    } else {
      // body需要在调用前通过c.req.json()解析
      try {
        const body = await c.req.json();
        data = { ...body };
      } catch (error) {
        // 如果解析失败，使用空对象
        data = {};
      }
    }
    
    // 规范化每个参数
    for (const [param, paramConfig] of Object.entries(config)) {
      if (data[param] !== undefined) {
        let value = data[param];
        
        // 根据类型进行转换
        if (paramConfig.type === 'string') {
          // 确保是字符串
          value = String(value);
          
          // 应用最大长度限制
          if (paramConfig.maxLength && value.length > paramConfig.maxLength) {
            value = value.substring(0, paramConfig.maxLength);
          }
          
          // 应用正则表达式模式
          if (paramConfig.pattern && !paramConfig.pattern.test(value)) {
            // 如果不匹配模式，使用空字符串或允许的值中的第一个
            value = paramConfig.allowedValues ? paramConfig.allowedValues[0] : '';
          }
          
          // 检查是否在允许的值列表中
          if (paramConfig.allowedValues && !paramConfig.allowedValues.includes(value)) {
            // 如果不在允许的值列表中，使用列表中的第一个值
            value = paramConfig.allowedValues[0];
          }
          
          // 应用自定义转换函数
          if (paramConfig.transform) {
            value = paramConfig.transform(value);
          }
          
          // 默认应用HTML转义和SQL注入防护
          value = escapeHtml(value);
          value = preventSqlInjection(value);
        } else if (paramConfig.type === 'number') {
          // 转换为数字
          const num = Number(value);
          value = isNaN(num) ? 0 : num;
        } else if (paramConfig.type === 'boolean') {
          // 转换为布尔值
          value = Boolean(value);
        } else if (paramConfig.type === 'array') {
          // 确保是数组
          if (!Array.isArray(value)) {
            // 如果是字符串，尝试按逗号分割
            if (typeof value === 'string') {
              value = value.split(',').map(v => v.trim());
            } else {
              value = [value];
            }
          }
          
          // 应用最大长度限制
          if (paramConfig.maxLength && value.length > paramConfig.maxLength) {
            value = value.slice(0, paramConfig.maxLength);
          }
          
          // 对数组中的每个元素应用字符串规范化
          if (paramConfig.type === 'array') {
            value = value.map((v: string) => {
              let item = String(v);
              
              // 应用正则表达式模式
              if (paramConfig.pattern && !paramConfig.pattern.test(item)) {
                item = paramConfig.allowedValues ? paramConfig.allowedValues[0] : '';
              }
              
              // 检查是否在允许的值列表中
              if (paramConfig.allowedValues && !paramConfig.allowedValues.includes(item)) {
                item = paramConfig.allowedValues[0];
              }
              
              // 应用自定义转换函数
              if (paramConfig.transform) {
                item = paramConfig.transform(item);
              }
              
              // 默认应用HTML转义和SQL注入防护
              item = escapeHtml(item);
              item = preventSqlInjection(item);
              
              return item;
            });
          }
        }
        
        // 更新数据源中的值
        data[param] = value;
      }
    }
    
    // 将规范化后的数据保存到上下文中
    if (source === 'query') {
      c.set('sanitizedQuery', data);
    } else if (source === 'params') {
      c.set('sanitizedParams', data);
    } else {
      c.set('sanitizedBody', data);
    }
    
    await next();
  };
};

/**
 * 常用规范化配置
 */
export const sanitizers = {
  /**
   * ID参数规范化配置
   */
  id: {
    type: 'string' as const,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_-]+$/
  },
  
  /**
   * 音质参数规范化配置
   */
  br: {
    type: 'string' as const,
    allowedValues: ['128', '192', '320', '740', '999']
  },
  
  /**
   * 类型参数规范化配置
   */
  type: {
    type: 'string' as const,
    allowedValues: ['url', 'pic', 'lrc']
  },
  
  /**
   * 音源参数规范化配置
   */
  source: {
    type: 'string' as const,
    allowedValues: ['kuwo', 'kugou', 'migu', 'qq', 'bilibili']
  },
  
  /**
   * 搜索名称规范化配置
   */
  name: {
    type: 'string' as const,
    maxLength: 200,
    transform: (value: string) => value.trim()
  },
  
  /**
   * 服务器参数规范化配置
   */
  server: {
    type: 'array' as const,
    maxLength: 10,
    allowedValues: ['pyncmd', 'kuwo', 'bilibili', 'migu', 'kugou', 'qq']
  }
};
