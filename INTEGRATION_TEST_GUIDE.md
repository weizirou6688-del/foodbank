# 🧪 前端申请表单集成测试指南

## 快速开始

### 三步启动完整集成测试

#### 第1步：启动后端服务（在终端1中）
```bash
cd /workspaces/foodbank/backend
python -m uvicorn app.main:app --reload
```

**预期输出：**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

#### 第2步：启动前端开发服务器（在终端2中）
```bash
cd /workspaces/foodbank/frontend
npm run dev
```

**预期输出：**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

#### 第3步：打开浏览器进行测试（浏览器）
1. 访问 `http://localhost:5173`
2. 打开开发工具 (F12)
3. 进入 **Network** 标签页
4. 按照下面的测试步骤进行

---

## 🎯 完整测试流程

### 步骤1：用户登录和导航
```
1. 登录用户账户
   └─ 使用有效的用户凭证
   
2. 导航到 /find-foodbank
   └─ 选择一个食物银行
   
3. 导航到 /application
   └─ 验证：页面正常加载
   └─ 验证：看到日期选择器
   └─ 验证：默认日期是当前周一
```

### 步骤2：表单交互测试
```
4. 选择周期日期
   └─ 日期选择器应该默认显示当前周一
   └─ 只能选择周一
   └─ 格式应该是 YYYY-MM-DD
   
5. 选择食品包
   └─ 点击食品包卡片
   └─ 验证：卡片显示 "Selected" 标签
   
6. 调整数量
   └─ 使用 +/- 按钮调整
   └─ 验证：数量正确更新
   
7. 点击提交
   └─ 点击 "Submit Application" 按钮
   └─ 验证：按钮能响应
```

### 步骤3：API 请求验证（在 Network 标签中）

**查找请求：**
- 在 Network 标签中查找 `POST` 请求到 `/api/v1/applications`

**验证 Request Payload（请求体）：**

✅ **应该包含的字段：**
```json
{
  "food_bank_id": 1,
  "week_start": "2026-03-23",
  "items": [
    {
      "package_id": 1,
      "quantity": 2
    }
  ]
}
```

❌ **不应该包含的字段：**
- `user_id` - 应由后端从认证令牌提取
- `status` - 应由后端默认为 "pending"
- `food_package_id` - 应使用 `package_id`

**验证 Response (响应)：**

✅ **状态码：** 200 或 201

✅ **响应体应包含：**
```json
{
  "id": 123,
  "user_id": "550e8400-e29b-41d4-a716-...",
  "food_bank_id": 1,
  "week_start": "2026-03-23",
  "status": "pending",
  "redemption_code": "FB-ABC123",
  "created_at": "2026-03-26T...",
  "updated_at": "2026-03-26T..."
}
```

### 步骤4：UI 反馈验证

```
8. 提交后
   └─ 验证：显示成功模态框
   └─ 验证：显示兑换码 (格式: FB-XXXXXX)
   └─ 验证：能点击 "Done" 按钮

9. 关闭模态框
   └─ 验证：返回主页
```

---

## 📋 完整检查清单

### 【UI 验证】
- [ ] /application 路由可访问
- [ ] 日期选择器显示并默认为当前周一
- [ ] 食物银行信息正确显示
- [ ] 食品包卡片可见且可点击
- [ ] 数量调整功能正常
- [ ] 提交按钮可响应

### 【API 验证】
- [ ] Request 包含 `food_bank_id`
- [ ] Request 包含 `week_start` (格式 YYYY-MM-DD)
- [ ] Request 包含 `items` 数组
- [ ] `items` 中使用 `package_id` (不是 `food_package_id`)
- [ ] Request 不包含 `user_id`
- [ ] Request 不包含 `status`

### 【响应验证】
- [ ] 状态码 200 或 201
- [ ] Response 包含 `id`
- [ ] Response 包含 `redemption_code`
- [ ] Response 包含 `week_start`
- [ ] Response 包含 `status` = "pending"

