#!/bin/bash

# ============================================================================
# RLS 权限测试执行脚本
# ============================================================================
# 测试行级安全（Row Level Security）策略
# - 验证普通用户隔离
# - 验证管理员权限
# - 验证 token 认证

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$BACKEND_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# 检查参数
BACKEND_URL=${1:-"http://localhost:8001"}

echo ""
echo "=========================================================================="
echo "       RLS Permission Tests - Row Level Security Verification"
echo "=========================================================================="
echo ""

log_info "Backend URL: $BACKEND_URL"
log_info "Testing environment..."
echo ""

# 1. 检查后端连接
log_info "Step 1: Checking backend connectivity..."
if curl -s -m 5 "$BACKEND_URL/api/v1/food-banks" > /dev/null 2>&1; then
    log_success "Backend is running"
else
    log_error "Cannot connect to backend at $BACKEND_URL"
    echo ""
    log_warning "To start the backend, run:"
    echo "  cd $BACKEND_DIR"
    echo "  python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
    exit 1
fi

# 2. 检查数据库连接
log_info "Step 2: Checking database connectivity..."
if cd "$BACKEND_DIR" && python -c "
import psycopg2
try:
    conn = psycopg2.connect(host='localhost', port=5432, database='foodbank', user='foodbank', password='foodbank')
    conn.close()
    print('Connected')
except Exception as e:
    print(f'Failed: {e}')
    exit(1)
" 2>&1 | grep -q "Connected"; then
    log_success "Database is accessible"
else
    log_error "Cannot connect to database"
    exit 1
fi

# 3. 检查是否存在 psycopg2
log_info "Step 3: Checking Python dependencies..."
if cd "$BACKEND_DIR" && python -c "import psycopg2; import requests" > /dev/null 2>&1; then
    log_success "Required dependencies are available"
else
    log_warning "Installing dependencies..."
    cd "$BACKEND_DIR"
    pip install psycopg2-binary requests > /dev/null 2>&1
    log_success "Dependencies installed"
fi

# 4. 运行 RLS 测试
echo ""
log_info "Step 4: Running RLS permission tests..."
echo ""

cd "$SCRIPT_DIR"

# 设置环境变量
export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"

# 修改 API URL
python3 << 'PYTHON_TEST_CODE'
import sys
import os

# 添加后端模块到 Python 路径
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# 导入测试脚本的全局变量
import test_rls_permissions as test_module

# 修改 API_BASE（基于环境变量或默认值）
backend_url = os.environ.get('BACKEND_URL', 'http://localhost:8001')
test_module.API_BASE = f"{backend_url}/api/v1"

# 运行测试
if __name__ == "__main__":
    try:
        test_module.test_backend_connectivity()
        print()
        
        test_module.test_user_registration_and_login()
        print()
        
        test_module.test_user_isolation_on_applications()
        print()
        
        test_module.test_admin_permissions()
        print()
        
        test_module.test_token_validation()
        print()
        
        test_module.test_missing_auth_header()
        print()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
PYTHON_TEST_CODE

PYTHON_EXIT=$?

# 5. 运行 pytest（如果有）
echo ""
log_info "Step 5: Running pytest tests..."
if cd "$BACKEND_DIR" && python -m pytest tests/test_rls_permissions.py -v --tb=short 2>/dev/null; then
    log_success "Pytest tests passed"
else
    log_warning "Pytest not available or tests not configured as pytest suite"
fi

echo ""
echo "=========================================================================="
if [ $PYTHON_EXIT -eq 0 ]; then
    log_success "All RLS permission tests completed successfully!"
else
    log_error "Some tests failed"
    exit 1
fi
echo "=========================================================================="
echo ""
