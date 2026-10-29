# 当前状态

- 软件名称/版本：房产交易数字化协同平台 / V1.0（房交平台）
- 当前阶段：**M5 文档收敛与冷启动 ✅ —— 项目交付完成（2026-10-29）**
- 最新提交：M5 提交（`main`，已推送远端；交付版本即仓库 HEAD）
- 交付物：可运行 Web Demo + 完整工程文档 + 25 张最终截图；**不做软著登记材料**（D08）
- 最近验收（M5 终态）：
  - 冷启动：`npm ci`（601 包）→ `npm run db:reset`（49 项校验 0 失败）→ `npm run build`（0 错误）
  - `npm run test:api`：107/107
  - `npm run test:e2e`：34/34
  - `npm run screenshots`：25 张（最终 UI + 最终种子）
  - `npm run check:docs`：103 项通过（39 条本地链接、25 张截图、名称/版本、阶段报告）
  - `npm run verify`：全绿
- 环境基线：Windows；Node v24.22.0；npm 11.19.1（npm workspaces）；git 2.56.0；Playwright Chromium 156；**须使用完全权限**（沙箱下 pwsh 启动失败 0xC0000142）
- 交付范围：6 角色、7 大模块、47 项方案功能逐项追踪（见 PLAN-MATRIX）；外部系统全部本地 Mock
- 已知简化（边界）：电子签/支付/短信/实名/地图为 Mock；无并发压测与生产级可用性；合同金额强制等于挂牌总价；跨浏览器仅 Chromium 验证
- 下一步（维护者）：
  1. 阅读 `README.md` 快速开始与 `docs/09-M5-验收报告.md` 交接信息；
  2. 任何改动后执行 `npm run verify`（含文档一致性门禁）；
  3. 需要重置演示数据时执行 `npm run db:reset`。
- 阅读入口：README / docs/09-M5-验收报告 / docs/02-接口契约 / PLAN-MATRIX
- 更新时间：2026-10-29
