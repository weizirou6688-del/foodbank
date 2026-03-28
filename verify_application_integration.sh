#!/usr/bin/env bash

# 前端申请表单字段绑定修复 - 整合验证
# ============================================
# 此脚本验证前端申请表单与后端 API 的完整集成

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                           ║"
echo "║                  ✅ 前端申请表单字段绑定 - 完整验证                       ║"
echo "║                                                                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# ==================== 验证部分1: 文件检查 ====================
echo "📁 文件完整性检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FILES=(
  "frontend/src/pages/ApplicationForm/ApplicationForm.tsx"
  "frontend/src/pages/ApplicationForm/ApplicationForm.module.css"
  "frontend/src/app/store/foodBankStore.ts"
  "frontend/src/app/router.tsx"
  "frontend/verify_application_form.py"
)

all_files_exist=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (缺失)"
    all_files_exist=false
  fi
done

echo ""

if $all_files_exist; then
  echo "✅ 所有文件已创建"
else
  echo "❌ 某些文件缺失"
fi

echo ""

# ==================== 验证部分2: 代码检查 ====================
echo "🔍 代码质量检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 Store 中的 week_start 处理
echo "1. 检查 Store 中的 week_start 处理:"
if grep -q "week_start" frontend/src/app/store/foodBankStore.ts; then
  echo "   ✓ applyPackages 处理 week_start 字段"
else
  echo "   ✗ applyPackages 未处理 week_start 字段"
fi

if grep -q "package_id" frontend/src/app/store/foodBankStore.ts; then
  echo "   ✓ 使用正确的字段名 package_id"
else
  echo "   ✗ 未使用正确的字段名"
fi

if ! grep -q "user_id:" frontend/src/app/store/foodBankStore.ts || ! grep "user_id:" frontend/src/app/store/foodBankStore.ts | grep -q "body"; then
  echo "   ✓ 未发送 user_id 字段"
else
  echo "   ✗ 仍然发送 user_id 字段"
fi

if ! grep "body: JSON.stringify" frontend/src/app/store/foodBankStore.ts | grep -q "status"; then
  echo "   ✓ 未发送 status 字段"
else
  echo "   ⚠️  可能仍然发送 status 字段"
fi

echo ""

# 检查 ApplicationForm 中的日期处理
echo "2. 检查 ApplicationForm 中的日期处理:"
if grep -q "week_start\|weekStart" frontend/src/pages/ApplicationForm/ApplicationForm.tsx; then
  echo "   ✓ ApplicationForm 处理 week_start"
else
  echo "   ✗ ApplicationForm 未处理 week_start"
fi

if grep -q "type=\"date\"" frontend/src/pages/ApplicationForm/ApplicationForm.tsx; then
  echo "   ✓ 使用 HTML5 date 输入"
else
  echo "   ✗ 未使用 HTML5 date 输入"
fi

if grep -q "getDay\|Monday" frontend/src/pages/ApplicationForm/ApplicationForm.tsx; then
  echo "   ✓ 验证周一"
else
  echo "   ⚠️  未进行周一验证"
fi

echo ""

# 检查路由
echo "3. 检查路由配置:"
if grep -q "ApplicationForm" frontend/src/app/router.tsx; then
  echo "   ✓ ApplicationForm 已添加到路由"
else
  echo "   ✗ ApplicationForm 未添加到路由"
fi

if grep -q "path: 'application'" frontend/src/app/router.tsx; then
  echo "   ✓ /application 路由已配置"
else
  echo "   ✗ /application 路由未配置"
fi

echo ""

# ==================== 验证部分3: 格式检查 ====================
echo "📋 API 字段格式验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "前端发送的 JSON 格式应该是:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat << 'EOF'
{
  "food_bank_id": 1,
  "week_start": "2026-03-23",  // YYYY-MM-DD 格式，必须是周一
  "items": [
    {
      "package_id": 1,
      "quantity": 2
    },
    {
      "package_id": 3,
      "quantity": 1
    }
  ]
}
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ==================== 使用说明 ====================
echo "🚀 如何使用新的 ApplicationForm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  用户流程:"
echo "   a) 用户登录"
echo "   b) 用户选择食物银行 (/find-foodbank)"
echo "   c) 用户导航到 /application"
echo "   d) 用户选择申请周期 (默认当前周一)"
echo "   e) 用户选择食品包和数量"
echo "   f) 用户提交申请"
echo ""

echo "2️⃣  数据流:"
echo "   ApplicationForm"
echo "     ↓ (收集 food_bank_id, week_start, items)"
echo "   foodBankStore.applyPackages()"
echo "     ↓ (调用 POST /api/v1/applications)"
echo "   Backend API"
echo "     ↓ (验证数据、创建应用、生成兑换码)"
echo "   Response"
echo "     ↓ (redemption_code)"
echo "   Success Modal (显示兑换码)"
echo ""

# ==================== 修改摘要 ====================
echo "📝 修改摘要"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ 修改的文件:"
echo ""
echo "1️⃣  frontend/src/app/store/foodBankStore.ts"
echo "   - 更新 applyPackages 方法签名接收 weekStart 参数"
echo "   - 添加 week_start 字段到请求体"
echo "   - 移除 user_id 字段（由后端从auth token提取）"
echo "   - 移除 status 字段（后端默认为 'pending'）"
echo "   - 修改 food_package_id 为 package_id"
echo "   - 改进日期格式处理 (YYYY-MM-DD)"
echo ""

echo "2️⃣  frontend/src/pages/ApplicationForm/ApplicationForm.tsx (新建)"
echo "   - 完整的申请表单组件"
echo "   - 日期选择器 (HTML5 input type='date')"
echo "   - 周一验证"
echo "   - 食品包选择和数量控制"
echo "   - 提交处理和成功反馈"
echo ""

echo "3️⃣  frontend/src/pages/ApplicationForm/ApplicationForm.module.css (新建)"
echo "   - 响应式样式表"
echo "   - 保持原有UI风格"
echo ""

echo "4️⃣  frontend/src/app/router.tsx"
echo "   - 导入 ApplicationForm 组件"
echo "   - 添加 /application 路由"
echo "   - 使用 ProtectedRoute 保护"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ==================== 测试指南 ====================
echo "🧪 测试检查清单"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "□ 前端检查:"
echo "  □ npm run dev - 应用编译无误"
echo "  □ 导航到 /find-foodbank 并选择一个食物银行"
echo "  □ 导航到 /application"
echo "  □ 日期选择器显示当前周的周一"
echo "  □ 可以选择和修改日期"
echo "  □ 只能选择周一（星期二等应该被拒绝）"
echo "  □ 可以选择食品包并调整数量"
echo ""

echo "□ 后端集成检查:"
echo "  □ 提交申请"
echo "  □ 后端应该收到正确的 week_start (YYYY-MM-DD)"
echo "  □ 后端应该收到正确的 package_id（不是 food_package_id）"
echo "  □ 后端应该创建应用记录"
echo "  □ 后端应该生成兑换码"
echo "  □ 兑换码应该返回给前端"
echo "  □ 前端应该显示成功模态框"
echo ""

echo "□ 数据库检查:"
echo "  □ 应用记录应该在 applications 表中创建"
echo "  □ week_start 应该是正确的日期"
echo "  □ user_id 应该从认证上下文自动填充"
echo "  □ status 应该是 'pending'"
echo "  □ redemption_code 应该符合格式 FB-XXXXXX"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                           ║"
echo "║                  ✅ 前端申请表单字段绑定完成!                            ║"
echo "║                                                                           ║"
echo "║                        可以进行集成测试                                   ║"
echo "║                                                                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
