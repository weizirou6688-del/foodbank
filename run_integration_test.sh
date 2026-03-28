#!/bin/bash

# 🧪 前端申请表单集成测试 - 快速启动脚本
# 使用方式: bash run_integration_test.sh

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                            ║"
echo "║               🚀 前端申请表单集成测试 - 快速启动                         ║"
echo "║                                                                            ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 检查是否安装了必要的工具
check_requirements() {
    echo "📋 检查环境要求..."
    echo ""
    
    # 检查 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo "   ✅ Node.js: $NODE_VERSION"
    else
        echo "   ❌ Node.js 未安装"
        return 1
    fi
    
    # 检查 Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        echo "   ✅ Python: $PYTHON_VERSION"
    else
        echo "   ❌ Python 未安装"
        return 1
    fi
    
    # 检查 npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo "   ✅ npm: $NPM_VERSION"
    else
        echo "   ❌ npm 未安装"
        return 1
    fi
    
    echo ""
    return 0
}

# 启动后端
start_backend() {
    echo "🔧 启动后端服务..."
    echo ""
    echo "   运行命令: cd backend && python -m uvicorn app.main:app --reload"
    echo ""
    echo "   请在新的终端窗口中运行此命令！"
    echo "   后端将运行在: http://localhost:8000"
    echo ""
}

# 启动前端
start_frontend() {
    echo "⚛️  启动前端开发服务器..."
    echo ""
    echo "   运行命令: cd frontend && npm run dev"
    echo ""
    echo "   请在另一个新的终端窗口中运行此命令！"
    echo "   前端将运行在: http://localhost:5173"
    echo ""
}

# 打印测试步骤
print_test_steps() {
    echo "📝 手动集成测试步骤"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "【前置准备】"
    echo "1. 打开浏览器开发工具 (F12 或 Ctrl+Shift+I)"
    echo "2. 进入 Network 标签页"
    echo "3. 保持开发工具打开状态"
    echo ""
    echo "【用户流程测试】"
    echo "1. 访问 http://localhost:5173"
    echo "2. 登录用户账户"
    echo "3. 导航到 /find-foodbank"
    echo "4. 选择一个食物银行"
    echo "5. 导航到 /application"
    echo "   ├─ 验证: 页面能否加载"
    echo "   ├─ 验证: 日期选择器显示当前周一"
    echo "   └─ 验证: 食物银行信息正确显示"
    echo ""
    echo "6. 在日期选择器中选择一个周一"
    echo "   └─ 验证: 日期格式为 YYYY-MM-DD"
    echo ""
    echo "7. 选择食品包"
    echo "   ├─ 点击一个食品包卡片"
    echo "   ├─ 验证: 卡片被选中（显示 'Selected' 标签）"
    echo "   └─ 调整数量（+/- 按钮）"
    echo ""
    echo "8. 点击 'Submit Application' 按钮"
    echo "   └─ 验证: 按钮能响应点击"
    echo ""
    echo "【网络请求验证】"
    echo "1. 在 Network 标签中查找 'applications' 请求"
    echo ""
    echo "2. 检查 Request (请求体):"
    echo "   ├─ ✅ 包含 food_bank_id"
    echo "   ├─ ✅ 包含 week_start (格式 YYYY-MM-DD)"
    echo "   ├─ ✅ 包含 items 数组"
    echo "   ├─ ✅ items 中使用 package_id (不是 food_package_id)"
    echo "   ├─ ❌ 不包含 user_id"
    echo "   └─ ❌ 不包含 status"
    echo ""
    echo "3. 检查 Response (响应):"
    echo "   ├─ 状态码应该是 200 或 201"
    echo "   ├─ 包含 id"
    echo "   ├─ 包含 redemption_code (格式 FB-XXXXXX)"
    echo "   └─ 包含 week_start"
    echo ""
    echo "【UI 反馈验证】"
    echo "1. 提交后应显示成功模态框"
    echo "2. 模态框中显示兑换码"
    echo "3. 点击 'Done' 按钮返回主页"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 打印故障排除
print_troubleshooting() {
    echo ""
    echo "🔧 故障排除"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "【问题】后端无法连接"
    echo "【解决】"
    echo "  1. 确保后端运行在 http://localhost:8000"
    echo "  2. 检查是否有其他进程占用 8000 端口"
    echo "  3. 查看后端日志是否有错误"
    echo ""
    echo "【问题】前端无法加载"
    echo "【解决】"
    echo "  1. 确保前端运行在 http://localhost:5173"
    echo "  2. 检查 npm 依赖: cd frontend && npm install"
    echo "  3. 查看浏览器控制台是否有错误"
    echo ""
    echo "【问题】提交失败返回 401"
    echo "【解决】"
    echo "  1. 确认用户已登录"
    echo "  2. 检查认证令牌是否有效"
    echo "  3. 查看后端认证日志"
    echo ""
    echo "【问题】提交失败返回 422 (Unprocessable Entity)"
    echo "【解决】"
    echo "  1. 检查请求体格式是否正确"
    echo "  2. 验证 week_start 是否为有效的周一日期"
    echo "  3. 检查 package_id 和 quantity 是否有效"
    echo ""
    echo "【问题】日期选择器只允许选择某些日期"
    echo "【解决】"
    echo "  1. 这是正常的，系统只允许选择周一"
    echo "  2. HTML5 date 输入会显示日历，选择周一即可"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 主流程
main() {
    if ! check_requirements; then
        echo ""
        echo "❌ 环境检查失败，请安装缺失的工具"
        return 1
    fi
    
    start_backend
    start_frontend
    print_test_steps
    print_troubleshooting
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 设置完成！"
    echo ""
    echo "📌 请按照以下步骤操作:"
    echo ""
    echo "1️⃣  打开第一个新终端，启动后端:"
    echo "    cd /workspaces/foodbank/backend"
    echo "    python -m uvicorn app.main:app --reload"
    echo ""
    echo "2️⃣  打开第二个新终端，启动前端:"
    echo "    cd /workspaces/foodbank/frontend"
    echo "    npm run dev"
    echo ""
    echo "3️⃣  等待两个服务都启动完成（1-2分钟）"
    echo ""
    echo "4️⃣  在浏览器中访问 http://localhost:5173"
    echo ""
    echo "5️⃣  按照上面的测试步骤进行手动测试"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

main