### 【数据库验证】(可选)
```sql
-- 连接数据库并运行
SELECT * FROM applications 
ORDER BY created_at DESC 
LIMIT 1;
```
- [ ] 新记录已创建
- [ ] `week_start` 值正确
- [ ] `status` = 'pending'
- [ ] `redemption_code` 符合格式 FB-XXXXXX

---

## 🔧 故障排除

### 问题：后端无法连接到 http://localhost:8000
**解决方案：**
1. 确保后端进程未被其他应用占用
2. 检查 8000 端口是否被占用: `lsof -i :8000`
3. 终止占用进程或选择其他端口

### 问题：前端无法连接到后端
**解决方案：**
1. 验证后端确实运行在 http://localhost:8000
2. 查看浏览器控制台错误信息
3. 检查 CORS 配置

### 问题：提交返回 401 (Unauthorized)
**解决方案：**
1. 确认用户已登录
2. 检查认证令牌是否有效
3. 查看后端认证日志

### 问题：提交返回 422 (Unprocessable Entity)
**解决方案：**
1. 检查 Request 格式是否正确
2. 验证 `week_start` 是否为有效的周一日期
3. 检查 `package_id` 和 `quantity` 是否有效

### 问题：日期选择器显示灰色/禁用
**解决方案：**
1. 检查浏览器是否支持 HTML5 date input
2. 尝试使用第二天（周一）之外的日期
3. 清除浏览器缓存重试

---

## ⚡ 快速命令参考

### 使用 curl 测试 API
```bash
curl -X POST http://localhost:8000/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "food_bank_id": 1,
    "week_start": "2026-03-23",
    "items": [
      {"package_id": 1, "quantity": 2}
    ]
  }'
```

### 使用 Python 测试 API
```python
import requests

data = {
    "food_bank_id": 1,
    "week_start": "2026-03-23",
    "items": [
        {"package_id": 1, "quantity": 2}
    ]
}

headers = {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
}

response = requests.post(
    "http://localhost:8000/api/v1/applications",
    json=data,
    headers=headers
)

print(response.json())
```

### 查看后端日志
```bash
# 后端窗口中应该看到请求日志
INFO:     127.0.0.1:xxxxx - "POST /api/v1/applications HTTP/1.1" 201 Created
```

---

## 📊 预期的测试时间表

| 时间 | 操作 | 预期结果 |
|------|------|---------|
| T0 | 启动后端 | 服务运行在 8000 |
| T3 | 启动前端 | 服务运行在 5173 |
| T35 | 访问前端 | 首页加载 |
| T40 | 登录 | 进入系统 |
| T50 | 导航到 /application | 页面加载，显示表单 |
| T55 | 填表并提交 | API 请求发送 |
| T57 | 查看响应 | 看到兑换码 |
| T60 | 数据库查询 | 新记录已创建 |

**总时间：60 秒左右**

---

## ✅ 成功标志

如果你看到以下结果，说明集成测试成功了：

1. ✅ 表单能正常加载和提交
2. ✅ Network 标签显示正确的请求格式
3. ✅ 响应包含有效的兑换码
4. ✅ 前端显示成功消息
5. ✅ 数据库中有新的申请记录

---

## 📚 相关文档

- [FRONTEND_APPLICATION_FORM_IMPLEMENTATION.md](./FRONTEND_APPLICATION_FORM_IMPLEMENTATION.md) - 详细实现文档
- [integration_test.py](./integration_test.py) - 自动化验证脚本
- [run_integration_test.sh](./run_integration_test.sh) - 快速启动脚本

---

## 💡 提示

- **保持 Network 标签打开**：这样可以实时看到 API 请求和响应
- **使用浏览器的 Console 标签**：查看 JavaScript 错误
- **检查后端日志**：调试服务器端问题
- **多次测试**：确保一致性和稳定性

---

**创建时间：2026-03-26**  
**状态：✅ 准备就绪**
