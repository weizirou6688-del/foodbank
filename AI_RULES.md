# 项目架构约束（AI 必读）

本文件定义了 AI 在生成或修改代码时必须遵守的规则。任何违反这些规则的建议都应被拒绝。

## 1. 禁止修改的文件夹结构

### 后端（`backend/`）
- `backend/app/models/` —— 现有模型文件的命名和目录结构不得改动（例如 `user.py`, `food_bank.py` 等）。
- `backend/app/schemas/` —— 现有 Schema 文件的划分不得改动。
- `backend/app/routers/` —— 现有路由文件的划分不得改动（如 `auth.py`, `food_banks.py`）。
- `backend/app/modules/` —— 现有模块子目录（如 `auth/`, `food_banks/`）不得重命名或合并。
- `backend/alembic/versions/` —— 现有迁移文件（`20260324_0001_initial_schema.py` 等）**禁止修改**；新的数据库变更必须生成新的版本文件。

**允许新增**：
- 在 `models/` 下新增模型文件。
- 在 `schemas/` 下新增对应的 Schema 文件。
- 在 `routers/` 下新增路由文件。
- 在 `modules/` 下新增功能模块子目录。

### 前端（`frontend/`）
- `frontend/src/components/` —— 现有子目录（`admin/`, `auth/`, `layout/`, `ui/`）的划分不得改动。
- `frontend/src/pages/` —— 现有页面目录（`Admin/`, `DonateCash/`, `DonateGoods/`, `FindFoodBank/`, `FoodPackages/`, `Home/`, `Supermarket/`）不得重命名或合并。
- `frontend/src/services/` —— 现有服务文件（如 `api.ts`）不得移动或重命名。
- `frontend/src/utils/` —— 现有工具函数文件不得移动或重命名。
- `frontend/src/store/` —— 现有状态管理文件（`authStore.ts`, `foodBankStore.ts`）不得重命名或删除。

**允许新增**：
- 在 `components/` 下新增组件文件，但必须放在已有的子目录内（如 `ui/` 或 `auth/`）。
- 在 `pages/` 下新增页面目录。
- 在 `services/` 下新增 API 服务文件。

## 2. 数据库修改规则

本项目使用 **Alembic** 进行数据库迁移（`backend/alembic/`）。

- **禁止**：
  - 修改已有的迁移文件（`versions/` 下的任何 `.py` 文件）。
  - 在生成的 SQL 语句中包含 `DROP TABLE`、`DROP COLUMN` 等破坏性操作（除非用户明确要求且已备份数据）。
- **允许**：
  - 通过 Alembic 生成新的迁移版本（`alembic revision --autogenerate`）。
  - 新迁移文件中允许：
    - `CREATE TABLE`（新增表）
    - `ALTER TABLE ADD COLUMN`（新增列）
    - `ALTER TABLE ALTER COLUMN`（仅限扩大长度或改为 nullable，严禁缩窄类型或改为 NOT NULL 导致数据丢失）
- **操作要求**：
  - 当需要修改数据库时，请先输出将要生成的 Alembic 迁移文件内容，并说明每个变更的目的。
  - 不得直接生成原始 SQL 脚本覆盖现有迁移。

## 3. 代码修改流程

当需要修改现有代码时，AI 必须遵循以下步骤：

1. **先列出修改清单**  
   - 列出将要修改或新增的文件（包括完整路径）。
   - 简要说明每个文件的改动原因（例如“为 `FoodBank` 模型添加 `contact_phone` 字段”）。
2. **等待用户确认**  
   - 在获得用户明确确认（如“确认，开始修改”）之前，不得实际生成或修改任何代码。
3. **一次只处理一个模块**  
   - 例如只改 `backend/app/models/user.py`，或只改 `frontend/src/pages/Admin/Admin.tsx`。
   - 不要一次性大范围重构多个模块。

## 4. 锁定文件

以下文件**除非用户明确要求**，否则不得修改：

- 根目录：`README.md`, `docs/` 下的任何文件（报告、架构文档等）。
- 后端：`backend/requirements.txt`, `backend/alembic.ini`, `backend/app/core/config.py`, `backend/app/main.py`。
- 前端：`frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`。
- 环境变量：`.env` 及 `.env.*` 文件（包括前后端任何 `.env` 文件）。
- 构建输出：`dist/` 目录下的任何文件。

## 5. 技术栈

- **后端**：Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **数据库**：PostgreSQL（通过 SQLAlchemy 和 Alembic 管理）
- **状态管理**：Zustand（`src/store/`）
- **API 通信**：`frontend/src/services/api.ts` 封装的 axios

## 6. 特别注意

- 本项目采用 **前后端分离**，后端 API 前缀通常为 `/api`，前端通过 `services/api.ts` 调用。
- 后端模型（`backend/app/models/`）与 Schema（`backend/app/schemas/`）一一对应，修改时需保持同步。
- 前端页面（`pages/`）应尽量保持逻辑简单，复杂逻辑可抽取到 `services/` 或 `store/`。