import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../utils/logger.js';

/**
 * 验证器函数类型
 */
export type Validator = (value: any) => { valid: boolean; message?: string; cause?: any };

/**
 * 验证器配置
 */
export interface ValidatorConfig {
  [param: string]: {
    validator: Validator;
    required?: boolean;
  };
}

/**
 * 创建参数验证中间件
 * @param config 验证器配置
 * @returns 中间件函数
 */
export function createValidator(config: ValidatorConfig) {
  return async (c: Context, next: Next) => {
    const requestId = c.get('requestId') || 'unknown';
    const params: Record<string, string | null> = {};

    // 收集所有查询参数
    for (const param in config) {
      params[param] = c.req.query(param) || null;
    }

    // 记录请求参数
    logger.debug('请求参数', {
      requestId,
      path: c.req.path,
      params: JSON.stringify(params)
    });

    // 验证参数
    for (const [param, { validator, required = false }] of Object.entries(config)) {
      const value = params[param];

      // 如果参数是必需的但未提供
      if (required && (value === null || value === undefined || value === '')) {
        logger.warn(`缺少必要参数: ${param}`, {
          requestId,
          path: c.req.path
        });

        throw new HTTPException(400, {
          message: `缺少必要参数: ${param}`
        });
      }

      // 如果参数已提供，则验证其值
      if (value !== null && value !== undefined && value !== '') {
        const result = validator(value);

        if (!result.valid) {
          logger.warn(`参数验证失败: ${param}`, {
            requestId,
            path: c.req.path,
            value,
            reason: result.message
          });

          throw new HTTPException(400, {
            message: result.message || `参数 ${param} 无效`,
            cause: result.cause
          });
        }
      }
    }

    await next();
  };
}

/**
 * 常用验证器
 */
export const validators = {
  /**
   * 验证ID是否有效
   */
  id: (value: any) => {
    // 如果是数字字符串，检查是否为正整数
    if (/^\d+$/.test(value)) {
      return {
        valid: parseInt(value, 10) > 0,
        message: 'ID必须为正整数'
      };
    }

    // 如果是其他字符串，检查长度和字符
    return {
      valid: value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(value),
      message: 'ID格式无效'
    };
  },

  /**
   * 验证音质参数
   */
  br: (allowedValues: string[]) => (value: any) => ({
    valid: allowedValues.includes(value),
    message: '无效音质参数',
    cause: { allowed_values: allowedValues }
  }),

  /**
   * 验证类型参数
   */
  type: (allowedValues: string[]) => (value: any) => ({
    valid: allowedValues.includes(value),
    message: '无效类型参数',
    cause: { allowed_values: allowedValues }
  }),

  /**
   * 验证音源参数
   */
  sources: (validSources: string[]) => (value: string) => {
    const sources = value.split(',').map(s => s.trim());

    if (sources.length === 0) {
      return {
        valid: false,
        message: '音源参数不能为空'
      };
    }

    const allValid = sources.every(source =>
      validSources.includes(source) &&
      source.length > 0 &&
      source.length <= 20
    );

    return {
      valid: allValid,
      message: '音源参数无效',
      cause: { allowed_values: validSources }
    };
  },

  /**
   * 验证搜索名称
   */
  name: (value: any) => ({
    valid: value.length > 0 && value.length <= 200,
    message: '名称格式无效'
  })
};
