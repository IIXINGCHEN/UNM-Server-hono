# UNM Server Hono (网易云解灰 API 服务 - Hono 重构版)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007ACC)](http://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Built%20with-Hono-ff4081)](https://hono.dev/)

本服务是基于 Hono 框架和 TypeScript 重构的网易云音乐等平台解灰 API 服务，旨在提供高性能、稳定且易于部署的解决方案。核心功能依赖于 [@unblockneteasemusic/server](https://github.com/UnblockNeteaseMusic/server) 库。

**原始项目 (如果基于某个公开项目):** [链接到原项目]
**主要贡献者:** imsyy (原作者), AI Assistant (Hono 重构)

## 功能特性

* 基于高性能 Hono 框架构建
* 使用 TypeScript 编写，提供类型安全
* 支持多种音源解锁 (依赖 `@unblockneteasemusic/server`)
* 提供 `/match`, `/ncmget`, `/otherget` 等核心 API 端点
* 通过环境变量进行灵活配置
* 包含结构化日志、错误处理、CORS、安全头部等中间件
* 支持 Vercel Serverless Functions 和传统 Node.js 部署 (包括 Docker)
* 代码包含详细中文注释

## 技术栈

* **框架:** [Hono](https://hono.dev/)
* **语言:** [TypeScript](https://www.typescriptlang.org/)
* **运行时:** [Node.js](https://nodejs.org/) (v18+ recommended)
* **核心库:** [@unblockneteasemusic/server](https://github.com/UnblockNeteaseMusic/server)
* **主要中间件/工具:**
    * `@hono/node-server` (Node.js 适配器)
    * `@hono/zod-validator` & `zod` (请求校验)
    * `@hono/secure-headers` (安全头部)
    * `@hono/cors` (CORS 处理)
    * `@hono/serve-static` (静态文件)
    * `pino` (日志)
    * `dotenv` (环境配置)
    * `tsx` (开发环境 TS 执行)

## 准备工作

* 安装 [Node.js](https://nodejs.org/) (推荐 v18 或更高版本)
* 安装包管理器 ([pnpm](https://pnpm.io/), [npm](https://www.npmjs.com/), or [yarn](https://yarnpkg.com/)) - 本项目示例使用 npm。

## 安装

1.  克隆仓库:
    ```bash
    git clone <your-repo-url>
    cd unm-server-hono
    ```
2.  安装依赖:
    ```bash
    npm install
    # 或者使用 pnpm install / yarn install
    ```

## 配置

1.  复制环境变量示例文件:
    ```bash
    cp .env.example .env
    ```
2.  编辑 `.env` 文件，根据需要修改配置项（端口、允许的域名、可选的 Cookie 和 API Key 等）。详情请参考文件内的注释。

## 开发

启动开发服务器 (使用 `tsx` 支持热重载):
```bash
npm run dev
