# 申领 API 批次库存实现文档

## 实现概述

修改 `backend/app/routers/applications.py` 中的 `POST /applications` 处理函数，以实现原子性的批次库存扣减。

## 实现细节

### 1. 导入新增模块
- `InventoryLot`: 批次库存模型
- `PackageItem`: 包裹配方模型
- `and_`: SQLAlchemy 条件组合

### 2. FEFO 扣减函数 `_deduct_inventory_lots_by_fefo()`

**目的**: 按先进先出 (FEFO) 原则从库存批次中扣除原料

**逻辑流程**:
1. 获取包裹的配方（package_items）
2. 对于配方中的每个原料：
   - 计算所需总数量 = 配方中的数量 × 申领包裹数
   - 查询该原料的库存批次，按过期日期升序排列（FEFO）
   - 检查库存充足性
   - 按顺序扣减批次库存，直到需求满足
   - 如果批次已空，标记为已删除（软删除）

**异常处理**:
- 若库存不足，抛出 400 错误，包含具体缺口信息

### 3. 事务流程更新

在 `async with db.begin():` 事务中的执行顺序：

1. **检查周限额** ✅ (已有)
   - 查询用户本周已申领数量
   - 验证不超过3件

2. **验证包裹基本信息** ✅ (已有)
   - 包裹存在性
   - 包裹是否活跃
   - 包裹所属食物银行一致性
   - 食物银行ID 与请求匹配

3. **检查包裹库存 + 扣减批次库存** ✅ (新增)
   ```python
   for package_id, requested_qty in requested_by_package.items():
       package = packages[package_id]
       if package.stock < requested_qty:
           raise HTTPException(...)
       
       # 按 FEFO 原则扣减原料批次库存
       await _deduct_inventory_lots_by_fefo(db, package_id, requested_qty)
   ```

4. **生成兑换码和创建应用** ✅ (已有)
   - 生成唯一兑换码
   - 创建 Application 记录
   - flush 以获取 application.id

5. **扣减包裹库存 + 创建明细** ✅ (已有)
   - 更新包裹 stock 和 applied_count
   - 为每个包裹创建 ApplicationItem 记录

6. **提交事务**
   - 通过 flush 和 refresh 确保所有数据已写入

### 隔离机制

- **行级锁**: `with_for_update()` 用于 InventoryLot 查询
  - 防止多个申领并发竞争

- **事务隔离**: `async with db.begin()`
  - 任何异常自动回滚全部更改

## 请求体格式

```json
POST /api/v1/applications
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "food_bank_id": 1,
  "week_start": "2026-03-23",
  "items": [
    {
      "package_id": 10,
      "quantity": 2
    }
  ]
}
```

**字段说明**:
- `food_bank_id` (必需): 食物银行 ID
- `week_start` (可选): 周一日期 (YYYY-MM-DD)。若不提供则使用当前周一
- `items` (必需): 非空数组，每个元素包含：
  - `package_id`: 包裹 ID (> 0)
  - `quantity`: 数量 (≥ 1)

## 响应格式

**成功 (201 Created)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "food_bank_id": 1,
  "redemption_code": "FB-ABC123",
  "status": "pending",
  "week_start": "2026-03-23",
  "total_quantity": 2,
  "created_at": "2026-03-26T10:30:00+00:00",
  "updated_at": "2026-03-26T10:30:00+00:00",
  "deleted_at": null
}
```

**失败情况**:
- `400 Bad Request`: 
  - 周限额超出
  - 包裹库存不足
  - 原料批次库存不足
  - 包裹ID不匹配或不存在
- `409 Conflict`:
  - 包裹不活跃
  - 应用冲突

## 测试用例

### 测试场景 1: 正常申领

**前置条件**:
1. 食物银行 FB-1 存在
2. 包裹 PKG-100 存在，配方：
   - Item-1: 2 罐（配方数量）
   - Item-2: 1 盒（配方数量）
3. Item-1 有充足的库存批次（≥ 4 罐，如果申领 2 个包裹）
4. Item-2 有充足的库存批次（≥ 2 盒）
5. 用户本周未申领过

**操作**:
```bash
curl -X POST http://localhost:8000/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "food_bank_id": 1,
    "items": [
      {"package_id": 100, "quantity": 2}
    ]
  }'
```

**预期结果**:
- HTTP 201 Created
- applications 表新增记录，week_start 为当周一
- application_items 新增 1 条记录
- inventory_lots 对应批次数量减少：
  - Item-1 的批次：减少 4 罐（2 个包裹 × 2 罐/包裹）
  - Item-2 的批次：减少 2 盒（2 个包裹 × 1 盒/包裹）
- food_packages PKG-100 的 stock 减少 2，applied_count 增加 2

### 测试场景 2: 周限额超出

**前置条件**:
1. 同测试 1
2. 用户本周已申领 2 件

**操作**: 同测试 1（但 quantity: 2）

**预期结果**:
- HTTP 400 Bad Request
- detail: "Weekly limit exceeded"
- 数据库无任何变化

### 测试场景 3: 原料库存不足

**前置条件**:
1. 食物银行、包裹、配方同测试 1
2. Item-1 库存不足（仅 2 罐，但需要 4 罐申领 2 个包裹）
3. 用户本周未申领

**操作**: 同测试 1

**预期结果**:
- HTTP 400 Bad Request
- detail: "Insufficient inventory for ingredient <id> (need 4, available 2)"
- 数据库无任何变化

### 测试场景 4: FEFO 原则验证

**前置条件**:
1. Item-1 有 2 个库存批次：
   - Lot-A: 2 罐，过期日期 2026-04-30
   - Lot-B: 4 罐，过期日期 2026-05-31
2. 申领 2 个包裹（需要 4 罐 Item-1）

**操作**: 同测试 1

**预期结果**:
- Lot-A: 数量从 2 减至 0，marked as deleted
- Lot-B: 数量从 4 减至 2
- 确认 Lot-A （较早过期）被优先使用

### 测试场景 5: 包裹不活跃

**前置条件**:
1. 包裹 PKG-100 已被停用（is_active = false）
2. 其他条件同测试 1

**操作**: 同测试 1

**预期结果**:
- HTTP 409 Conflict
- detail: "One or more selected packages are inactive"
- 数据库无任何变化

## 验证检查列表

- [ ] 导入语句完整（and_, InventoryLot, PackageItem）
- [ ] _deduct_inventory_lots_by_fefo() 函数存在且逻辑正确
- [ ] 调用了 _deduct_inventory_lots_by_fefo() 进行原料扣减
- [ ] 所有操作在 async with db.begin() 事务内
- [ ] 异常处理完整（400、409 等）
- [ ] 没有语法错误 (通过 get_errors)
- [ ] 通过至少 3 个测试场景

## 时间戳处理

注意 InventoryLot.deleted_at 使用了 datetime.now(datetime.now().astimezone().tzinfo)，
这样可确保时区一致性。考虑改为数据库函数（如 PostgreSQL 的 NOW()）以获得更好的精度和一致性。

## 后续改进

1. 可添加 logging 记录库存扣减详情
2. 可实现库存预留机制（inventory reservation）
3. 可添加库存扣减历史审计表
4. 可优化并发性能（当前使用行级锁）
