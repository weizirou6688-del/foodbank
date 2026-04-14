# ABC Community Food Bank

一个面向公众用户、超市合作方和管理员的食物银行平台。当前仓库由 React + TypeScript 前端、FastAPI 后端和 PostgreSQL 数据层组成，覆盖 food bank 查询、现金/物资捐赠、物资包申请、库存 lot 管理、补货请求、兑换码核销和统计仪表板。

本文档基于当前仓库代码整理。下面的技术栈和外接 API 来自 `frontend/package.json`、`backend/requirements.txt`、前后端路由、服务层和启动脚本，而不是旧版文档的推测。

## 当前功能

### 公众端

- 首页、找 Food Bank、现金捐赠、物资捐赠页面
- 注册、登录、Access Token / Refresh Token、忘记密码验证码重置
- 按英国 postcode 搜索附近 food bank，并在地图上展示位置
- 搜索结果会结合系统内 food bank 数据和 Give Food 外部 feed
- 登录后查看 food package、库存单品并提交申请
- 申请成功后生成 redemption code，供管理员核销或作废

### 超市端

- 超市角色登录
- 查看 low-stock item
- 直接提交已接收的物资捐赠并写入库存 lot
- 超市捐赠补足库存后，会自动同步相关补货请求状态

### 管理端

- Donation Intake：查看现金/物资捐赠；平台管理员可修改现金捐赠，管理员可管理物资捐赠
- Inventory：库存品类管理、stock in / stock out、低库存预警
- Inventory Lots：批次、保质期、损耗、废弃和 lot 级调整
- Package Management：food package 维护、配方内容管理、打包入库
- Applications：后台申请记录、兑换码查询、核销、作废
- Restock Requests：创建、取消、完成补货请求
- Statistics Dashboard：捐赠、库存、发放、浪费、核销等分析图表
- 平台管理员与绑定 `food_bank_id` 的本地管理员 scope 控制

## 当前后端 API 模块

| 模块 | 主要路径 | 说明 |
| --- | --- | --- |
| Health | `/`、`/health` | 服务状态、数据库健康检查 |
| Auth | `/api/v1/auth` | 注册、登录、刷新 token、密码重置、当前用户 |
| Food Banks | `/api/v1/food-banks` | food bank 列表、详情、库存、postcode geocode、外部 feed |
| Food Packages | `/api/v1/packages`、`/api/v1/food-banks/{food_bank_id}/packages` | package 列表、详情、创建、编辑、删除、打包 |
| Applications | `/api/v1/applications` | 申请提交、我的申请、后台记录、按兑换码查询、核销、作废 |
| Donations | `/api/v1/donations` | 现金捐赠、物资捐赠、超市捐赠、后台管理 |
| Inventory | `/api/v1/inventory` | 库存品类、lot、stock in/out、low stock |
| Restock Requests | `/api/v1/restock-requests` | 补货请求列表、创建、取消、完成 |
| Statistics | `/api/v1/stats` | donation stats、public impact、dashboard analytics |

后端 OpenAPI 文档默认地址：`http://localhost:8000/docs`

## 技术栈提取结果

### 前端

| 类别 | 当前实现 |
| --- | --- |
| 框架与语言 | React 18、TypeScript 5、Vite 5 |
| 路由与状态 | React Router 6、Zustand、`zustand/middleware/persist` |
| UI 与样式 | Tailwind CSS 3、CSS Modules、自定义 design tokens、Lucide React |
| 地图 | Leaflet、React Leaflet |
| 图表与导出 | Chart.js（本地 `/public/vendor/chart.umd.min.js` 动态加载）、`xlsx` |
| 网络层 | 浏览器 `fetch` 封装的 `apiClient`，开发环境通过 Vite `/api` 代理 |

### 后端

| 类别 | 当前实现 |
| --- | --- |
| Web 框架 | FastAPI、Uvicorn |
| 配置与校验 | Pydantic 2、`pydantic-settings`、`python-dotenv` |
| ORM 与迁移 | SQLAlchemy 2.0 Async、Alembic |
| 数据库驱动 | `asyncpg`、`psycopg2-binary` |
| 数据库 | PostgreSQL，依赖 `pgcrypto` 扩展提供 `gen_random_uuid()` |
| 认证与权限 | PyJWT、FastAPI HTTP Bearer、Passlib + bcrypt、角色 + `food_bank_id` scope |
| 邮件 | `aiosmtplib`、`email-validator` |

