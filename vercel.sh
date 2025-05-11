#!/bin/bash

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

# 检查是否安装了必要的工具
if ! command -v pnpm &> /dev/null; then
  log_error "pnpm 未安装，请先安装 pnpm"
  exit 1
fi

if ! command -v vercel &> /dev/null; then
  log_warning "Vercel CLI 未安装，将尝试安装"
  pnpm add -g vercel
fi

# 构建项目
log_info "开始构建项目..."
pnpm build
if [ $? -ne 0 ]; then
  log_error "构建失败，请检查错误信息"
  exit 1
fi
log_success "构建成功"

# 部署到 Vercel
log_info "开始部署到 Vercel..."
vercel --prod
if [ $? -ne 0 ]; then
  log_error "部署失败，请检查错误信息"
  exit 1
fi
log_success "部署成功"
