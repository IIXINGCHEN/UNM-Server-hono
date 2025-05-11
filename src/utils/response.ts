import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from './logger.js';

/**
 * API响应结构
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  requestId: string;
  data?: T;
}

/**
 * 创建成功响应
 * @param c Hono上下文
 * @param data 响应数据
 * @param message 响应消息
 * @returns JSON响应
 */
export function createSuccessResponse<T>(
  c: Context,
  data: T,
  message: string = '请求成功'
): Response {
  const requestId = c.get('requestId') || 'unknown';

  const response: ApiResponse<T> = {
    code: 200,
    message,
    requestId,
    data
  };

  return c.json(response, 200, {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

/**
 * 创建错误响应
 * @param c Hono上下文
 * @param status HTTP状态码
 * @param message 错误消息
 * @param cause 错误原因
 * @returns JSON响应
 */
export function createErrorResponse(
  c: Context,
  status: number = 500,
  message: string = '服务器内部错误',
  cause?: Record<string, any>
): Response {
  const requestId = c.get('requestId') || 'unknown';

  const response: ApiResponse = {
    code: status,
    message,
    requestId
  };

  // 在开发环境中，添加错误原因
  if (process.env.NODE_ENV === 'development' && cause) {
    response.data = { error: cause };
  }

  return c.json(response, status as any, {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

/**
 * 处理API请求的包装函数
 * @param c Hono上下文
 * @param handler 处理函数
 * @returns 处理结果
 */
export async function handleApiRequest<T>(
  c: Context,
  handler: () => Promise<T>
): Promise<Response> {
  try {
    const result = await handler();
    return createSuccessResponse(c, result);
  } catch (error) {
    // 如果已经是HTTP异常，转换为JSON响应
    if (error instanceof HTTPException) {
      const requestId = c.get('requestId') || 'unknown';
      return c.json({
        code: error.status,
        message: error.message || '请求处理失败',
        requestId
      }, error.status, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    // 记录错误
    logger.error('API请求处理失败', error as Error, {
      path: c.req.path,
      method: c.req.method,
      query: Object.fromEntries(new URL(c.req.url).searchParams.entries())
    });

    // 返回错误响应
    return createErrorResponse(
      c,
      500,
      (error as Error).message || '服务器处理请求失败'
    );
  }
}

/**
 * 验证请求参数
 * @param params 参数对象
 * @param validators 验证器对象
 * @returns 如果验证成功，返回 { valid: true }，否则返回错误对象
 */
export function validateParams(
  params: Record<string, any>,
  validators: Record<string, (value: any) => { valid: boolean; message?: string; cause?: any }>
): { valid: boolean; status?: number; message?: string; cause?: any } {
  for (const [key, validator] of Object.entries(validators)) {
    const value = params[key];
    const result = validator(value);

    if (!result.valid) {
      // 不再抛出异常，而是返回一个错误对象，由调用者处理
      return {
        valid: false,
        status: 400,
        message: result.message || `参数 ${key} 无效`,
        cause: result.cause
      };
    }
  }

  // 所有验证通过
  return { valid: true };
}

/**
 * 常用参数验证器
 */
export const validators = {
  /**
   * 验证ID是否有效
   */
  id: (value: any) => {
    if (!value) {
      return { valid: false, message: '缺少必要参数ID' };
    }

    // 如果是数字字符串，检查是否为正整数
    if (/^\d+$/.test(value)) {
      return { valid: parseInt(value, 10) > 0, message: 'ID必须为正整数' };
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
  br: (allowedValues: string[]) => (value: any) => {
    if (!value) {
      return { valid: true }; // br是可选参数
    }

    return {
      valid: allowedValues.includes(value),
      message: '无效音质参数',
      cause: { allowed_values: allowedValues }
    };
  },

  /**
   * 验证类型参数
   */
  type: (allowedValues: string[]) => (value: any) => {
    if (!value) {
      return { valid: true }; // type是可选参数
    }

    return {
      valid: allowedValues.includes(value),
      message: '无效类型参数',
      cause: { allowed_values: allowedValues }
    };
  },

  /**
   * 验证音源参数
   */
  sources: (value: string[]) => {
    const validSources = [
      "pyncmd", "kuwo", "bilibili", "migu", "kugou",
      "qq", "youtube", "youtube-dl", "yt-dlp", "joox"
    ];

    if (value.length === 0) {
      return { valid: false, message: '音源参数不能为空' };
    }

    const allValid = value.every(source =>
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
  name: (value: any) => {
    if (!value) {
      return { valid: false, message: '缺少必要参数名称' };
    }

    return {
      valid: value.length > 0 && value.length <= 200,
      message: '名称格式无效'
    };
  }
};