### 开发与测试

| 类别 | 当前实现 |
| --- | --- |
| Python 测试 | Pytest、FastAPI `TestClient`，当前保留 `backend/tests/test_smoke.py` 与 `backend/tests/test_admin_smoke.py` 两个冒烟测试 |
| 前端质量 | ESLint |
| 本地启动 | Windows `bat` + PowerShell 脚本、共享 `dev.env` |

## 外接 API / 第三方服务提取结果

### 业务相关外部服务

| 服务 | 当前用途 | 当前调用方式 | 是否关键 |
| --- | --- | --- | --- |
| `postcodes.io` | 英国 postcode 转经纬度 | 后端 `/api/v1/food-banks/geocode` 调用，前端通过本项目 API 间接使用 | postcode 搜索核心依赖 |
| Give Food API | 获取系统外的 food bank feed | 后端代理 `/api/v1/food-banks/external-feed`，前端再消费 | 外部 food bank 搜索依赖 |
| OpenStreetMap Tile Server | 地图瓦片渲染 | 前端 `Leaflet TileLayer` 直接加载 `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | 地图展示依赖 |
| SMTP 服务 | 忘记密码邮件、感谢邮件、物资捐赠通知 | 后端 `email_service.py`，默认主机为 `smtp.gmail.com`，可通过环境变量覆盖 | 邮件功能依赖，核心业务非必需 |

### 非业务型外部资源

- Google Fonts：在 `frontend/index.html` 中加载字体资源。
- Unsplash：部分营销页面和 seed 数据使用远程图片。
- Google Maps 搜索链接：前端会生成带目标地址的外链跳转，点击后可在 Google Maps 页面自动填充目标位置；当前方案不依赖 Google Maps API，也不需要 API key。

## 目录结构

```text
foodbank/
├─ backend/                 FastAPI、SQLAlchemy、Alembic、测试、seed 脚本
├─ frontend/                React 前端、页面、状态管理、Vite 配置
├─ scripts/                 Windows 启动脚本和辅助脚本
├─ docs/                    项目文档、排障记录、架构说明
├─ dev.env                  前后端共享本地开发配置
└─ README.md
```

## 快速启动（Windows）

### 一键启动

先确保：

- 已安装 Node.js 18+
- 已安装 Python 3.11+
- 已安装 PostgreSQL 14+
- 已手动创建 `backend/.env`

首次启动、本地新库或拉取新的数据库迁移后，先执行：

```bash
cd backend
alembic upgrade head
```

然后运行：

```bat
scripts\quick_start.bat
```

或：

```bat
cd scripts
quick_start.bat
```

脚本会完成这些事情：

- 读取根目录 `dev.env`
- 检查 `backend\.env`、Python、Node.js、npm
- 检查数据库连通性
- 启动后端并健康检查 `/health`
- 按需执行 demo data seed
- 启动前端并自动把 `/api` 代理到后端
- 如果默认端口被占用，自动尝试 fallback 端口

运行完成后，实际端口会写入：

- `.logs\backend.port`
- `.logs\frontend.port`

停止服务：

```bat
scripts\stop.bat
```

## 手动启动

### 1. 准备数据库

默认本地连接约定：

```text
Database: foodbank
User: foodbank
Password: foodbank
Host: localhost
Port: 5432
```

注意：

- 模型和迁移依赖 PostgreSQL 的 `pgcrypto` 扩展来提供 `gen_random_uuid()`。
- FastAPI 启动时不会执行 `Base.metadata.create_all()` 自动建表。
- 首次启动、本地新库、或拉取新迁移后，都应先执行 `alembic upgrade head`。

### 2. 创建 `backend/.env`

当前仓库没有提供 `backend/.env.example`，请手动创建 `backend/.env`。最小示例：

```env
DATABASE_URL=postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank
SECRET_KEY=change-this-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_NAME=ABC Community Food Bank API
DEBUG=false
```

可选变量：

- `CORS_ORIGINS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `PLATFORM_OPERATIONS_EMAIL`
- `OPERATIONS_NOTIFICATION_EMAIL`

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

