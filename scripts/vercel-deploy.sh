#!/bin/bash

# Vercel 部署脚本
# 用于在本地执行 Vercel 部署

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
function log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

function log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

function log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Vercel CLI 是否已安装
if ! command -v vercel &> /dev/null; then
  log_error "Vercel CLI 未安装，请先安装 Vercel CLI"
  log_info "可以使用以下命令安装: pnpm add -g vercel"
  exit 1
fi

# 检查是否已登录 Vercel
log_info "检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
  log_warning "未登录 Vercel，请先登录"
  vercel login
fi

# 确认部署
log_info "准备部署到 Vercel..."
read -p "是否继续部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log_info "部署已取消"
  exit 0
fi

# 执行部署
log_info "开始部署..."
vercel --prod

# 检查部署结果
if [ $? -eq 0 ]; then
  log_success "部署成功！"
else
  log_error "部署失败，请检查错误信息"
  exit 1
fi

# 提示查看部署日志
log_info "可以使用 'vercel logs' 命令查看部署日志"
log_info "可以使用 'vercel env ls' 命令查看环境变量"

# 完成
log_success "部署脚本执行完毕"
