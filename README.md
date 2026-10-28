# 房产交易数字化协同平台（property-trade-platform）

面向房产交易的 B/S Web 协同平台 Demo（软著演示口径），覆盖「房源—带看—签约—交易进度」全链路，C 端门户与 B 端工作台同源按角色分流。

- **软件全称**：房产交易数字化协同平台 V1.0（演示环境）
- **产品形态**：Web 前后端分离（React SPA + NestJS API），PC 优先、响应式兼容移动浏览器
- **数据层**：SQLite（Prisma，可切 PostgreSQL）；外部系统全部本地 Mock
- **当前阶段**：M1 契约与数据基座（M0 已确认）

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 + React Router |
| 后端 | NestJS 11 + TypeScript + Prisma 6 + JWT |
| 数据库 | SQLite（schema 保持 PostgreSQL 兼容） |
| 验收 | Vitest + Supertest（API）、Playwright（E2E / 角色截图） |

## 目录结构

```text
property-trade-platform/
├─ server/                # NestJS API
│  ├─ prisma/             # schema、migration、seed、validate
│  ├─ src/                # 模块：auth / public / dicts / notifications / health
│  └─ test/               # API 验收（vitest + supertest）
├─ web/                   # React SPA（C 端门户 + B 端工作台）
│  ├─ src/pages/c/        # C 端页面
│  └─ src/pages/b/        # B 端页面
├─ e2e/                   # Playwright 用例与截图脚本
├─ docs/                  # 00 画像 / 01 阶段 / 02 契约 / 03 数据 / 04 权限 / 05+ 报告
├─ STATUS.md              # 当前状态（新会话先读）
├─ DECISIONS.md           # 决策日志
├─ PLAN-MATRIX.md         # 方案-实现追踪
└─ package.json           # npm workspaces 入口
```

## 快速开始

```powershell
npm install          # 安装依赖（npm workspaces）
npm run db:reset     # 重置 SQLite + 迁移 + 种子 + 49 项数据校验
npm run dev          # 并行启动 API(3000) 与 Web(5173)
```

访问 <http://127.0.0.1:5173>；API 文档级契约见 `docs/02-接口契约.md`，健康检查 <http://127.0.0.1:3000/api/health>。

## 演示账号（密码统一 `123456`）

| 角色 | 手机号 | 姓名 | 入口 |
| --- | --- | --- | --- |
| 买方 | 13800000040 | 张伟 | C 端门户 |
| 卖方 | 13800000060 | 高强 | C 端门户 |
| 经纪人 | 13800000020 | 陈志远 | B 端工作台 |
| 店长 | 13800000003 | 赵敏 | B 端工作台 |
| 财务 | 13800000002 | 邱丽 | B 端工作台 |
| 平台管理员 | 13800000001 | 平台管理员 | B 端工作台 |

验证码登录为 Mock：验证码固定 `123456`。

## 验收命令

| 命令 | 说明 |
| --- | --- |
| `npm run db:reset` | 数据库重建 + 种子 + 数据质量校验（49 项） |
| `npm run build` | 前后端构建 + 类型检查 |
| `npm run test:api` | API 验收（18 项，M1） |
| `npm run test:e2e` | UI E2E（Playwright） |
| `npm run verify` | db:reset + build + test:api + test:e2e 全量 |
| `npm run screenshots` | 按角色截图到 `docs/screenshots/` |

## Mock 与合规说明

- 电子签、支付、短信、实名认证、地图均为本地 Mock，**不具法律效力、不产生真实费用**；UI 标注「演示环境」。
- 数据全部为虚构机构/小区/姓名；身份证号仅用于校验位演示，脱敏存储。
- 本项目**不制作软著登记材料**（决策 D08），仅交付可运行 Demo 与工程文档。

## 文档入口

| 文档 | 说明 |
| --- | --- |
| [docs/00-项目方案与画像.md](docs/00-项目方案与画像.md) | 项目画像、角色、范围、技术边界 |
| [docs/01-阶段计划与验收口径.md](docs/01-阶段计划与验收口径.md) | M0–M5 阶段、交付物、验收命令 |
| [docs/02-接口契约.md](docs/02-接口契约.md) | 统一响应、错误码、字段级接口、状态机 |
| [docs/03-数据模型与种子.md](docs/03-数据模型与种子.md) | 17 张表、种子分布、49 项校验 |
| [docs/04-权限矩阵.md](docs/04-权限矩阵.md) | 角色 × 模块、菜单可见性、后端兜底 |
| [STATUS.md](STATUS.md) | 当前状态与下一步 |
| [DECISIONS.md](DECISIONS.md) | 关键决策记录 |
| [PLAN-MATRIX.md](PLAN-MATRIX.md) | 方案要求 vs 实现状态 |
