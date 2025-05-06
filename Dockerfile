# Dockerfile for Hono TypeScript Application

# ---- Build Stage ----
# 使用一个包含 Node.js 和 pnpm/npm/yarn 的基础镜像作为构建环境
# 选择一个与生产环境兼容的 Node.js 版本 (例如 Node 20 LTS)
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件 (pnpm-lock.yaml, package-lock.json, or yarn.lock)
# 利用 Docker 的层缓存机制, 只有当这些文件改变时才重新安装依赖
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# 安装生产依赖和开发依赖 (用于构建)
# 使用 pnpm (推荐), 或 npm/yarn
# RUN pnpm install --frozen-lockfile
RUN npm install --frozen-lockfile # 或者 yarn install --frozen-lockfile

# 复制项目源代码到工作目录
COPY . .

# 执行 TypeScript 编译
# 这会读取 tsconfig.json 并将 src/ 编译到 dist/
RUN npm run build

# (可选) 清理开发依赖以减小下一阶段的体积
# RUN pnpm prune --prod
RUN npm prune --production # 或者 yarn install --production

# ---- Production Stage ----
# 使用一个轻量级的 Node.js 基础镜像作为生产环境
FROM node:20-alpine AS production

# 设置工作目录
WORKDIR /app

# 设置 NODE_ENV 环境变量为 production
ENV NODE_ENV=production
# (可选) 设置默认端口，如果 .env 文件未提供
# ENV PORT=5678

# 从构建阶段复制必要的生产文件
# - node_modules (只包含生产依赖)
# - dist (编译后的 JavaScript 代码)
# - package.json (某些库可能在运行时需要读取它)
# - (可选) .env 文件或配置加载需要的其他文件
# - (可选) src/views 和 src/public 如果是运行时读取而不是构建时打包
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# 如果需要视图和公共文件在运行时可用
# COPY --from=builder /app/src/views ./src/views
# COPY --from=builder /app/src/public ./src/public
# 注意: 如果视图或静态资源很大, 或者更倾向于在构建时处理,
# 可以考虑将它们构建到 dist/ 或使用其他服务 (如 CDN) 提供。
# Hono 的 serveStatic 中间件默认从相对于运行目录查找。

# 暴露应用程序监听的端口 (来自配置, 默认 5678)
# 需要确保容器运行时映射了此端口 (-p host:container)
EXPOSE ${PORT:-5678}

# 定义容器启动时执行的命令
# 运行编译后的 Node.js 服务器入口 (dist/server.js)
CMD ["node", "dist/server.js"]
