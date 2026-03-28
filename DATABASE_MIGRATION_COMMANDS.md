# 数据库迁移常用命令

## 🔍 检查和验证

### 当前迁移版本
```bash
cd backend
alembic current

# 输出示例:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] Will assume transactional DDL.
# 20260326_0013 (head)
```

### 迁移历史
```bash
alembic history --verbose

# 显示所有应用的迁移及其 revision id
```

### 特定表的结构
```bash
# 查看 inventory_lots 表
psql -h localhost -U foodbank -d foodbank -c "\d inventory_lots"

# 查看 inventory_items 表
psql -h localhost -U foodbank -d foodbank -c "\d inventory_items"
```

### 索引检查
```bash
# 所有 inventory_lots 索引
psql -h localhost -U foodbank -d foodbank -c "SELECT indexname FROM pg_indexes WHERE tablename = 'inventory_lots';"

# 所有索引大小
psql -h localhost -U foodbank -d foodbank -c "SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size FROM pg_stat_user_indexes WHERE relname = 'inventory_lots';"
```

### RLS 策略检查
```bash
psql -h localhost -U foodbank -d foodbank -c "SELECT schemaname, tablename, policyname FROM pg_policies;"

# 带有策略详情
psql -h localhost -U foodbank -d foodbank -c "SELECT * FROM pg_policies WHERE schemaname = 'public';"
```

### 约束检查
```bash
# inventory_lots 的所有约束
psql -h localhost -U foodbank -d foodbank -c "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'inventory_lots';"
```

---

## 📊 数据查询

### 库存项目概览
```bash
psql -h localhost -U foodbank -d foodbank -c "SELECT COUNT(*) as item_count FROM inventory_items WHERE deleted_at IS NULL;"
```

### 批次概览
```bash
psql -h localhost -U foodbank -d foodbank -c "
SELECT 
  COUNT(*) as total_lots,
  SUM(quantity) as total_quantity,
  COUNT(DISTINCT inventory_item_id) as unique_items,
  COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END) as expired,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted
FROM inventory_lots;
"
```

### 按项目统计库存
```bash
psql -h localhost -U foodbank -d foodbank -c "
SELECT 
  ii.name,
  ii.category,
  COUNT(il.id) as lot_count,
  COALESCE(SUM(il.quantity), 0) as total_quantity
FROM inventory_items ii
LEFT JOIN inventory_lots il ON ii.id = il.inventory_item_id AND il.deleted_at IS NULL
WHERE ii.deleted_at IS NULL
GROUP BY ii.id, ii.name, ii.category
ORDER BY total_quantity DESC;
"
```

### 查看即将过期的批次
```bash
psql -h localhost -U foodbank -d foodbank -c "
SELECT 
  ii.name,
  il.quantity,
  il.expiry_date,
  (il.expiry_date - CURRENT_DATE) as days_until_expiry
FROM inventory_lots il
JOIN inventory_items ii ON ii.id = il.inventory_item_id
WHERE il.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND il.deleted_at IS NULL
ORDER BY il.expiry_date ASC;
"
```

---

## 🔄 迁移操作

### 应用所有待处理的迁移
```bash
cd backend
alembic upgrade head
```

### 查看待应用的迁移
```bash
alembic heads
```

### 升级到特定版本
```bash
# 升级到特定版本
alembic upgrade 20260326_0010

# 升级到最新版本
alembic upgrade head

# 升级指定个数的迁移
alembic upgrade +1  # 升级 1 个
alembic upgrade +3  # 升级 3 个
```

### 回滚迁移
```bash
# 回滚到特定版本
alembic downgrade 20260326_0006

# 回滚指定个数的迁移
alembic downgrade -1  # 回滚 1 个
alembic downgrade -3  # 回滚 3 个

# 回滚到初始版本
alembic downgrade base
```

### 生成新的迁移
```bash
# 创建新的自动迁移（基于模型变更）
alembic revision --autogenerate -m "描述你的变更"

# 创建空的迁移
alembic revision -m "描述你的变更"
```

---

## ⚠️ 特殊操作

### 启用 RLS（如需要）

```bash
psql -h localhost -U foodbank -d foodbank << EOF
-- 1. 启用表上的 RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. 创建基本策略（示例）
CREATE POLICY user_isolation ON users
  USING (id = current_setting('app.current_user_id')::uuid);

-- 3. 启用策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. 验证
SELECT schemaname, tablename, policyname FROM pg_policies;
EOF
```

### 启用 pg_stat_statements（如需要超级用户）

```bash
# 1. 以超级用户连接
psql -h localhost -U postgres -d foodbank

# 2. 创建扩展
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

# 3. 查看统计信息
SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### 数据库备份

```bash
# 完整备份
pg_dump -h localhost -U foodbank -d foodbank -F custom -f foodbank_backup.dump

# 恢复备份
pg_restore -h localhost -U foodbank -d foodbank -F custom foodbank_backup.dump

# SQL 导出
pg_dump -h localhost -U foodbank -d foodbank > foodbank_backup.sql
```

---

## 🚨 故障排查

### 迁移失败重试

```bash
# 1. 检查当前版本
alembic current

# 2. 查看最后的错误
alembic upgrade head --sql  # 查看要执行的 SQL（不实际执行）

# 3. 手动运行迁移
alembic upgrade 20260326_0013

# 4. 如果需要回滚
alembic downgrade 20260326_0012
```

### 查看迁移 SQL

```bash
# 查看将要执行的 SQL（模拟运行）
alembic upgrade head --sql

# 这样可以在实际应用前查看具体的 SQL 语句
```

### 连接测试

```bash
# 测试数据库连接
psql -h localhost -U foodbank -d foodbank -c "SELECT version();"

# 查看版本信息
psql -h localhost -U foodbank -d foodbank -c "SELECT version();"
```

### 检查表空间

```bash
# 所有表的大小
psql -h localhost -U foodbank -d foodbank -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 特定表的详细大小
psql -h localhost -U foodbank -d foodbank -c "
SELECT 
  'table' as type, tablename as name, 
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'inventory_lots'
UNION ALL
SELECT 
  'index', indexname, 
  pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE relname = 'inventory_lots';
"
```

---

## 📝 环境变量

### 后端 .env 配置示例
```bash
# database
DATABASE_URL=postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank

# alembic.ini 也需要对应的连接字符串
sqlalchemy.url = driver://user:password@localhost/dbname
```

---

## 🔐 安全注意事项

- ✅ 生产环境迁移前备份数据
- ✅ 在非生产环境先测试迁移
- ✅ 保存迁移前的数据库快照
- ✅ RLS 启用前验证应用层支持
- ✅ pg_stat_statements 启用前了解性能影响

---

## 📞 常见问题

**Q: 为什么 stock 列被移除了？**  
A: `inventory_items.stock` 已被 `inventory_lots` 表的批次管理完全替代，支持更细粒度的库存追踪。

**Q: 我的旧代码访问 `InventoryItem.stock` 会怎样？**  
A: 会抛出 `AttributeError`。需要更新代码以使用 `inventory_item.lots` 关系。

**Q: 如何查询某个项目的总库存？**  
A: 使用:
```python
total = sum(lot.quantity for lot in item.lots if lot.quantity > 0 and not lot.deleted_at)
```

**Q: 可以回滚迁移吗？**  
A: 可以，使用 `alembic downgrade` 命令。所有迁移都支持回滚。

**Q: 迁移会影响性能吗？**  
A: 迁移期间会有短暂的锁定。新索引实际上会改善长期性能。

---

**最后更新**: 2026-03-27  
**当前版本**: 20260326_0013
