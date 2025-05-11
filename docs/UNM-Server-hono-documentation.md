# UNM-Server-hono 文档

## 目录

- [项目概述](#项目概述)
- [部署指南](#部署指南)
  - [环境要求](#环境要求)
  - [本地部署](#本地部署)
  - [Docker部署](#docker部署)
  - [Vercel部署](#vercel部署)
  - [PM2部署](#pm2部署)
  - [环境变量配置](#环境变量配置)
- [API接口文档](#api接口文档)
  - [认证机制](#认证机制)
  - [接口列表](#接口列表)
  - [错误处理](#错误处理)
- [在Vue中调用API](#在vue中调用api)
  - [基本用法](#基本用法)
  - [认证流程](#认证流程)
  - [完整示例](#完整示例)
- [安全最佳实践](#安全最佳实践)

## 项目概述

UNM-Server-hono 是一个基于 Hono 框架重构的网易云音乐解灰服务，支持多个音源替换变灰歌曲链接。项目使用 TypeScript 提供类型安全，并保持与原版 API 完全兼容。

> **⚠️ 重要提示**：本项目**必须**使用 pnpm 作为包管理工具，不支持使用 npm 或 yarn。这是因为项目的依赖关系和脚本都是基于 pnpm 设计的，使用其他包管理工具可能导致依赖解析问题或脚本执行失败。

主要特性：
- 支持多个音源，替换变灰歌曲链接
- 使用 Hono 框架重构，提高性能和可维护性
- 使用 TypeScript 提供类型安全
- 保持与原版 API 完全兼容
- 增强的安全特性

## 部署指南

### 环境要求

- Node.js 18.x 或更高版本
- pnpm 8.x 或更高版本 (⚠️ **必须使用 pnpm 管理项目，不支持 npm 或 yarn**)

### 本地部署

1. 确保已安装 pnpm：

```bash
# 检查 pnpm 是否已安装
pnpm --version

# 如果未安装，使用 npm 安装 pnpm
npm install -g pnpm
```

2. 克隆仓库并安装依赖：

```bash
git clone https://github.com/your-username/UNM-Server-hono.git
cd UNM-Server-hono
pnpm install
```

3. 创建并配置环境变量文件：

```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的环境变量
```

4. 构建并启动服务：

```bash
pnpm build
pnpm start
```

服务将在 `http://localhost:5678` 上运行。

### Docker部署

1. 使用提供的 Dockerfile 构建镜像：

```bash
docker build -t unm-server-hono .
```

2. 运行容器：

```bash
docker run -d -p 5678:5678 \
  -e API_KEY="your_api_key" \
  -e AUTH_SECRET="your_auth_secret" \
  -e ALLOWED_DOMAIN="your-domain.com" \
  -e ENABLE_HTTPS="true" \
  --name unm-server-hono \
  unm-server-hono
```

### Vercel部署

项目已配置 `vercel.json`，可以直接部署到 Vercel：

1. 配置 pnpm 全局 bin 目录：

```bash
# 将 pnpm 全局 bin 目录添加到 PATH
pnpm config set global-bin-dir "C:\Users\<用户名>\AppData\Roaming\pnpm"
# 将上面的路径添加到系统环境变量 PATH 中
```

2. 使用 pnpm 安装 Vercel CLI：

```bash
pnpm add -g vercel
```

3. 登录 Vercel 并部署：

```bash
# 登录 Vercel
vercel login

# 部署项目
vercel
```

4. 在 Vercel 控制台中配置环境变量：
   - `API_KEY`：API访问密钥
   - `AUTH_SECRET`：API鉴权密钥
   - `ALLOWED_DOMAIN`：允许的域名
   - `MUSIC_API_URL`：音乐API地址
   - 其他必要的环境变量

> **注意**：如果遇到 Vercel CLI 安装问题，可以使用 Vercel 网页界面部署。将项目推送到 GitHub，然后在 Vercel 控制台导入该仓库。

### PM2部署

使用 PM2 进行生产环境部署：

1. 使用 pnpm 安装 PM2：

```bash
pnpm add -g pm2
```

2. 使用项目提供的部署脚本：

```bash
# 先构建项目
pnpm build

# 运行部署脚本
node scripts/deploy-production.js
```

或者手动创建 PM2 配置：

```bash
# 先构建项目
pnpm build

# 使用 PM2 启动
pm2 start ecosystem.config.cjs
```

> **重要**：确保在部署前使用 `pnpm install` 安装所有依赖，并使用 `pnpm build` 构建项目。

### 环境变量配置

主要环境变量说明：

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| PORT | 服务端口 | 5678 | 否 |
| ALLOWED_DOMAIN | 允许的域名 | * | 是(生产环境) |
| PROXY_URL | 接口反代地址 | - | 否 |
| NODE_ENV | 环境模式 | production | 是 |
| RATE_LIMIT | 速率限制 | 100 | 否 |
| API_KEY | API访问密钥 | - | 是(生产环境) |
| AUTH_SECRET | API鉴权密钥 | - | 是(生产环境) |
| ENABLE_HTTPS | 是否强制HTTPS | false | 否 |
| LOG_LEVEL | 日志级别 | info | 否 |
| ALLOW_CDN | 是否允许CDN | true | 否 |
| MUSIC_API_URL | 音乐API地址 | - | 是 |
| ENABLE_FLAC | 启用无损音质 | true | 否 |

### 域名配置

项目支持两种方式配置允许的域名：

1. **通过配置文件（推荐）**：
   - 编辑 `src/config/domains.js` 文件，添加或修改允许的域名列表
   - 配置文件中的域名列表优先级高于环境变量

   ```javascript
   // src/config/domains.js
   export const allowedDomains = [
     '*.example.com',
     'api.example.com',
     'localhost',
     '127.0.0.1'
   ];

   export const allowedDomainsString = allowedDomains.join(',');

   export default {
     allowedDomains,
     allowedDomainsString
   };
   ```

2. **通过环境变量**：
   - 设置 `ALLOWED_DOMAIN` 环境变量，多个域名用逗号分隔
   - 仅当配置文件不存在或无法加载时使用

   ```
   ALLOWED_DOMAIN = 'example.com,api.example.com,localhost,127.0.0.1'
   ```

> **注意**：在生产环境中，应设置具体的域名列表，避免使用通配符 `*`，以提高安全性。

## API接口文档

### 认证机制

API 使用两层认证机制：

1. **API密钥认证**：通过 HTTP 头 `X-API-Key` 或查询参数 `api_key` 提供
2. **请求鉴权**：对特定接口需要提供鉴权参数 `auth`

#### API密钥认证

系统实现了客户端密钥和服务器密钥分离模式，通过两个不同的环境变量来管理API访问权限：

1. **CLIENT_API_KEY**：客户端API密钥，用于前端访问低权限API
2. **API_KEY**：服务器API密钥，用于服务器间通信和高权限操作

API权限级别分为三类：

1. **PUBLIC**：公开API，无需任何密钥即可访问
   - 例如：`/api/config`、`/api/csp-report`

2. **CLIENT**：客户端API，需要客户端API密钥
   - 例如：`/api/info`、`/api/auth`、`/api/search`、`/api/match`
   - 客户端API密钥和服务器API密钥都可以访问

3. **SERVER**：服务器API，需要服务器API密钥
   - 例如：`/api/ncmget`、`/api/otherget`（涉及音乐资源获取）
   - 只有服务器API密钥可以访问

所有非公开API请求都需要提供API密钥：

```http
GET /api/info HTTP/1.1
Host: example.com
X-API-Key: your_api_key
```

或者：

```http
GET /api/info?api_key=your_api_key HTTP/1.1
Host: example.com
```

#### 请求鉴权

以下API请求需要额外的鉴权参数：
- 获取音乐URL (`type=url`)
- 获取封面图片 (`type=pic`)
- 获取歌词 (`type=lrc`)

鉴权参数格式：`auth=签名|时间戳|随机数`

鉴权参数有效期为300秒，过期后需要重新生成。签名由服务器使用HMAC-SHA256算法生成，包含时间戳和随机数以防止重放攻击。

获取鉴权参数的步骤：
1. 获取API密钥（通过 `/api/config` 接口）
2. 使用API密钥调用 `/api/auth` 接口获取鉴权参数
3. 将获取的鉴权参数添加到实际API请求中

### 接口列表

#### 1. 获取配置信息

```http
GET /api/config
```

返回服务器配置信息，包括 API 密钥和版本号。

#### 2. 获取鉴权参数

```http
GET /api/auth?path=/api/match?type=url&id=416892104
X-API-Key: your_api_key
```

返回用于指定路径的鉴权参数。

#### 3. 匹配音乐

```http
GET /api/match?type=url&id=416892104&auth=your_auth_param
X-API-Key: your_api_key
```

参数：
- `id`：音乐ID（必填）
- `type`：请求类型，可选值：`url`、`pic`、`lrc`（默认：`url`）
- `server`：音源列表，多个音源用逗号分隔（可选）
- `auth`：鉴权参数（必填）

#### 4. 网易云音乐获取

```http
GET /api/ncmget?id=416892104&type=url&br=320&auth=your_auth_param
X-API-Key: your_api_key
```

参数：
- `id`：音乐ID（必填）
- `type`：请求类型，可选值：`url`、`pic`、`lrc`（默认：`url`）
- `br`：比特率，可选值：`128`、`192`、`320`、`740`、`999`（默认：`320`）
- `auth`：鉴权参数（必填）

#### 5. 其他音源音乐获取

```http
GET /api/otherget?source=kuwo&id=416892104&type=url&auth=your_auth_param
X-API-Key: your_api_key
```

参数：
- `id`：音乐ID（可选）
- `name`：音乐名称（可选）
- `source`：音源，可选值：`kuwo`、`kugou`、`migu`、`qq`、`bilibili`（必填）
- `type`：请求类型，可选值：`url`、`pic`、`lrc`（默认：`url`）
- `br`：比特率，可选值：`128`、`192`、`320`、`740`、`999`（默认：`320`）
- `auth`：鉴权参数（必填）

#### 6. 搜索音乐

```http
GET /api/search?name=起风了&source=kuwo&auth=your_auth_param
X-API-Key: your_api_key
```

参数：
- `name`：搜索关键词（必填）
- `source`：音源，可选值：`kuwo`、`kugou`、`migu`、`qq`、`bilibili`（默认：`kuwo`）
- `auth`：鉴权参数（必填）

#### 7. 获取服务信息

```http
GET /api/info?auth=your_auth_param
X-API-Key: your_api_key
```

返回服务器版本信息。

### 错误处理

API 返回统一的错误格式，所有API响应都使用JSON UTF-8格式：

```json
{
  "code": 401,
  "message": "API密钥验证失败",
  "requestId": "6cbef6b7-8381-4468-8c8d-6a7de2aaf01c"
}
```

所有API响应都设置了正确的Content-Type头：

```
Content-Type: application/json; charset=utf-8
```

常见的错误状态码：

- `400`: 请求参数错误
- `401`: 认证失败（API密钥无效或缺失）
- `403`: 权限不足
- `404`: 资源不存在
- `429`: 请求过于频繁（触发速率限制）
- `500`: 服务器内部错误

## 在Vue中调用API

### 基本用法

在 Vue 项目中调用 API 的基本流程：

1. 获取 API 密钥（通过 `/api/config` 接口）
2. 获取鉴权参数（通过 `/api/auth` 接口）
3. 调用实际 API 接口（如 `/api/match`, `/api/ncmget` 等）

### 认证流程

```javascript
// 1. 获取API密钥
async function getApiKey(apiBaseUrl = 'https://your-api-domain.com') {
  try {
    const response = await fetch(`${apiBaseUrl}/api/config`);
    if (!response.ok) {
      throw new Error(`获取API密钥失败: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // 从响应中提取API密钥（支持两种响应格式）
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

// 2. 获取鉴权参数
async function getAuthParam(apiKey, path, apiBaseUrl = 'https://your-api-domain.com') {
  try {
    // 使用实际的服务器URL作为基础URL
    const response = await fetch(`${apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`获取鉴权参数失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 从响应中提取鉴权参数
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

// 3. 调用实际API
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

### 完整示例

以下是在 Vue 3 组件中使用 API 的完整示例：

```vue
<template>
  <div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="song-player">
      <h2>{{ songInfo.name }}</h2>
      <p v-if="songInfo.artist">{{ songInfo.artist }}</p>
      <p v-if="songInfo.source" class="source">来源: {{ songInfo.source }}</p>

      <div class="player-controls">
        <audio v-if="songInfo.url" controls :src="songInfo.url" @error="handlePlayError"></audio>
        <div v-else class="no-url">音频链接未找到</div>
      </div>

      <div class="media-container">
        <img v-if="songInfo.pic" :src="songInfo.pic" alt="封面" class="cover" />
        <div v-if="songInfo.lrc" class="lyrics">
          <h3>歌词</h3>
          <pre>{{ songInfo.lrc }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';

export default {
  props: {
    songId: {
      type: String,
      required: true
    },
    apiBaseUrl: {
      type: String,
      default: 'https://your-api-domain.com'
    }
  },
  setup(props) {
    const loading = ref(true);
    const error = ref(null);
    const songInfo = reactive({
      id: props.songId,
      name: '未知歌曲',
      artist: '',
      url: '',
      pic: '',
      lrc: '',
      source: ''
    });

    let apiKey = '';

    onMounted(async () => {
      try {
        // 1. 获取API密钥
        apiKey = await getApiKey(props.apiBaseUrl);
        console.log('API密钥获取成功');

        // 2. 获取音乐信息
        await Promise.all([
          fetchMusicUrl(),
          fetchMusicPic(),
          fetchMusicLrc()
        ]);

        loading.value = false;
      } catch (err) {
        console.error('加载失败:', err);
        error.value = `加载失败: ${err.message}`;
        loading.value = false;
      }
    });

    // 获取API密钥
    async function getApiKey() {
      const response = await fetch(`${props.apiBaseUrl}/api/config`);
      if (!response.ok) {
        throw new Error(`获取API密钥失败: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      // 从响应中提取API密钥（支持两种响应格式）
      const key = data.apiKey || (data.data?.apiKey);

      if (!key) {
        throw new Error('API密钥不存在');
      }

      return key;
    }

    // 获取音乐URL
    async function fetchMusicUrl() {
      try {
        const path = `/api/match?type=url&id=${props.songId}`;

        // 获取鉴权参数
        const authResponse = await fetch(`${props.apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!authResponse.ok) {
          throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const authParam = authData.auth || (authData.data?.auth);

        if (!authParam) {
          throw new Error('鉴权参数不存在');
        }

        // 调用音乐URL API
        const musicResponse = await fetch(`${props.apiBaseUrl}${path}&auth=${encodeURIComponent(authParam)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!musicResponse.ok) {
          throw new Error(`获取音乐URL失败: ${musicResponse.status} ${musicResponse.statusText}`);
        }

        const musicData = await musicResponse.json();
        const data = musicData.data || musicData;

        // 更新歌曲信息
        songInfo.name = data.songName || data.name || '未知歌曲';
        songInfo.artist = data.artist || data.singer || '';
        songInfo.url = data.url || '';
        songInfo.source = data.source || '';

        console.log('音乐URL获取成功:', songInfo.url);
      } catch (error) {
        console.error('获取音乐URL错误:', error);
        throw error;
      }
    }

    // 获取封面图片
    async function fetchMusicPic() {
      try {
        const path = `/api/match?type=pic&id=${props.songId}`;

        // 获取鉴权参数
        const authResponse = await fetch(`${props.apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!authResponse.ok) {
          throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const authParam = authData.auth || (authData.data?.auth);

        if (!authParam) {
          throw new Error('鉴权参数不存在');
        }

        // 调用封面图片API
        const picResponse = await fetch(`${props.apiBaseUrl}${path}&auth=${encodeURIComponent(authParam)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!picResponse.ok) {
          throw new Error(`获取封面图片失败: ${picResponse.status} ${picResponse.statusText}`);
        }

        const picData = await picResponse.json();
        const data = picData.data || picData;

        // 更新封面图片
        songInfo.pic = data.pic || '';

        console.log('封面图片获取成功:', songInfo.pic ? '是' : '否');
      } catch (error) {
        console.error('获取封面图片错误:', error);
        // 不抛出错误，允许继续执行
      }
    }

    // 获取歌词
    async function fetchMusicLrc() {
      try {
        const path = `/api/match?type=lrc&id=${props.songId}`;

        // 获取鉴权参数
        const authResponse = await fetch(`${props.apiBaseUrl}/api/auth?path=${encodeURIComponent(path)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!authResponse.ok) {
          throw new Error(`获取鉴权参数失败: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const authParam = authData.auth || (authData.data?.auth);

        if (!authParam) {
          throw new Error('鉴权参数不存在');
        }

        // 调用歌词API
        const lrcResponse = await fetch(`${props.apiBaseUrl}${path}&auth=${encodeURIComponent(authParam)}`, {
          headers: { 'X-API-Key': apiKey }
        });

        if (!lrcResponse.ok) {
          throw new Error(`获取歌词失败: ${lrcResponse.status} ${lrcResponse.statusText}`);
        }

        const lrcData = await lrcResponse.json();
        const data = lrcData.data || lrcData;

        // 更新歌词
        songInfo.lrc = data.lrc || '';

        console.log('歌词获取成功:', songInfo.lrc ? '是' : '否');
      } catch (error) {
        console.error('获取歌词错误:', error);
        // 不抛出错误，允许继续执行
      }
    }

    // 处理播放错误
    function handlePlayError(e) {
      console.error('音频播放错误:', e);
      error.value = '音频播放失败，请检查音源是否可用';
    }

    return {
      loading,
      error,
      songInfo,
      handlePlayError
    };
  }
}
</script>

<style scoped>
.loading {
  text-align: center;
  padding: 20px;
}

.error {
  color: #e74c3c;
  padding: 10px;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  margin: 10px 0;
}

.song-player {
  max-width: 600px;
  margin: 0 auto;
}

.player-controls {
  margin: 15px 0;
}

.player-controls audio {
  width: 100%;
}

.media-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 20px;
}

.cover {
  max-width: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.lyrics {
  flex: 1;
  min-width: 300px;
}

.lyrics pre {
  white-space: pre-wrap;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.source {
  font-size: 0.9em;
  color: #666;
}

.no-url {
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  text-align: center;
}
</style>
```

## 安全最佳实践

在生产环境中部署时，建议遵循以下安全最佳实践：

1. **设置强密码的 API 密钥**：生成一个强随机字符串作为 API_KEY
2. **设置强密码的鉴权密钥**：生成一个强随机字符串作为 AUTH_SECRET
3. **限制允许的域名**：设置 ALLOWED_DOMAIN 为特定域名，避免使用通配符 '*'
4. **启用 HTTPS**：设置 ENABLE_HTTPS=true 并确保服务器配置了有效的 SSL 证书
5. **设置合理的速率限制**：根据预期流量调整 RATE_LIMIT 值
6. **使用反向代理**：在前端使用 Nginx 或 Apache 作为反向代理，增加额外的安全层
7. **定期更新依赖**：使用 `pnpm audit` 检查安全漏洞，使用 `pnpm update` 更新依赖
8. **依赖管理**：始终使用 `pnpm` 管理依赖，运行 `pnpm check-deps` 检查依赖状态
