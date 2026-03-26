# 前端 API 服务适配文档

## 概述
本文档描述了前端 API 服务中新添加的方法，用于适配后端的新端点。

## 📝 修改的文件
- `frontend/src/shared/lib/api.ts` - 主 API 服务文件
- `frontend/src/services/api.ts` - API stub（自动重新导出）

## ✨ 新增 API 方法

### 1. 打包 API (`packPackage`)

**位置**: `adminAPI.packPackage`

**功能**: 根据指定的数量打包食品包裹（使用 FEFO 原则）

**方法签名**:
```typescript
packPackage(id: number | string, quantity: number, token: string): Promise<PackResponse>
```

**参数**:
- `id`: 食品包裹的 ID
- `quantity`: 要打包的包裹数量
- `token`: 认证令牌（管理员权限）

**请求**:
```
POST /api/v1/packages/{id}/pack
Authorization: Bearer {token}
Content-Type: application/json

{"quantity": 5}
```

**使用示例**:
```typescript
import { adminAPI } from '@/services/api'

try {
  const response = await adminAPI.packPackage(
    1,           // 包裹 ID
    5,           // 打包 5 个
    authToken    // 管理员令牌
  )
  console.log('打包成功:', response)
} catch (error) {
  console.error('打包失败:', error.message)
}
```

**响应**:
```json
{
  "id": 1,
  "name": "防寒套装",
  "category": "衣物",
  "stock": 45,
  "threshold": 20,
  "applied_count": 5,
  "consumed_lots": [
    {
      "lot_id": 101,
      "inventory_item_id": 1,
      "item_name": "毯子",
      "quantity_consumed": 10
    }
  ]
}
```

---

### 2. 库存批次调整 API (`adjustInventoryLot`)

**位置**: `adminAPI.adjustInventoryLot`

**功能**: 调整特定库存批次（批号）的数量或属性

**方法签名**:
```typescript
adjustInventoryLot(lotId: number | string, data: Record<string, any>, token: string): Promise<any>
```

**参数**:
- `lotId`: 库存批次的 ID
- `data`: 调整数据（如 quantity、reason 等）
- `token`: 认证令牌（管理员权限）

**请求**:
```
PATCH /api/v1/inventory/lots/{lotId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "quantity": 50,
  "reason": "报损调整"
}
```

**使用示例**:
```typescript
import { adminAPI } from '@/services/api'

try {
  const response = await adminAPI.adjustInventoryLot(
    101,           // 批次 ID
    {
      quantity: 45, // 新数量
      reason: '盘点后修正' // 调整原因
    },
    authToken      // 管理员令牌
  )
  console.log('库存批次已调整:', response)
} catch (error) {
  console.error('调整失败:', error.message)
}
```

---

### 3. 低库存警报 API (`getLowStockItems`)

**位置**: `adminAPI.getLowStockItems`

**功能**: 获取库存低于阈值的物品列表

**方法签名**:
```typescript
getLowStockItems(token: string, threshold?: number): Promise<LowStockItem[]>
```

**参数**:
- `token`: 认证令牌（管理员权限）
- `threshold`: 可选，覆盖物品的默认阈值（用于查询所有物品当前库存是否低于此值）

**请求**:
```
GET /api/v1/inventory/low-stock                 # 使用默认阈值
GET /api/v1/inventory/low-stock?threshold=100  # 使用自定义阈值
Authorization: Bearer {token}
```

**使用示例**:
```typescript
import { adminAPI } from '@/services/api'

// 获取所有低库存物品（使用物品自己的阈值）
try {
  const items = await adminAPI.getLowStockItems(authToken)
  console.log('低库存物品:', items)
} catch (error) {
  console.error('查询失败:', error.message)
}

// 获取库存低于 100 的物品
try {
  const items = await adminAPI.getLowStockItems(authToken, 100)
  console.log('库存 < 100 的物品:', items)
} catch (error) {
  console.error('查询失败:', error.message)
}
```

**响应**:
```json
[
  {
    "id": 1,
    "name": "毯子",
    "category": "衣物",
    "unit": "件",
    "current_stock": 30,
    "threshold": 50,
    "stock_deficit": 20
  },
  {
    "id": 2,
    "name": "罐头食品",
    "category": "食品",
    "unit": "罐",
    "current_stock": 45,
    "threshold": 100,
    "stock_deficit": 55
  }
]
```

特点:
- 结果按 `stock_deficit` 降序排列（最紧急的物品优先）
- 只统计有效的库存批次（未删除且未过期）
- 支持按自定义阈值覆盖物品的默认阈值

---

### 4. 申请提交 API (`submitApplication`)

**位置**: `applicationsAPI.submitApplication`

**功能**: 提交食品援助申请

**方法签名**:
```typescript
submitApplication(data: ApplicationCreateData, token: string): Promise<ApplicationResponse>
```

**参数**:
- `data`: 申请数据对象，包含：
  - `food_bank_id`: 食品库的 ID
  - `week_start`: 周开始日期（ISO 8601 格式：YYYY-MM-DD）**【重要】**
  - `items`: 申请包裹列表
- `token`: 认证令牌

**请求**:
```
POST /api/v1/applications
Authorization: Bearer {token}
Content-Type: application/json

{
  "food_bank_id": 1,
  "week_start": "2026-03-23",
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
```

