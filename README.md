# ABC Community Food Bank

一个面向公众用户、超市合作方和后台管理员的食物银行信息与运营管理系统。当前仓库包含 React + TypeScript 前端、FastAPI 后端和 PostgreSQL 数据层，覆盖找 food bank、现金/物资捐赠、物资包申请、库存管理、补货请求、兑换码核销和统计仪表板。

## 当前功能

### 公众端

- 首页、找 Food Bank、现金捐赠、物资捐赠页面
- 注册、登录、Access Token 刷新、忘记密码验证码重置
- 按英国 postcode 搜索附近 food bank，并在地图上展示位置
- 查看 food package 和可申请单品
- 提交 food package / 单品申请并生成 redemption code

### 超市端

- 超市角色登录
- 查看 low-stock item
- 直接提交已接收的物资捐赠
- 超市捐赠入库后自动同步相关补货请求状态

### 管理端

- Donation Intake：查看、编辑、删除现金/物资捐赠记录
- Inventory：库存品类管理、stock in / stock out、低库存预警
- Inventory Lots：批次、保质期、损耗和废弃记录
- Package Management：food package 维护、配方内容管理、打包入库
- Restock Requests：创建、取消、完成补货请求
- Redemption Codes：按兑换码查询、核销、作废申请
- Statistics Dashboard：捐赠、库存、发放、浪费、核销等分析图表
- 平台管理员和 food bank 本地管理员 scope 控制

## 主要后端 API 模块

| 模块 | 前缀 | 说明 |
| --- | --- | --- |
| Auth | `/api/v1/auth` | 注册、登录、刷新 token、密码重置、当前用户 |
| Food Banks | `/api/v1/food-banks` | food bank 列表、库存、外部 feed、postcode geocode |
| Food Packages | `/api/v1/packages` | package 列表、详情、创建、编辑、删除、打包 |
| Applications | `/api/v1/applications` | 申请提交、我的申请、后台记录、核销、作废 |
| Donations | `/api/v1/donations` | 现金捐赠、物资捐赠、超市捐赠、后台管理 |
| Inventory | `/api/v1/inventory` | 库存品类、lot、stock in/out、low stock |
| Restock Requests | `/api/v1/restock-requests` | 补货请求列表、创建、取消、完成 |
| Statistics | `/api/v1/stats` | public impact、donation stats、dashboard analytics |

## 技术栈

| 层级 | 当前实现 |
| --- | --- |
| 前端框架 | React 18、TypeScript 5、Vite 5 |
| 路由与状态 | React Router 6、Zustand |
| UI 与样式 | Tailwind CSS、CSS Modules、自定义 design tokens、Lucide React |
| 地图与位置 | Leaflet、React Leaflet |
| 图表与导出 | Chart.js（本地 vendor 脚本动态加载）、`xlsx` |
| 后端框架 | FastAPI、Pydantic 2、`pydantic-settings` |
| 数据访问 | SQLAlchemy 2.0 Async、`asyncpg`、`psycopg2-binary`、Alembic |
| 数据库 | PostgreSQL |
| 认证与安全 | JWT Access / Refresh Token、HTTP Bearer、Passlib + bcrypt |
| 邮件能力 | `aiosmtplib`、`email-validator` |
| 测试与开发 | Pytest、HTTPX、Requests、ESLint、Playwright 脚本 |
| 本地启动 | Windows `bat` + PowerShell 脚本、共享 `dev.env` |

## 外接 API / 第三方服务

| 服务 | 当前用途 | 调用方式 | 是否必需 |
| --- | --- | --- | --- |
| `postcodes.io` | 英国 postcode 转经纬度 | 前端直接调用；后端 geocode 也会优先使用 | postcode 搜索必需 |
| OpenStreetMap Nominatim | postcode / 地址 geocode 兜底 | 后端 `/api/v1/food-banks/geocode` fallback | postcode 搜索兜底 |
| Give Food API | 获取外部 food bank 数据源 | 后端代理 `/api/v1/food-banks/external-feed` | 附近 food bank 外部检索依赖 |
| Trussell 站点页面 | 抓取 opening hours | 后端 `/api/v1/food-banks/trussell-hours` | 仅营业时间增强依赖 |
| OpenStreetMap Tile Server | 地图瓦片渲染 | 前端 `Leaflet TileLayer` | 地图显示依赖 |
| SMTP 服务 | 忘记密码邮件、感谢邮件、物资捐赠通知 | 默认 `smtp.gmail.com`，可配置 host/port/account | 邮件功能必需，核心业务非必需 |

补充说明：

- 前端提供 Google Maps 搜索跳转链接，但当前代码没有接入 Google Maps API key。
- 前端还会加载 Google Fonts，页面素材中使用了部分 Unsplash 远程图片；它们属于静态资源依赖，不属于业务 API。

## 目录结构

```text
foodbank/
├─ backend/                 FastAPI、SQLAlchemy、Alembic、测试、seed 脚本
├─ frontend/                React 前端、页面、状态管理、Vite 配置
├─ scripts/                 Windows 启动脚本和辅助脚本
├─ docs/                    项目文档、排障记录、架构说明
├─ dev.env                  前后端共享本地开发端口配置
└─ README.md
```

## 快速启动（Windows）

### 一键启动

双击运行：

```bat
scripts\quick_start.bat
```

或在终端执行：

```bat
cd scripts
quick_start.bat
```

首次启动、本地新库、或拉取新的数据库迁移后，请先执行：

```bash
cd backend
alembic upgrade head
```

脚本会完成这些事情：

- 读取仓库根目录 `dev.env`
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
cd scripts
stop.bat
```

## 手动启动

### 1. 环境要求

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

### 2. 准备数据库

默认本地连接配置：

```text
Database: foodbank
User: foodbank
Password: foodbank
Host: localhost
Port: 5432
```

注意：

- 模型和迁移都依赖 PostgreSQL 的 `pgcrypto` 扩展来提供 `gen_random_uuid()`。
- 最稳妥的初始化方式是先执行 Alembic：

```bash
cd backend
alembic upgrade head
```

- FastAPI 启动时不再执行 `Base.metadata.create_all()` 自动建表。
- 数据库 schema 只通过 Alembic 管理；首次启动、本地新库、或拉取新迁移后，都应先执行 `alembic upgrade head`。

### 3. 配置后端环境变量

```bat
cd backend
copy .env.example .env
```

### 4. 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认地址：

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### 5. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：

- Frontend: `http://localhost:5173`

开发模式下前端通过 Vite 代理把 `/api` 转发到后端；生产构建可通过 `VITE_API_URL` 指定 API Base URL。

## 环境变量

### 根目录 `dev.env`

用于本地开发端口和启动脚本：

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

### `backend/.env`

核心变量来自 `backend/.env.example`：

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `CORS_ORIGINS`
- `APP_NAME`
- `DEBUG`

代码中还支持这些可选邮件变量：

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `PLATFORM_OPERATIONS_EMAIL`
- `OPERATIONS_NOTIFICATION_EMAIL`

如果不配置 SMTP：

- 忘记密码会返回服务不可用
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
- 管理端权限当前主要依赖 JWT、角色校验和 `food_bank_id` scope 控制。
- 仓库里保留了 RLS 相关测试与 Alembic 检查点，但数据库层 RLS 迁移当前仍是 placeholder，并未在迁移中真正启用。
- 物资库存采用 lot 维度管理；部分前端页面为了兼容展示仍会读取聚合后的 `stock` / `total_stock` 字段。
- `Find Food Bank` 功能同时结合了内部 food bank 数据和外部 Give Food 数据源；外部网络不可用时，相关搜索能力会退化。

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
