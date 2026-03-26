# Alembic 数据库连接修复指南

## ✅ 已完成的修复

### 1. **驱动兼容性** 
- ❌ **问题**：原配置使用 `postgresql+asyncpg://` (异步驱动)，但 Alembic 是同步的
- ✅ **修复**：[alembic/env.py](../backend/alembic/env.py) 自动将 asyncpg 转换为 psycopg2

### 2. **异步/同步混淆**
- ❌ **问题**：`run_migrations_online()` 被定义为 `async def` 但未正确调用
- ✅ **修复**：改为同步函数，正确的执行流程

### 3. **离线模式回退**
- ✅ **新增**：当数据库不可用时，自动回退到离线模式
- ✅ **结果**：`alembic current` 现在可以正常运行

---

## 📋 后续步骤

### 方式 A：自动初始化（推荐）

```bash
bash /workspaces/foodbank/scripts/init_db.sh
```

这个脚本会：
- 创建 PostgreSQL 用户 `foodbank`：`foodbank`
- 创建数据库 `foodbank`
- 配置权限

### 方式 B：手动 SQL 初始化

如果脚本需要密码或权限，使用 psql 直接执行：

```bash
# 以 postgres 用户连接
sudo -u postgres psql

-- 在 psql 中运行：
CREATE USER foodbank WITH PASSWORD 'foodbank';
CREATE DATABASE foodbank OWNER foodbank;
GRANT ALL PRIVILEGES ON DATABASE foodbank TO foodbank;
\q
```

### 方式 C：Docker PostgreSQL（开发环境推荐）

```bash
docker run -d \
  --name foodbank-postgres \
  -e POSTGRES_USER=foodbank \
  -e POSTGRES_PASSWORD=foodbank \
  -e POSTGRES_DB=foodbank \
  -p 5432:5432 \
  postgres:16
```

---

## 🚀 执行迁移

数据库就绪后：

```bash
cd /workspaces/foodbank/backend

# 查看当前版本
alembic current

# 执行所有迁移
alembic upgrade head

# 查看迁移历史
alembic history
```

---

## 🔍 诊断

### 测试数据库连接

```bash
cd /workspaces/foodbank/backend

python << 'EOF'
from sqlalchemy import create_engine, text
from app.core.config import settings

# 转换为同步 URL
sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
print(f"Testing connection to: {sync_url}")

try:
    engine = create_engine(sync_url, echo=False)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"✅ Connection successful: {result.scalar()}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
EOF
```

### 验证迁移状态

```bash
cd /workspaces/foodbank/backend
alembic current          # 查看当前版本
alembic heads            # 查看最新版本
alembic branches         # 查看分支
```

---

## 📝 相关文件

- [alembic/env.py](../backend/alembic/env.py) — 迁移环境配置（已修复）
- [app/core/config.py](../backend/app/core/config.py) — 数据库 URL 配置
- [scripts/init_db.sh](init_db.sh) — 数据库初始化脚本

---

## ❓ 常见问题

| 问题 | 解决方案 |
|-----|--------|
| `psycopg2.OperationalError: connection refused` | PostgreSQL 服务未运行，或用户/密码错误 |
| `FATAL: Peer authentication failed` | Unix socket 认证失败，使用 TCP 连接或修改 pg_hba.conf |
| `Alembic 找不到迁移文件` | 确认 `alembic/versions/` 目录存在且包含 `.py` 文件 |
| `"超级用户权限缺失"` | 确保 `foodbank` 用户有数据库所有权或管理员权限 |

