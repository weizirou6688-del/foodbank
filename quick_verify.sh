#!/bin/bash

# 快速验证清单 - RLS & 代码清理

echo "=========================================="
echo "清理废弃代码与测试权限 - 快速验证"
echo "=========================================="
echo ""

# 1. 验证 stock 字段已移除
echo "1️⃣  检查 inventory_items 是否有 stock 字段..."
cd /workspaces/foodbank/backend
python -c "
import psycopg2
conn = psycopg2.connect(host='localhost', port=5432, database='foodbank', user='foodbank', password='foodbank')
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='stock'\")
result = cur.fetchone()
if result:
    print('   ❌ stock 字段仍然存在')
else:
    print('   ✅ stock 字段已正确移除')
cur.close()
conn.close()
" 2>&1

# 2. 运行 RLS 测试
echo ""
echo "2️⃣  运行权限测试..."
python -m pytest tests/test_rls_permissions.py tests/test_rls_db_level.py -q

echo ""
echo "=========================================="
echo "✅ 验证完成"
echo "=========================================="
