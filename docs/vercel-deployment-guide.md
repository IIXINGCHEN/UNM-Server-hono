# Vercel 部署指南

本文档提供了将 UNM-Server-hono 项目部署到 Vercel 的详细步骤和最佳实践。

## 目录

- [前提条件](#前提条件)
- [部署步骤](#部署步骤)
  - [方法一：使用脚本部署](#方法一使用脚本部署)
  - [方法二：手动部署](#方法二手动部署)
- [环境变量配置](#环境变量配置)
- [常见问题排查](#常见问题排查)
- [部署后验证](#部署后验证)

## 前提条件

- 已安装 Node.js 18.x 或更高版本
- 已安装 pnpm 8.x 或更高版本
- 已注册 Vercel 账号
- 已安装 Vercel CLI（可选，用于命令行部署）

## 部署步骤

### 方法一：使用脚本部署

项目提供了自动化脚本，简化 Vercel 部署流程：

1. **安装 Vercel CLI**：

```bash
pnpm add -g vercel
```

2. **设置环境变量**：

```bash
# 运行环境变量设置脚本
pnpm vercel:env
```

此脚本会从 `.env` 文件读取环境变量，并设置到 Vercel 项目中。

3. **执行部署**：

```bash
# 运行部署脚本
pnpm vercel:deploy
```

脚本会自动处理登录、部署和验证过程。

### 方法二：手动部署

如果您更喜欢手动控制部署过程，可以按照以下步骤操作：

1. **安装 Vercel CLI**：

```bash
pnpm add -g vercel
```

2. **登录 Vercel**：

```bash
vercel login
```

3. **部署项目**：

```bash
# 开发环境部署（预览）
vercel

# 生产环境部署
vercel --prod
```

4. **在 Vercel 控制台配置环境变量**：

登录 [Vercel 控制台](https://vercel.com)，进入项目设置，添加以下环境变量：
- `API_KEY`：API访问密钥
- `AUTH_SECRET`：API鉴权密钥
- `ALLOWED_DOMAIN`：允许的域名
- `NODE_ENV`：设置为 "production"
- `MUSIC_API_URL`：音乐API地址
- 其他必要的环境变量

## 环境变量配置

以下环境变量对于项目正常运行至关重要：

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| API_KEY | API访问密钥 | - | 是 |
| AUTH_SECRET | API鉴权密钥 | - | 是 |
| ALLOWED_DOMAIN | 允许的域名 | * | 是 |
| NODE_ENV | 环境模式 | production | 是 |
| MUSIC_API_URL | 音乐API地址 | - | 是 |
| RATE_LIMIT | 速率限制 | 100 | 否 |
| ENABLE_HTTPS | 是否强制HTTPS | false | 否 |
| LOG_LEVEL | 日志级别 | info | 否 |
| ALLOW_CDN | 是否允许CDN | true | 否 |
| ENABLE_FLAC | 启用无损音质 | true | 否 |

## 常见问题排查

### 1. 404 错误

如果部署后访问出现 404 错误，可能的原因和解决方案：

- **构建问题**：确保 `vercel.json` 配置正确，特别是路由配置
- **环境变量缺失**：检查是否配置了所有必要的环境变量
- **路径问题**：检查 `vercel.json` 中的路由路径是否正确（注意 `/dist/index.js` 和 `dist/index.js` 的区别）

解决步骤：
1. 检查 Vercel 构建日志，查找错误信息
2. 确认 `vercel.json` 中的路由配置正确
3. 验证环境变量是否正确设置
4. 如果问题仍然存在，尝试重新部署

### 2. 构建失败

如果构建过程失败，可能的原因和解决方案：

- **依赖问题**：确保使用 pnpm 作为包管理器
- **Node.js 版本**：确保使用兼容的 Node.js 版本（18.x 或更高）
- **构建脚本错误**：检查构建脚本是否正确执行

解决步骤：
1. 在 Vercel 项目设置中，确保使用 pnpm 作为包管理器
2. 检查 Node.js 版本设置
3. 查看构建日志，找出具体错误
4. 在本地运行 `pnpm build` 验证构建过程

### 3. API 请求失败

如果 API 请求返回错误，可能的原因和解决方案：

- **CORS 问题**：检查 `ALLOWED_DOMAIN` 环境变量是否正确设置
- **API 密钥问题**：确保 `API_KEY` 和 `AUTH_SECRET` 环境变量正确设置
- **路由配置问题**：检查 `vercel.json` 中的 API 路由配置

## 部署后验证

部署完成后，建议执行以下验证步骤：

1. **访问首页**：确认首页能正常加载
2. **测试 API 端点**：
   - `/api/info`：检查服务信息
   - `/api/config`：检查配置信息
   - `/api/health`：检查健康状态
3. **检查日志**：在 Vercel 控制台查看应用日志，确认没有错误
4. **性能测试**：使用浏览器开发者工具检查页面加载性能

如果所有验证步骤都通过，恭喜您成功部署了 UNM-Server-hono 项目！
