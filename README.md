<!-- Thanks to https://zhconvert.org's Chinese (China) converter ! -->

<img src="./public/favicon.png" alt="logo" width="140" height="140" align="right">

# UNM-Server-hono

匹配网易云无法播放歌曲 (基于Hono框架重构版)

## 特性

- 支持多个音源，替换变灰歌曲链接
- 使用Hono框架重构，提高性能和可维护性
- 使用TypeScript提供类型安全
- 保持与原版API完全兼容
- **增强的安全特性**：
  - 请求ID跟踪
  - 安全HTTP头
  - 速率限制
  - API密钥验证
  - API鉴权机制
  - HTTPS重定向
  - 域名验证
  - 输入验证
  - 安全的错误处理
  - 请求超时控制
  - 日志脱敏

## 运行

```js
// 安装依赖
pnpm install

// 开发模式运行
pnpm dev

// 构建
pnpm build

// 生产环境运行
pnpm start
```

## 反向代理

> 如需使用该功能，需要自行部署 [siteproxy](https://github.com/netptop/siteproxy)

如需在前端页面中使用，则可能会有部分音源的 `url` 不支持 `https`，则此时可以使用反向代理来解决（请在 `.env` 文件中填入部署后的接口地址）

## 使用

```http
GET https://example.com/api/match?id=1962165898&server=kuwo,kugou,bilibili
```

> 注意：所有API接口路径前缀为 `/api`

### 参数

| 参数   | 默认           |
| ------ | -------------- |
| id     | /              |
| server | 见下方音源清单 |

### 音源清单

| 名称                        | 代号         | 默认启用 | 注意事项                                                    |
| --------------------------- | ------------ | -------- | ----------------------------------------------------------- |
| QQ 音乐                     | `qq`         |          | 需要准备自己的 `QQ_COOKIE`                                  |
| 酷狗音乐                    | `kugou`      | ✅       |                                                             |
| 酷我音乐                    | `kuwo`       | ✅       |                                                             |
| 咪咕音乐                    | `migu`       | ✅       | 需要准备自己的 `MIGU_COOKIE`                                |
| JOOX                        | `joox`       |          | 需要准备自己的 `JOOX_COOKIE`，似乎有严格地区限制。          |
| YouTube（纯 JS 解析方式）   | `youtube`    |          | 需要 Google 认定的**非中国大陆区域** IP 地址。              |
| yt-download                 | `ytdownload` |          | **似乎不能使用**。                                          |
| YouTube（通过 `youtube-dl`) | `youtubedl`  |          | 需要自行安装 `youtube-dl`。                                 |
| YouTube（通过 `yt-dlp`)     | `ytdlp`      | ✅       | 需要自行安装 `yt-dlp`（`youtube-dl` 仍在活跃维护的 fork）。 |
| B 站音乐                    | `bilibili`   | ✅       |                                                             |
| 第三方网易云 API            | `pyncmd`     |          |                                                             |

## 重构内容

- [x] 从Koa框架迁移到Hono框架
- [x] 使用TypeScript重写所有代码
- [x] 保持API接口兼容性
- [x] 优化项目结构
- [x] 优化错误处理
- [x] 增强安全性
- [ ] 添加缓存机制
- [ ] 添加更多单元测试

## 安全配置

在 `.env` 文件中可以配置以下安全相关选项：

```bash
# 安全配置
NODE_ENV = production  # 生产环境设置为 production
RATE_LIMIT = 100       # 每IP每分钟最大请求数
API_KEY = ""           # 服务器API密钥，用于高权限操作，不应暴露给前端
CLIENT_API_KEY = ""    # 客户端API密钥，用于前端访问低权限API
AUTH_SECRET = ""       # API鉴权密钥，用于生成和验证鉴权参数
ENABLE_HTTPS = false   # 是否强制使用HTTPS
LOG_LEVEL = info       # 日志级别: debug, info, warn, error
ALLOW_CDN = true       # 是否允许加载CDN资源
```

### 安全最佳实践

在生产环境中部署时，建议遵循以下安全最佳实践：

1. **设置强密码的 API 密钥**：
   - 生成一个强随机字符串作为 API_KEY（服务器密钥）
   - 生成一个不同的强随机字符串作为 CLIENT_API_KEY（客户端密钥）
   - 确保服务器密钥不会暴露给前端
