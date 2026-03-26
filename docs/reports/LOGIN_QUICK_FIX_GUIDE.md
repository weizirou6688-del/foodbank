# 🚀 登录故障排查指南

## 📌 当前系统状态: ✅ 全部正常

已验证:
- ✅ 后端API服务器 (Port 8000) 
- ✅ 前端服务器 (Port 5173)
- ✅ 所有登录端点正常
- ✅ 演示账户已创建

---

## 🔐 演示账户

### 方式1: 快速复制粘贴

**管理员账户**
- 邮箱: `admin@foodbank.com`
- 密码: `admin123`

**超市账户**  
- 邮箱: `supermarket@foodbank.com`
- 密码: `supermarket123`

**公众账户**
- 邮箱: `user@example.com`
- 密码: `user12345`

---

## 📱 如何使用

### 第一步: 打开应用
访问: **http://localhost:5173**

### 第二步: 打开登录模态框
点击右上角的 **"Login"** 按钮

### 第三步: 输入账户信息
- 选择 "Sign In" 标签
- 输入邮箱和密码
- 点击 "Sign In" 按钮

### 第四步: 成功登录
- 管理员和超市用户将被导航到各自的仪表板
- 公众用户将保留在当前页面

---

## 🐛 如果仍然无法登录

### 方案A: 清除浏览器数据
```
1. 按 F12 打开开发者工具
2. 右键点击页面刷新按钮
3. 选择 "Empty cache and hard refresh"
4. 或者清空 Cookie 和 Local Storage
```

### 方案B: 验证服务器协议
```bash
# 检查后端
curl -i http://localhost:8000/health

# 检查前端  
curl -i http://localhost:5173

# 两个都应该返回 200 OK
```

### 方案C: 查看浏览器控制台
```
1. 打开 F12 开发者工具
2. 切换到 "Console" 标签
3. 查看是否有红色错误信息
4. 特别查看网络错误或CORS错误
```

### 方案D: 检查Network标签
```
1. 打开 F12 开发者工具
2. 切换到 "Network" 标签
3. 清空日志
4. 尝试登录
5. 查看 login 请求的状态和响应
```

---

## 🔍 命令行快速测试

### 快速诊断
```bash
cd /workspaces/foodbank
./diagnose_login.sh
```

### 手动测试登录API
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foodbank.com","password":"admin123"}'
```

预期输出包含:
- `access_token`
- `refresh_token`  
- `user` 对象

### 测试新用户注册
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test User",
    "email":"test@example.com",
    "password":"TestPassword123"
  }'
```

---

## ⚙️ 环境配置检查

### 验证后端配置
```bash
# 检查 .env 文件
cat /workspaces/foodbank/.env

# 应该包含:
# DATABASE_URL=postgresql+asyncpg://...
# SECRET_KEY=...
# CORS_ORIGINS=["http://localhost:5173", ...]
```

### 验证前端配置  
```bash
# 检查 .env.local
cat /workspaces/foodbank/.env.local

# 应该包含:
# VITE_API_URL=http://localhost:8000
```

---

## 🛠️ 重启服务器

### 重启后端
```bash
# 终止现有进程
pkill -f "uvicorn app.main:app"

# 启动新服务器
cd /workspaces/foodbank
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
```

### 重启前端
```bash
# 终止现有进程
pkill -f "npm run dev"

# 启动新服务器
cd /workspaces/foodbank
npm run dev &
```

### 完整重启
```bash
# 一次性重启所有服务
pkill -f "uvicorn app.main:app" || true
pkill -f "npm run dev" || true
cd /workspaces/foodbank
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
npm run dev &
echo "✅ Servers restarted"
```

---

## 📊 常见错误信息解释

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Invalid email or password` | 邮箱或密码错误 | 检查演示账户的邮箱是否正确（不是admin@test.com） |
| `Network error during login` | 无法连接后端 | 确保后端运行在8000端口，检查防火墙 |
| `CORS error` | 跨域请求被阻止 | 检查CORS_ORIGINS配置 |
| `Please fill in all fields` | 表单验证 | 确保邮箱和密码都已填写 |
| `Please enter a valid email` | 邮箱格式错误 | 输入正确格式的邮箱地址 |

---

## ✅ 最终检查清单

登录前请确认:

- [ ] 后端服务器运行 (`ps aux | grep uvicorn`)
- [ ] 前端服务器运行 (`ps aux | grep vite`)  
- [ ] 两个服务器监听端口正确 (8000 和 5173)
- [ ] 浏览器可以访问 http://localhost:5173
- [ ] 浏览器可以访问 http://localhost:8000/health
- [ ] 使用了正确的邮箱 (admin@foodbank.com, 不是 admin@test.com)
- [ ] 清空了浏览器缓存 (F12 > Network > Disable cache)

---

## 📞 还需要帮助?

如果以上所有步骤都尝试过仍然无法登录:

1. 运行诊断脚本: `./diagnose_login.sh`
2. 查看完整报告: `LOGIN_DIAGNOSTIC_REPORT.md`
3. 检查后端日志是否有错误
4. 检查浏览器开发者工具的Console和Network标签

---

**最后更新**: 2026-03-25  
**系统状态**: 🟢 全部正常 (All Systems Operational)
