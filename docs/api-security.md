# API安全架构文档

## 概述

本文档描述了UNM-Server-hono项目的API安全架构，包括客户端密钥和服务器密钥分离模式的实现、API权限级别系统以及相关的安全增强措施。

## 安全架构设计

### 密钥分离模式

系统实现了客户端密钥和服务器密钥分离模式，通过两个不同的环境变量来管理API访问权限：

1. **CLIENT_API_KEY**：客户端API密钥，用于前端访问低权限API
2. **API_KEY**：服务器API密钥，用于服务器间通信和高权限操作

这种分离模式确保即使客户端API密钥泄露，攻击者也无法访问高权限API，从而提高系统的整体安全性。

### API权限级别系统

系统定义了三个API权限级别：

1. **PUBLIC**：公开API，无需任何密钥即可访问
   - 例如：`/api/config`、`/api/csp-report`

2. **CLIENT**：客户端API，需要客户端API密钥
   - 例如：`/api/info`、`/api/auth`、`/api/search`
   - 客户端API密钥和服务器API密钥都可以访问

3. **SERVER**：服务器API，需要服务器API密钥
   - 例如：`/api/match`、`/api/ncmget`、`/api/otherget`（涉及音乐资源获取）
   - 只有服务器API密钥可以访问

### 安全增强措施

1. **严格的来源验证**：
   - 使用完整URL匹配而非部分匹配
   - 验证Origin和Referer头
   - 生产环境中强制执行严格验证

2. **请求频率限制**：
   - 使用令牌桶算法实现更精确的请求限流
   - 针对IP地址进行限制
   - 可配置的限制阈值

3. **防重放保护**：
   - 鉴权参数包含时间戳和随机数
   - 验证时间戳有效期
   - 缓存已使用的随机数防止重放攻击

## 环境变量配置

在`.env`文件中配置以下安全相关选项：

```bash
# 安全配置
NODE_ENV = production  # 生产环境设置为 production
RATE_LIMIT = 100       # 每IP每分钟最大请求数
API_KEY = ""           # 服务器API密钥，用于高权限操作，不应暴露给前端
CLIENT_API_KEY = ""    # 客户端API密钥，用于前端访问低权限API
AUTH_SECRET = ""       # API鉴权密钥，用于生成和验证鉴权参数
ENABLE_HTTPS = true    # 是否强制使用HTTPS
LOG_LEVEL = info       # 日志级别: debug, info, warn, error
ALLOW_CDN = true       # 是否允许加载CDN资源
```

## API认证流程

### 前端认证流程

1. 前端通过`/api/config`接口获取客户端API密钥
2. 使用客户端API密钥调用`/api/auth`接口获取鉴权参数
3. 将客户端API密钥和鉴权参数一起使用，调用其他API接口

示例代码：

```javascript
// 1. 获取客户端API密钥
const configResponse = await fetch('/api/config');
const configData = await configResponse.json();
const clientApiKey = configData.data.apiKey;

// 2. 获取鉴权参数
const authResponse = await fetch(`/api/auth?path=/api/match?type=url&id=416892104`, {
  headers: {
    'X-API-Key': clientApiKey
  }
});
const authData = await authResponse.json();
const authParam = authData.data.auth;

// 3. 调用API接口
const apiResponse = await fetch(`/api/match?type=url&id=416892104&auth=${encodeURIComponent(authParam)}`, {
  headers: {
    'X-API-Key': clientApiKey
  }
});
const apiData = await apiResponse.json();
```

### 服务器间认证流程

服务器间通信应使用服务器API密钥，并遵循相同的鉴权流程：

```javascript
// 使用服务器API密钥
const serverApiKey = process.env.API_KEY;

// 获取鉴权参数
const authResponse = await fetch(`https://api.example.com/api/auth?path=/api/match?type=url&id=416892104`, {
  headers: {
    'X-API-Key': serverApiKey
  }
});
const authData = await authResponse.json();
const authParam = authData.data.auth;

// 调用API接口
const apiResponse = await fetch(`https://api.example.com/api/match?type=url&id=416892104&auth=${encodeURIComponent(authParam)}`, {
  headers: {
    'X-API-Key': serverApiKey
  }
});
const apiData = await apiResponse.json();
```

## 安全最佳实践

1. **密钥管理**：
   - 生成强随机字符串作为API_KEY和CLIENT_API_KEY
   - 定期轮换密钥
   - 不要在代码中硬编码密钥

2. **环境隔离**：
   - 开发环境和生产环境使用不同的密钥
   - 生产环境中启用所有安全措施

3. **监控与日志**：
   - 监控API请求频率和模式
   - 记录所有认证失败事件
   - 设置异常访问告警

4. **部署安全**：
   - 使用HTTPS加密所有API通信
   - 配置适当的CORS策略
   - 使用反向代理增加额外的安全层

## 故障排除

### 常见问题

1. **API密钥验证失败**：
   - 检查环境变量是否正确配置
   - 确认请求头中的`X-API-Key`是否正确
   - 验证是否使用了正确的密钥类型（客户端/服务器）

2. **鉴权参数验证失败**：
   - 检查鉴权参数是否过期（有效期300秒）
   - 确认查询参数与生成鉴权参数时使用的完全一致
   - 验证AUTH_SECRET是否正确配置

### 调试工具

系统提供了一个命令行工具，用于生成鉴权参数：

```bash
# 构建项目
pnpm build

# 生成鉴权参数
node scripts/generate-auth.js /api/match id=1962165898&type=url
```

## 安全更新日志

- **2023-10-15**: 初始安全架构实现
- **2024-07-01**: 实现客户端密钥和服务器密钥分离模式
- **2024-07-01**: 增强来源验证机制
- **2024-07-01**: 改进API权限级别系统
