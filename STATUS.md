# 当前状态

- 软件名称/版本：房产交易数字化协同平台 / V1.0
- 当前阶段：M0 已确认（2026-10-28）→ 进入 M1 契约与数据基座
- 最新 commit：`1b3348a` docs(status)；M0 决策确认提交见下（本地 `main`）
- 最新安装包：不适用（Web Demo）
- 最近验收：M0 文档齐套；无构建/API/E2E（M1 起才有代码）
- 环境基线：Windows；Node v24.22.0（DSH 内置）；pnpm 11.28.5（`C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs`）；npm 11.19.1；git 2.56.0；PowerShell 5.1；**须使用完全权限**（沙箱下 pwsh 启动失败 0xC0000142）
- 已确认决策：SQLite + Prisma（D07）；全 Mock 且数据真实合规（D06/D11）；M6 软著材料删除（D05/D08）；仓库 `192.168.1.100:3300/liyunqing/property-trade-platform.git`
- 未完成/暂缓：M1 全部内容；远端推送待首次配置
- 下一步（1~3 条）：
  1. 推送 M0 提交到远端；
  2. M1：工程骨架 + schema + 种子 + 权限 + 契约冻结；
  3. 按 docs/01 验收后进入 M2。
- 阅读入口：README / docs/00-项目方案与画像.md / docs/01-阶段计划与验收口径.md / docs/02-接口契约.md（M1 产出）
- 更新时间：2026-10-28