默认地址：

- API：`http://localhost:8000`
- Docs：`http://localhost:8000/docs`
- Health：`http://localhost:8000/health`

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：

- Frontend：`http://localhost:5173`

开发模式下前端通过 Vite 代理把 `/api` 转发到后端；生产构建可通过 `VITE_API_URL` 指定 API Base URL。

## 环境变量

### 根目录 `dev.env`

用于本地开发端口、启动脚本和共享默认值：

```env
DEV_HOST=127.0.0.1
BACKEND_PORT=8000
BACKEND_FALLBACK_PORT_END=8010
FRONTEND_PORT=5173
FRONTEND_FALLBACK_PORT_END=5178
FRONTEND_PREVIEW_PORT=4173
SEED_DEMO_DATA=true
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

补充说明：

- 当前仓库的 `dev.env` 还包含一个本地开发用 `SECRET_KEY`。
- 配置加载顺序是先读根目录 `dev.env`，再读 `backend/.env`；后者会覆盖前者。

### `backend/.env`

建议至少配置这些变量：

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `APP_NAME`
- `DEBUG`

可选邮件变量：

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `PLATFORM_OPERATIONS_EMAIL`
- `OPERATIONS_NOTIFICATION_EMAIL`

如果不配置 SMTP：

- 忘记密码接口会返回服务不可用
- 感谢邮件和物资捐赠通知会跳过发送

## Demo 账号

默认 demo seed 会写入以下账号：

| 角色 | 邮箱 | 密码 | 说明 |
| --- | --- | --- | --- |
| Platform Admin | `admin@foodbank.com` | `admin123` | 全局管理员 |
| Supermarket | `supermarket@foodbank.com` | `supermarket123` | 超市捐赠角色 |
| Public User | `user@example.com` | `user12345` | 普通申请用户 |
| Local Admin | `localadmin@foodbank.com` | `localadmin123` | 绑定 `Downtown Community Food Bank` |
| Local Admin | `local1admin@foodbank.com` | `local1admin123` | 绑定 `Westside Food Support Centre` |

## 当前实现说明

- 后端启动时如果数据库不可用，API 会以 degraded mode 启动，`/health` 会返回 `503` 和错误详情。
- 本地管理员不是单独角色；当前实现是 `role=admin` 加 `food_bank_id` scope。
- 库存按 lot 维度管理，出库采用 FEFO，过期或删除 lot 会影响可用库存统计。
- 申请侧当前有限额：每周最多 3 个 package、最多 5 种单品，且单种单品单次数量不能超过 5。
- `Find Food Bank` 同时结合内部 food bank 数据和外部 Give Food 数据；外部网络不可用时，相关搜索能力会退化。
- 仓库里保留了 RLS 相关测试与 Alembic 检查点，但数据库层 RLS 迁移当前仍是 placeholder，并未真正启用。

## 常用脚本

| 脚本 | 说明 |
| --- | --- |
| `scripts\quick_start.bat` | 一键启动前后端 |
| `scripts\stop.bat` | 停止本地服务 |
| `scripts\start_backend.ps1` | 启动并探活后端 |
| `scripts\start_frontend.ps1` | 启动并探活前端 |
| `backend\scripts\seed_demo_data.py` | 补齐 demo users / food banks / inventory / packages |
| `backend\scripts\check_database.py` | 检查数据库连通性 |
| `scripts\cleanup_analytics_data.bat` | 清理本地 analytics synthetic data |

## 相关文档

- [当前数据库结构快照](docs/DATABASE_SCHEMA_CURRENT.md)
- [后端实现说明](docs/architecture/BACKEND_IMPLEMENTATION.md)
- [前端 API 适配说明](docs/architecture/FRONTEND_API_ADAPTATION.md)
- [Windows 本地数据库与分析数据生成指南](docs/Windows本地数据库与分析数据生成指南_20260329.md)

