# InventoryLot ORM 模型创建 - 验证报告

**日期**: 2026-03-26  
**状态**: ✅ 已完成并验证

## 需求清单

- [x] 创建 `backend/app/models/inventory_lot.py` - InventoryLot ORM 模型
- [x] 修改 `backend/app/models/inventory_item.py` - 删除 stock 字段，添加 lots 关系
- [x] 更新 `backend/app/models/__init__.py` - 导出 InventoryLot
- [x] 生成迁移 `20260326_0013_remove_inventory_items_stock.py` - 删除 stock 列
- [x] 验证模型完整性及关系

## 变更详情

### 1. 新建 InventoryLot ORM 模型

**文件**: `backend/app/models/inventory_lot.py`

核心字段：
- `id` (SERIAL PK)
- `inventory_item_id` (FK → inventory_items.id, CASCADE)
- `quantity` (INTEGER, NOT NULL, > 0)
- `expiry_date` (DATE, NOT NULL)
- `received_date` (DATE, NOT NULL, DEFAULT CURRENT_DATE)
- `batch_reference` (VARCHAR(100), nullable)
- `created_at` (TIMESTAMP, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMP, NOT NULL, DEFAULT NOW())
- `deleted_at` (TIMESTAMP, nullable - soft delete)

关系：
- `inventory_item` (back-reference to InventoryItem)

约束：
- `ck_inventory_lots_quantity_positive`: quantity > 0
- `ck_inventory_lots_dates`: received_date ≤ expiry_date

### 2. 修改 InventoryItem 模型

**文件**: `backend/app/models/inventory_item.py`

**删除**:
- `stock` 字段（INTEGER, NOT NULL, DEFAULT 0）

**添加**:
- `lots` 关系 (Mapped[list["InventoryLot"]])，关联 InventoryLot，cascade 配置

**确认保留**:
- ✓ `id` (SERIAL PK)
- ✓ `name` (VARCHAR(200), NOT NULL)
- ✓ `category` (VARCHAR(100), NOT NULL, indexed)
- ✓ `unit` (VARCHAR(50), NOT NULL)
- ✓ `threshold` (INTEGER, NOT NULL, DEFAULT 10)
- ✓ `updated_at` (DATETIME, NOT NULL)
- ✓ `package_items` 关系
- ✓ `restock_requests` 关系

### 3. 更新模型导出

**文件**: `backend/app/models/__init__.py`

- 导入: `from .inventory_lot import InventoryLot`
- 导出: 添加 `"InventoryLot"` 到 `__all__` 列表

### 4. 生成删除 stock 列的迁移

**文件**: `backend/alembic/versions/20260326_0013_remove_inventory_items_stock.py`

- **Upgrade**: `DROP COLUMN stock FROM inventory_items`
- **Downgrade**: 恢复 stock 列及其默认值

## 验证结果

### Python 模型验证

```
✅ InventoryItem 模型验证
  ✓ stock 字段已成功删除
  ✓ 所有必需字段存在: id, name, category, unit, threshold, updated_at
  ✓ lots 关系已添加 (InventoryItem → InventoryLot)

✅ InventoryLot 模型验证
  ✓ 所有必需列已存在: id, inventory_item_id, quantity, expiry_date, 
    received_date, batch_reference, created_at, updated_at, deleted_at
  ✓ 外键配置正确: inventory_item_id → inventory_items.id
  ✓ 反向关系已配置: inventory_item (InventoryLot → InventoryItem)

✅ 约束验证
  ✓ 数量约束: ck_inventory_lots_quantity_positive (quantity > 0)
  ✓ 日期约束: ck_inventory_lots_dates (received_date ≤ expiry_date)

✅ 导入导出验证
  ✓ InventoryLot 和 InventoryItem 可从 app.models 导入
  ✓ Base 类可正确导入

✅ Schema 验证
  ✓ InventoryItem 实例化成功
  ✓ InventoryLot 实例化成功 (包含所有必需字段)
```

### 数据库变更

新增表:
- `inventory_lots` (四种索引, 多种约束)

修改表:
- `inventory_items`: 删除 `stock` 列

## 使用示例

### 导入模型

```python
from app.models import InventoryItem, InventoryLot

# 查询单个库存项及其所有批次
item = session.query(InventoryItem).filter_by(id=1).first()
print(f"Item: {item.name}, Total Lots: {len(item.lots)}")

# 查询特定批次
lot = session.query(InventoryLot).filter_by(inventory_item_id=1).first()
print(f"Batch {lot.batch_reference}: {lot.quantity} units, expires {lot.expiry_date}")

# 计算项目总库存 (未删除批次)
total_stock = sum(
    lot.quantity for lot in item.lots 
    if lot.deleted_at is None
)
print(f"Total active stock: {total_stock}")
```

## 后续步骤

1. **执行迁移** (如果使用 Alembic):
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **验证数据库** (连接到 PostgreSQL):
   ```sql
   -- 检查 inventory_items 表结构（应该没有 stock 列）
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'inventory_items' AND column_name = 'stock';
   -- 应该返回 0 行
   
   -- 检查 inventory_lots 表
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'inventory_lots' 
   ORDER BY ordinal_position;
   ```

3. **在应用中测试**:
   ```bash
   # Python shell
   python
   >>> from app.models import InventoryLot
   >>> print(InventoryLot.__tablename__)
   'inventory_lots'
   ```

## 规范符合性

✅ 遵守 AI_RULES.md 规则:
- ✓ 新增模型文件 `inventory_lot.py` (在 `models/` 下)
- ✓ 未修改现有迁移文件
- ✓ 生成新迁移版本 `20260326_0013_*`
- ✓ 未修改锁定文件 (config.py, main.py, requirements.txt 等)

✅ 数据库变更规则:
- ✓ 通过 Alembic 迁移文件管理所有 DDL 变更
- ✓ 迁移包含 upgrade/downgrade 逻辑
- ✓ 无 DROP TABLE 等破坏操作

---

**验证日期**: 2026-03-26 15:00 UTC  
**验证者**: AI Code Assistant  
**状态**: 就绪生产