2. **设置强密码的鉴权密钥**：生成一个强随机字符串作为 AUTH_SECRET
3. **限制允许的域名**：设置 ALLOWED_DOMAIN 为特定域名，避免使用通配符 '*'
4. **启用 HTTPS**：设置 ENABLE_HTTPS=true 并确保服务器配置了有效的 SSL 证书
5. **设置合理的速率限制**：根据预期流量调整 RATE_LIMIT 值
6. **使用反向代理**：在前端使用 Nginx 或 Apache 作为反向代理，增加额外的安全层
7. **定期更新依赖**：使用 `pnpm audit` 检查并修复安全漏洞
8. **监控与日志**：定期检查日志文件，监控异常访问模式和认证失败事件

## API认证与鉴权

系统实现了客户端密钥和服务器密钥分离模式，通过两个不同的环境变量来管理API访问权限：

1. **CLIENT_API_KEY**：客户端API密钥，用于前端访问低权限API
2. **API_KEY**：服务器API密钥，用于服务器间通信和高权限操作

### API权限级别

系统定义了三个API权限级别：

1. **PUBLIC**：公开API，无需任何密钥即可访问
   - 例如：`/api/config`、`/api/csp-report`

2. **CLIENT**：客户端API，需要客户端API密钥
   - 例如：`/api/info`、`/api/auth`、`/api/search`、`/api/match`
   - 客户端API密钥和服务器API密钥都可以访问

3. **SERVER**：服务器API，需要服务器API密钥
   - 例如：`/api/ncmget`、`/api/otherget`（涉及音乐资源获取）
   - 只有服务器API密钥可以访问

### 请求鉴权

以下API请求需要额外的鉴权参数：

- 获取音乐URL (type=url)
- 获取封面图片 (type=pic)
- 获取歌词 (type=lrc)

鉴权参数有效期为300秒，过期后需要重新生成。

#### 鉴权参数格式

```
auth=签名|时间戳|随机数
```

签名由服务器使用HMAC-SHA256算法生成，包含时间戳和随机数以防止重放攻击。

#### 获取鉴权参数的步骤

1. 获取API密钥（通过 `/api/config` 接口）
2. 使用API密钥调用 `/api/auth` 接口获取鉴权参数
3. 将获取的鉴权参数添加到实际API请求中

```javascript
// 示例代码
async function getApiKey(apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const response = await fetch(`${apiBaseUrl}/api/config`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`获取API密钥失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const apiKey = data.apiKey || (data.data?.apiKey);

    if (!apiKey) {
      throw new Error('API密钥不存在');
    }

    return apiKey;
  } catch (error) {
    console.error('获取API密钥错误:', error);
    throw error;
  }
}

async function getAuthParam(apiKey, path, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // 尝试解析错误响应
      try {
        const errorData = await response.json();
        throw new Error(`获取鉴权参数失败: ${errorData.message || `${response.status} ${response.statusText}`}`);
      } catch (parseError) {
        throw new Error(`获取鉴权参数失败: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    const authParam = data.auth || (data.data?.auth);

    if (!authParam) {
      throw new Error('鉴权参数不存在');
    }

    return authParam;
  } catch (error) {
    console.error('获取鉴权参数错误:', error);
    throw error;
  }
}

async function callApi(apiKey, path, authParam, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${apiBaseUrl}${path}${separator}auth=${encodeURIComponent(authParam)}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // 尝试解析错误响应
      try {
        const errorData = await response.json();
        throw new Error(`API请求失败: ${errorData.message || `${response.status} ${response.statusText}`}`);
      } catch (parseError) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('API请求错误:', error);
    throw error;
  }
}
```

#### 命令行工具

项目提供了一个命令行工具，用于生成鉴权参数：

```bash
# 构建项目
pnpm build

# 生成鉴权参数
node scripts/generate-auth.js /api/ncmget id=1962165898&type=url
```

#### 示例请求

```http
GET https://example.com/api/ncmget?id=1962165898&type=url&auth=签名|时间戳|随机数
X-API-Key: your_api_key
Accept: application/json
```

### API 响应格式

所有 API 响应均使用 JSON UTF-8 格式返回，并设置了正确的 Content-Type 头：

```
Content-Type: application/json; charset=utf-8
```

#### 成功响应示例

```json
{
  "code": 200,
  "message": "操作成功",
  "requestId": "6cbef6b7-8381-4468-8c8d-6a7de2aaf01c",
  "data": {
    // 具体数据
  }
}
```

#### 错误响应示例

```json
{
  "code": 401,
  "message": "API密钥验证失败",
  "requestId": "6cbef6b7-8381-4468-8c8d-6a7de2aaf01c"
}
```

常见的错误状态码：

- `400`: 请求参数错误
- `401`: 认证失败（API密钥无效或缺失）
- `403`: 权限不足
- `404`: 资源不存在
- `429`: 请求过于频繁（触发速率限制）
- `500`: 服务器内部错误