# 当前状态

- 软件名称/版本：房产交易数字化协同平台 / V1.0（房交平台）
- 当前阶段：**E1 演示增强批次 ✅ —— MVP 持续增强（2026-10-30）**（此前 M0–M5 已交付）
- 最新提交：E1 提交（`main`，远端恢复后推送）
- 交付物：可运行 Web Demo（含价格走势/调价审批/重复提示/在线咨询）+ 完整工程文档 + 27 张最终截图；**不做软著登记材料**（D08）
- 最近验收（E1 终态）：
  - `npm run db:reset`：20 张表、66 项数据校验 0 失败
  - `npm run build`：0 错误
  - `npm run test:api`：128/128（原 107 + E1 21）
  - `npm run test:e2e`：41/41（原 34 + E1 7）
  - `npm run screenshots`：27 张（最终 UI + 最终种子）
  - `npm run check:docs`：通过
  - `npm run verify`：全绿
- 环境基线：Windows；Node v24.22.0；npm 11.19.1（npm workspaces）；git 2.56.0；Playwright Chromium 156；**须使用完全权限**（沙箱下 pwsh 启动失败 0xC0000142）；若本机 `%TEMP%` 下 esbuild 临时文件删除被拒（安全软件/ACL），构建前设 `$env:TEMP="<仓库>\.tmp"`（已 gitignore）
- 交付范围：6 角色、7 大模块 + E1 增强（价格历史、审批中心、重复提示、在线咨询）；外部系统全部本地 Mock
- 已知简化（边界）：电子签/支付/短信/实名/地图为 Mock；审批仅调价一类；咨询为一问一答；合同金额强制等于挂牌总价；跨浏览器仅 Chromium 验证
- 下一步（可选 E2 增强，仍以 MVP 演示为主）：
  1. 资金监管（Mock 记录+对账）、贷款申请（Mock）、过户材料清单/预约；
  2. 看板增强（区域行情/客群画像/漏斗）与佣金结算；
  3. 任何改动后执行 `npm run verify`；重置演示数据 `npm run db:reset`。
- 阅读入口：README / docs/10-E1-增强验收报告 / docs/02-接口契约 / PLAN-MATRIX
- 更新时间：2026-10-30