**使用示例**:
```typescript
import { applicationsAPI } from '@/services/api'

// 方式 1：指定周开始日期
try {
  const response = await applicationsAPI.submitApplication(
    {
      food_bank_id: 1,
      week_start: '2026-03-23',  // 必须是 YYYY-MM-DD 格式
      items: [
        { package_id: 1, quantity: 2 },
        { package_id: 3, quantity: 1 }
      ]
    },
    authToken
  )
  console.log('申请已提交:', response)
} catch (error) {
  console.error('申请失败:', error.message)
}

// 方式 2：不指定 week_start（服务器使用当前周的周一）
try {
  const response = await applicationsAPI.submitApplication(
    {
      food_bank_id: 1,
      items: [
        { package_id: 1, quantity: 2 }
      ]
    },
    authToken
  )
  console.log('申请已提交:', response)
} catch (error) {
  console.error('申请失败:', error.message)
}
```

**响应**:
```json
{
  "id": 101,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "food_bank_id": 1,
  "redemption_code": "FB-ABC123",
  "status": "pending",
  "week_start": "2026-03-23",
  "total_quantity": 3,
  "items": [
    {
      "id": 1,
      "application_id": 101,
      "package_id": 1,
      "quantity": 2,
      "package_name": "防寒套装"
    },
    {
      "id": 2,
      "application_id": 101,
      "package_id": 3,
      "quantity": 1,
      "package_name": "食品篮"
    }
  ],
  "created_at": "2026-03-26T10:30:00Z",
  "updated_at": "2026-03-26T10:30:00Z"
}
```

**重要改动**:
- ✅ **新**: 使用 `week_start` 字段替代 `weekly_period`
- ✅ **格式**: `week_start` 必须是日期字符串（ISO 8601 格式）
- ✅ **可选**: 如果未提供 `week_start`，服务器会自动使用当前周的周一

---

### 5. 附加的应用 API 方法

#### `getMyApplications`
获取当前用户的所有申请
```typescript
applicationsAPI.getMyApplications(token: string): Promise<ApplicationResponse[]>
```

#### `updateApplicationStatus`
更新申请状态（仅限管理员）
```typescript
applicationsAPI.updateApplicationStatus(
  id: number | string,
  data: { status: 'collected' | 'expired' },
  token: string
): Promise<ApplicationResponse>
```

---

## 🔄 浏览器网络检查

### 如何验证网络请求

1. **打开浏览器开发者工具** (F12 或 Ctrl+Shift+I)
2. **切换到 Network 标签页**
3. **执行相关操作**（如打包、报损、申请等）
4. **检查网络请求**:
   - 请求方法（GET、POST、PATCH）
   - 请求路径
   - 请求标头和请求体
   - 响应状态和数据

### 预期的网络请求示例

#### 打包操作
```
POST /api/v1/packages/1/pack
Headers:
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json
Request Body:
  {"quantity": 5}
Response: 200 OK
  {"id": 1, "name": "防寒套装", ...}
```

#### 获取低库存物品
```
GET /api/v1/inventory/low-stock?threshold=100
Headers:
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json
Response: 200 OK
  [{"id": 1, "name": "毯子", ...}]
```

#### 提交申请
```
POST /api/v1/applications
Headers:
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json
Request Body:
  {
    "food_bank_id": 1,
    "week_start": "2026-03-23",
    "items": [{"package_id": 1, "quantity": 2}]
  }
Response: 201 Created
  {"id": 101, "redemption_code": "FB-ABC123", ...}
```

---

## ✅ 测试清单

使用浏览器开发者工具，验证以下操作:

- [ ] **打包操作**: 打开包裹管理，点击"打包"按钮
  - [ ] 检查请求: `POST /api/v1/packages/{id}/pack`
  - [ ] 检查请求体包含 `quantity` 字段
  - [ ] 检查响应包含 `consumed_lots` 信息

- [ ] **库存调整**: 打开库存管理，调整某个批次
  - [ ] 检查请求: `PATCH /api/v1/inventory/lots/{lotId}`
  - [ ] 检查请求体包含调整数据

- [ ] **查看低库存**: 打开库存警报页面
  - [ ] 检查请求: `GET /api/v1/inventory/low-stock`
  - [ ] 检查响应包含低库存物品列表
  - [ ] 检查物品按 `stock_deficit` 降序排列

- [ ] **提交申请**: 点击"申请援助"
  - [ ] 检查请求: `POST /api/v1/applications`
  - [ ] 检查请求体包含 `week_start`（不是 `weekly_period`）
  - [ ] 验证 `week_start` 格式为 YYYY-MM-DD
  - [ ] 检查响应包含 `redemption_code`

---

## 🐛 故障排除

### 错误: "Insufficient inventory"
- 检查库存是否足够
- 验证库存批次未过期
- 检查批次是否被标记为已删除

### 错误: "Weekly limit exceeded"
- 检查用户在本周是否已申请超过 3 个包裹
- 尝试在下一周重新申请

### 错误: "Package not found"
- 验证包裹 ID 是否正确
- 检查包裹是否存在且处于活跃状态

### 网络请求失败
- 检查认证令牌是否有效
- 验证用户是否有管理员权限（对于 admin API）
- 检查服务器是否在线和可访问

---

## 📚 参考链接

- 后端实现: [Backend Implementation](./BACKEND_IMPLEMENTATION.md)
- Task 6 总结: [Task 6 Summary](/TASK_6_SUMMARY.md)
- 库存批次实现: [Inventory Lot Implementation](/INVENTORY_LOT_IMPLEMENTATION.md)
