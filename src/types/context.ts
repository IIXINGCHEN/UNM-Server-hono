// 扩展Hono的ContextVariableMap接口，以支持自定义上下文变量
import { ContextVariableMap } from 'hono';

// 声明模块以扩展Hono的ContextVariableMap接口
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    // 可以在这里添加更多的上下文变量
  }
}
