#!/bin/bash
# Alembic 迁移批量执行和验证脚本
# 用法: bash scripts/run_migrations.sh [all|step NUMBER]

set -e

BACKEND_DIR="/workspaces/foodbank/backend"
cd "$BACKEND_DIR"

echo "🗄️  Alembic 迁移执行工具"
echo "===================================="

# 函数：执行单个迁移
execute_migration() {
    local step=$1
    echo ""
    echo "📥 执行迁移 $step..."
    
    if alembic upgrade +1; then
        echo "✅ 迁移 $step 成功"
        return 0
    else
        echo "❌ 迁移 $step 失败"
        return 1
    fi
}

# 函数：验证迁移
verify_migration() {
    echo ""
    echo "🔍 验证数据库状态..."
    
    alembic current
    
    # 计数表
    python3 << 'EOF'
from sqlalchemy import create_engine, inspect, text
from app.core.config import settings

sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
engine = create_engine(sync_url)

inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"\n📊 数据库中有 {len(tables)} 张表")

# 列出关键表
key_tables = ['applications', 'inventory_lots', 'food_bank_hours', 'food_packages']
for table in key_tables:
    if table in tables:
        cols = len(inspector.get_columns(table))
        print(f"   ✓ {table}: {cols} 列")
EOF
}

# 主逻辑
case "${1:-all}" in
    all)
        echo "🚀 执行所有剩余迁移 (0008-0012)..."
        
        for migration in 0008 0009 0010; do
            execute_migration $migration || exit 1
        done
        
        # 可选迁移
        echo ""
        echo "⚠️  迁移 0011 (RLS) 和 0012 (扩展) 是可选的。"
        echo "要执行它们，请运行: bash scripts/run_migrations.sh optional"
        ;;
    
    optional)
        echo "🚀 执行可选迁移 (0011-0012)..."
        
        for migration in 0011 0012; do
            execute_migration $migration || echo "⚠️  迁移 $migration 可能需要超级用户权限"
        done
        ;;
    
    step)
        if [ -z "$2" ]; then
            echo "❌ 请指定迁移步骤: bash scripts/run_migrations.sh step NUMBER"
            exit 1
        fi
        execute_migration "$2"
        ;;
    
    verify)
        verify_migration
        ;;
    
    *)
        echo "用法: bash scripts/run_migrations.sh [all|optional|step NUMBER|verify]"
        echo ""
        echo "示例:"
        echo "  bash scripts/run_migrations.sh all       # 执行所有必要迁移"
        echo "  bash scripts/run_migrations.sh optional  # 执行可选迁移"
        echo "  bash scripts/run_migrations.sh step 0008 # 执行单个迁移"
        echo "  bash scripts/run_migrations.sh verify    # 验证数据库状态"
        exit 1
        ;;
esac

echo ""
verify_migration

echo ""
echo "✅ 完成！"
echo ""
echo "📋 后续步骤:"
echo "1. 运行后端服务: python -m uvicorn app.main:app --reload"
echo "2. 运行测试: pytest tests/"
echo "3. 查看迁移历史: alembic history"
