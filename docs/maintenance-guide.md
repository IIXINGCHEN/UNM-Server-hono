# UNM-Server-hono 维护指南

本指南提供了维护 UNM-Server-hono 项目的最佳实践，包括定期测试、监控、依赖更新和安全审计。

## 目录

- [日常维护](#日常维护)
- [每周维护](#每周维护)
- [每月维护](#每月维护)
- [季度维护](#季度维护)
- [维护脚本使用指南](#维护脚本使用指南)
- [故障排除](#故障排除)

## 日常维护

### 健康检查

每天检查服务的健康状态，确保服务正常运行：

```bash
# 检查健康状态
curl http://localhost:5678/health
```

### 日志检查

定期检查日志，查找错误和异常：

```bash
# 查看最近的日志
tail -f logs/app.log
```

## 每周维护

### 运行 API 测试

每周至少运行一次 API 测试，确保所有 API 端点都能正常工作：

```bash
pnpm test
```

### 检查安全漏洞

每周检查依赖的安全漏洞：

```bash
# 使用官方 npm 源检查安全漏洞
pnpm audit --registry=https://registry.npmjs.org
```

### 验证API鉴权

每周验证API鉴权机制是否正常工作：

```bash
# 运行API测试脚本
node scripts/api-test.js
```

### 监控服务性能

每周运行监控脚本，收集服务的性能指标：

```bash
# 运行监控 10 分钟
pnpm maintenance --monitor --time=10
```

## 每月维护

### API密钥管理

每月检查并考虑轮换API密钥，提高安全性：

```bash
# 生成新的随机密钥
NEW_API_KEY=$(openssl rand -hex 32)
NEW_CLIENT_API_KEY=$(openssl rand -hex 32)
NEW_AUTH_SECRET=$(openssl rand -hex 32)

# 更新.env文件中的密钥
sed -i "s/^API_KEY=.*/API_KEY=$NEW_API_KEY/" .env
sed -i "s/^CLIENT_API_KEY=.*/CLIENT_API_KEY=$NEW_CLIENT_API_KEY/" .env
sed -i "s/^AUTH_SECRET=.*/AUTH_SECRET=$NEW_AUTH_SECRET/" .env

# 重启服务以应用新密钥
pnpm restart
```

### 更新补丁版本

每月更新依赖的补丁版本，修复 bug 和安全漏洞：

```bash
# 检查过时的依赖
pnpm check-deps

# 更新补丁版本
pnpm update --patch
```

### 全面测试

每月进行一次全面测试，包括 API 测试、性能测试和安全测试：

```bash
# 运行所有维护检查
pnpm maintenance:all
```

### 备份数据

每月备份重要数据和配置文件：

```bash
# 备份示例
mkdir -p backups/$(date +%Y-%m)
cp .env backups/$(date +%Y-%m)/
cp -r config backups/$(date +%Y-%m)/ (如果有)
```

## 季度维护

### 评估主要版本更新

每季度评估依赖的主要版本更新，权衡更新的利弊：

```bash
# 检查主要版本更新
pnpm outdated
```

### 代码审查

每季度进行一次代码审查，查找潜在的问题和改进点：

- 检查代码质量和一致性
- 查找未使用的代码和依赖
- 评估性能瓶颈
- 检查安全风险

### 文档更新

每季度更新项目文档，确保文档与代码保持一致：

- 更新 README.md
- 更新 API 文档
- 更新维护指南
- 更新 UNM-Server-hono-documentation.md
- 更新 UNM-API-播放指南.md
- 更新 api-security.md

特别注意确保以下内容保持最新：

1. API接口调用方法
2. 客户端密钥和服务器密钥分离模式的说明
3. API权限级别系统的说明
4. 响应格式处理的代码示例
5. 安全最佳实践

## 维护脚本使用指南

UNM-Server-hono 提供了一个维护脚本，用于自动化维护任务：

```bash
# 显示帮助信息
pnpm maintenance

# 运行所有检查
pnpm maintenance:all

# 只运行 API 测试
pnpm maintenance:test

# 只检查依赖
pnpm maintenance:deps

# 运行监控 30 分钟
pnpm maintenance --monitor --time=30
```

### 维护脚本选项

- `--test`: 运行 API 测试
- `--monitor`: 运行监控
- `--deps`: 运行依赖检查
- `--all`: 运行所有检查
- `--time=N`: 监控运行时间（分钟）

## 故障排除

### API 测试失败

如果 API 测试失败，请检查以下几点：

1. 确保服务正在运行
2. 检查环境变量是否正确配置
3. 检查日志中的错误信息
4. 检查网络连接是否正常

### API 鉴权问题

如果遇到 API 鉴权问题（401 错误），请检查以下几点：

1. **API 密钥验证失败**：
   - 确保环境变量中的 `API_KEY` 和 `CLIENT_API_KEY` 正确配置
   - 确认请求头中的 `X-API-Key` 是否正确
   - 验证是否使用了正确的密钥类型（客户端/服务器）访问相应权限级别的 API

2. **鉴权参数验证失败**：
   - 检查鉴权参数是否过期（有效期为 300 秒）
   - 确认查询参数与生成鉴权参数时使用的完全一致
   - 验证 `AUTH_SECRET` 是否正确配置

3. **响应格式问题**：
   - 检查代码是否正确处理两种可能的响应格式：
     ```javascript
     // 正确的响应格式处理
     const apiKey = data.apiKey || (data.data?.apiKey);
     const authParam = data.auth || (data.data?.auth);
     ```

### 依赖更新问题

如果依赖更新后出现问题，请尝试以下步骤：

1. 回滚到上一个稳定版本
2. 检查更新日志，了解破坏性变更
3. 逐个更新依赖，找出问题所在

### 性能问题

如果发现性能问题，请检查以下几点：

1. 查看监控指标，找出瓶颈
2. 检查日志中的慢请求
3. 检查系统资源使用情况
4. 考虑优化代码或增加资源

## 自动化维护

考虑使用 CI/CD 工具自动化维护任务：

1. 配置定期运行测试
2. 设置依赖更新通知
3. 自动生成性能报告
4. 配置安全扫描

## 联系方式

如有问题或建议，请联系项目维护者：

- 邮箱：[项目维护者邮箱]
- GitHub：[GitHub 仓库地址]

---

本指南最后更新于：2024年7月1日

## 最近的优化

### 2024年7月1日优化

1. **增强安全架构**：
   - 实现了客户端密钥和服务器密钥分离模式
   - 添加了 `CLIENT_API_KEY` 环境变量，用于前端访问低权限API
   - 实现了API权限级别系统（PUBLIC、CLIENT、SERVER）
   - 增强了来源验证机制，使用完整URL匹配而非部分匹配

2. **改进API鉴权**：
   - 优化了鉴权参数生成和验证逻辑
   - 添加了对两种响应格式的支持（直接返回和包含在data字段中）
   - 改进了错误处理和日志记录，帮助诊断鉴权问题
   - 添加了API测试脚本，用于验证鉴权机制

3. **文档更新**：
   - 更新了所有文档，以适配当前API接口调用方法
   - 添加了更详细的API调用示例和代码片段
   - 完善了故障排除指南，特别是API鉴权相关的问题
   - 添加了API密钥管理的最佳实践

4. **增强安全性**：
   - 改进了CSP配置，根据`ALLOW_CDN`环境变量决定是否允许加载外部资源
   - 使用令牌桶算法实现了更精确的请求限流
   - 添加了更多的日志记录，帮助诊断安全问题
   - 增强了输入验证和参数规范化

5. **性能优化**：
   - 实现了API响应缓存，减少外部API调用
   - 添加了并发控制机制，避免触发速率限制
   - 优化了错误重试逻辑，使用指数退避策略
   - 添加了参数规范化中间件，提高安全性和性能
