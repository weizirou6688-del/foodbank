# Alembic 迁移执行完整指南

## 📊 现状（已完成）

### 已执行和验证的迁移（7 个）
✅ **0003** - PostgreSQL 枚举类型创建
✅ **0004** - inventory_lots 表创建（批次管理）
✅ **0005** - 审计字段和软删除添加
✅ **0006** - applications weekly 字段迁移
✅ **0007** - 库存迁移至 inventory_lots

**当前数据库版本：** 20260326_0007 (head)
**数据库中的表数：** 14 张（包括新增 inventory_lots）

---

## 🔄 剩余迁移执行步骤

### 方式1：自动化执行（推荐）

```bash
# 进入后端目录
cd /workspaces/foodbank/backend

# 执行所有必要迁移（0008-0010）
bash ../scripts/run_migrations.sh all

# 执行可选迁移（0011-0012）
bash ../scripts/run_migrations.sh optional

# 验证最终状态
bash ../scripts/run_migrations.sh verify
```

### 方式2：手动逐个执行

```bash
# 执行单个迁移
cd /workspaces/foodbank/backend
alembic upgrade +1

# 重复直到完成迁移 0012
```

---

## 📋 剩余10个迁移的详细说明

### 核心迁移（必须执行）

#### **0008 - 修改 food_bank_hours**
- **新增字段**：valid_from (DATE), valid_to (DATE)
- **新增约束**：day_of_week 范围检查 (0-6)，日期范围检查
- **新增索引**：idx_fh_food_bank_valid
- **预期时间**：< 1 秒
- **数据影响**：无数据迁移，仅添加列

#### **0009 - 确保 food_packages 字段完整**
- **检查字段**：stock, threshold, applied_count, is_active, food_bank_id
- **操作**：安全地添加缺失字段（如已存在则跳过）
- **预期时间**：< 1 秒
- **回滚**：无操作（保守做法）

#### **0010 - 添加性能索引**
- **新增索引**：7 个索引，包括 4 个部分索引
- **覆盖表**：applications, inventory_lots, food_bank_hours, food_packages, donations_goods, restock_requests, users
- **预期时间**：1-5 秒（取决于数据量）
- **影响**：写入性能略微下降，查询性能显著提升

### 可选迁移（生产环境建议）

#### **0011 - 启用行级安全（RLS）**
- **前置条件**：应用层需支持 `current_setting('app.current_user_id')`
- **操作**：在 applications 表启用 RLS 和用户隔离策略
- **预期时间**：< 1 秒
- **风险**：如果应用层未配置会话变量，可能导致查询失败
- **建议**：先在开发环境测试，确认应用兼容后再部署

#### **0012 - 启用 PostgreSQL 扩展**
- **扩展**：pg_stat_statements（查询性能分析）
- **前置条件**：需要超级用户权限
- **预期时间**：< 1 秒
- **风险**：低（如权限不足会静默跳过）

---

## ✅ 完整的执行清单

```
[ ] 0008 - 执行 "修改 food_bank_hours"
    [ ] 验证：alembic current -> 20260326_0008
    [ ] 检查约束：SELECT * FROM pg_constraint WHERE conname LIKE 'ck_fh%'
    [ ] 检查索引：\d food_bank_hours

[ ] 0009 - 执行 "food_packages 字段补齐"
    [ ] 验证：alembic current -> 20260326_0009
    [ ] 检查字段：SELECT column_name FROM information_schema.columns WHERE table_name='food_packages'

[ ] 0010 - 执行 "添加性能索引"
    [ ] 验证：alembic current -> 20260326_0010
    [ ] 检查索引：\di idx_*

[ ] 0011 - 执行 "启用 RLS"（可选）
    [ ] 验证：SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public'

[ ] 0012 - 执行 "启用扩展"（可选）
    [ ] 验证：SELECT * FROM pg_extension
```

---

## 🐛 故障排除

### Q: 迁移 0008 失败 - "约束已存在"
A: 已安装的约束可能来自初始迁移。运行：
```bash
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'food_bank_hours';
```
对照后手动删除或修改迁移文件。

### Q: 迁移 0010 部分索引创建失败
A: 部分索引可能包含语法问题。检查 PostgreSQL 版本 (需 >= 9.2)：
```bash
SELECT version();
```

### Q: 迁移 0011 (RLS) 策略无效
A: 应用层需要设置会话变量：
```python
# 在 SQL 连接前执行
engine.execute("SET app.current_user_id = '{user_id}'")
```

---

## 📊 最终验证

执行完所有迁移后，运行完整检查：

```bash
# 1. 检查迁移链
alembic heads
alembic branches

# 2. 查看所有表
\dt (在 psql 中)

# 3. 验证关键字段
psql -U foodbank -d foodbank -c "
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;"

# 4. 检查索引数量
psql -U foodbank -d foodbank -c "\di"

# 5. 数据一致性检查
python /workspaces/foodbank/backend/alembic/verify_migration.py
```

---

## 🎯 预期最终状态

**迁移完成后的数据库：**
- 版本：20260326_0012 (head)
- 表数：14 张（应和初始表数一致）
- 索引数：20+
- 有效字段：所有关键表都有 created_at, updated_at, deleted_at
- 约束：完整的业务规则约束（checks, FKs, uniques）

**关键改进：**
- ✅ 库存管理升级：库存批次追踪（inventory_lots）
- ✅ 周期管理改进：applications.week_start 替代 weekly_period
- ✅ 审核追踪完整：所有表都有软删除支持
- ✅ 查询性能优化：关键表都有性能索引
- ✅ 可选安全加固：RLS 策略（可选启用）

---

## 🚀 后续步骤

迁移完成后：

1. **运行测试**
   ```bash
   cd /workspaces/foodbank/backend
   pytest tests/ -v
   ```

2. **启动后端**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

3. **前端连接测试**
   ```bash
   cd /workspaces/foodbank/frontend
   npm run dev
   ```

4. **生成迁移历史报告**
   ```bash
   alembic history > migration_report.txt
   ```

---

## 📞 获取帮助

- **检查当前版本**：`alembic current`
- **查看可应用迁移**：`alembic current -v`
- **回滚单个迁移**：`alembic downgrade -1`
- **查看 SQL**（离线模式）：`alembic current --sql`

---

**创建时间**：2026-03-26  
**作者**：GitHub Copilot  
**版本**：1.0
