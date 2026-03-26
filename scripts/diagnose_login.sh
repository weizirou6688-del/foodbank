#!/bin/bash
# 登录系统快速诊断脚本
# Login System Quick Diagnostic Script

set -e

echo "🔍 ABC食物银行系统 - 登录诊断"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：打印检查结果
check_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
    return 1
  fi
}

echo "1️⃣  检查后端服务器..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✅ 后端服务器运行在 Port 8000${NC}"
else
  echo -e "${RED}❌ 后端服务器未运行${NC}"
  echo "   启动: cd /workspaces/foodbank && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
fi

echo ""
echo "2️⃣  检查前端服务器..."
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo -e "${GREEN}✅ 前端服务器运行在 Port 5173${NC}"
else
  echo -e "${RED}❌ 前端服务器未运行${NC}"
  echo "   启动: cd /workspaces/foodbank && npm run dev"
fi

echo ""
echo "3️⃣  测试登录端点..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foodbank.com","password":"admin123"}' 2>/dev/null)

if echo "$RESPONSE" | grep -q "access_token"; then
  echo -e "${GREEN}✅ 登录端点工作正常${NC}"
  # 提取并显示用户信息
  USER_NAME=$(echo "$RESPONSE" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
  echo "   用户: $USER_NAME (admin)"
else
  echo -e "${RED}❌ 登录端点错误${NC}"
  echo "   响应: $RESPONSE"
fi

echo ""
echo "4️⃣  检查前端环境配置..."
if [ -f "/workspaces/foodbank/.env.local" ]; then
  API_URL=$(grep "VITE_API_URL" /workspaces/foodbank/.env.local | cut -d'=' -f2)
  echo -e "${GREEN}✅ .env.local 存在${NC}"
  echo "   API URL: $API_URL"
else
  echo -e "${YELLOW}⚠️  .env.local 不存在（使用默认值: http://localhost:8000）${NC}"
fi

echo ""
echo "5️⃣  测试演示账户..."
echo ""

TEST_ACCOUNTS=(
  "admin@foodbank.com:admin123:admin"
  "supermarket@foodbank.com:supermarket123:supermarket"
  "user@example.com:user12345:public"
)

for account in "${TEST_ACCOUNTS[@]}"; do
  IFS=':' read -r EMAIL PASSWORD ROLE <<< "$account"
  
  RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null)
  
  if echo "$RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}✅ $EMAIL ($ROLE)${NC}"
  else
    echo -e "${RED}❌ $EMAIL 登录失败${NC}"
  fi
done

echo ""
echo "================================"
echo "🎯 诊断摘要"
echo "================================"
echo ""
echo "使用以下演示账户登录:"
echo ""
echo "👤 管理员:"
echo "   邮箱: admin@foodbank.com"
echo "   密码: admin123"
echo ""
echo "🏪 超市用户:"
echo "   邮箱: supermarket@foodbank.com"
echo "   密码: supermarket123"
echo ""
echo "👥 普通用户:"
echo "   邮箱: user@example.com"
echo "   密码: user12345"
echo ""
echo "📱 访问应用: http://localhost:5173"
echo ""
echo "如需完整诊断报告，查看: LOGIN_DIAGNOSTIC_REPORT.md"
echo ""
