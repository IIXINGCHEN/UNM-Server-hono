FROM node:lts-alpine
WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装pnpm并安装依赖
RUN npm install -g pnpm && pnpm install

# 复制源代码
COPY . .

# 构建TypeScript代码
RUN pnpm build

# 暴露端口
EXPOSE 5678

# 启动服务
CMD [ "pnpm", "start" ]
