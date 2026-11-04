# CHANGELOG

## 2026-11-04 — v0.2.1：解禁公开分发

- **分发解禁**：所有者完成分发评估，解除「完成分发决策点事项前不得对外分发」约束，本仓库以公开仓库形态发布（github.com/null119/web-reverse）。决策记录见 `docs/reference/legal-and-case-safety-policy.md`「分发约束」；匿名克隆不适用逐获取者核验登记，对本仓库或派生产物的定向供给仍须四步登记（`docs/reference/distribution-and-abuse-response-policy.md`），滥用反馈入口（[abuse-report] issue）即时生效。
- **许可证**：新增 `LICENSE`（Apache-2.0，Copyright 2026 null119），`package.json` 同步 `license` 字段。
- **QA 同步**：`check-authorization-banners` 的分发 needle 由禁令句改为「公开分发」决策句；根文件白名单（`tools/qa/common.mjs`）纳入 `LICENSE`。
- **补缺**：新增本 CHANGELOG（README 目录结构此前已声明该文件但一直缺失）。
