# 当前状态

- 软件名称/版本：房产交易数字化协同平台 / V1.0（房交平台）
- 当前阶段：**E4.1 演示账号权限巡检与修复 ✅（2026-11-02）**（M0–M5 交付；E1–E4 增强已交付）
- 最新提交：E4.1 权限修复提交（`main`，已推送远端）
- 交付物：可运行 Web Demo（全链路 Mock 闭环 + 移动端 + 看板 + 配置化 + P0 管理能力）+ 完整工程文档 + 42 张最终截图；**不做软著登记材料**（D08）
- 最近验收（E4.1 终态）：
  - `npm run db:reset`：36 张表、102 项数据校验 0 失败
  - `npm run build`：0 错误
  - `npm run test:api`：177/177（E4 173 + 权限回归 4）
  - `npm run test:e2e`：65/65（E4 59 + 多账号权限巡检 6）
  - `npm run screenshots`：42 张（最终 UI + 最终种子）
  - `npm run check:docs`：通过（42 张截图全部被引用）
  - `npm run verify`：全绿
- 权限一致性：6 个演示账号（admin/finance/store_manager/agent/buyer/seller）逐菜单巡检，可见页面接口 0 个 4xx；财务为只读角色（写按钮隐藏、后端拒绝），卖家预约看房按设计不开放（前端隐藏入口）
- 环境基线：Windows；Node v24.22.0；npm 11.19.1（npm workspaces）；git 2.56.0；Playwright Chromium 156；**须使用完全权限**；若 `%TEMP%` 下 esbuild 临时文件删除被拒，构建前设 `$env:TEMP="<仓库>\.tmp"`（已 gitignore）
- 已知简化（边界）：账号仅员工角色（不开放 C 端注册）；菜单为可见级权限；匹配为规则评分；模板为文本占位符；投诉单级处理；真实第三方（电子签/支付/短信/实名/地图/银行/政务）仍为 Mock；非功能（压测/HTTPS/Redis/MQ/OSS/监控）未做
- 下一步（P1/P2，按需）：真实第三方适配器层（Mock→真实可切换）、PG+Redis+对象存储、Docker/监控、压测与安全加固；任何改动后执行 `npm run verify`
- 阅读入口：README / docs/14-权限巡检与修复记录 / docs/13-E4-P0功能补齐验收报告 / docs/02-接口契约 / PLAN-MATRIX
- 更新时间：2026-11-02
