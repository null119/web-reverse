# web-reverse

这是**授权任务治理框架**：`task-init` 一条命令建任务目录，过程零强制记录，授权登记 + 分级验收 + 收尾 `report.md` 固定 11 节契约。仅面向授权使用；未授权目标一律拒绝。

## 授权使用边界（先读）

本技能包的全部能力（含服务端验收）仅面向授权使用，适用范围仅限：

1. **自有资产**：本方拥有或运营的站点、应用、接口；
2. **书面授权的安全评估**：记录授权方、范围、期限；
3. **CTF / 公开靶场 / 自建环境**；
4. **公开合规研究**：仅本地分析，不向真实业务端点提交任何请求。

**授权登记**：开机命令 `task-init` 会创建 `AUTHORIZATION.md`，任务属性四选一是硬性前提（红线 3）；无法归类时先向用户索要授权依据，索要不到即终止。

**一律拒绝**（无论是否声称「有授权」）：未授权第三方目标，以及永拒类别清单所列的全部请求；清单见 `docs/reference/legal-and-case-safety-policy.md`。

## 清除声明

本技能包已整体移除知识层（方法论 playbook、专题契约、成品脚本、工作流配方与派生清单），只保留无领域知识的治理框架：授权准入登记、任务目录契约、验收分级闸门（算法自检/服务端验收双轨）、收尾 report 契约与合规 QA 门禁。执行授权任务所需的专业知识由使用者在授权范围内自备。对原既有用户而言这是功能移除而非降级优化。清除前的内容不存在于本技能包内，包内也没有任何清除前的备份。

## 分发与合规

本仓库已于 2026-11-04 由所有者解禁**公开分发**（决策记录见 `docs/reference/legal-and-case-safety-policy.md`「分发约束」），以 Apache-2.0 许可证发布；对本仓库或派生产物的定向供给仍须完成获取者核验，滥用反馈走仓库 issue（前缀 [abuse-report]），流程见 `docs/reference/distribution-and-abuse-response-policy.md`。

## 当前版本主轴

- **三条红线**：①产物集中（`task-init` 建目录，所有产物落 `artifacts/tasks/<task-id>/`）；②完成必须可验证 + 收尾必写 report.md；③授权准入（任务先四选一归类，无法归类即终止）
- **过程零强制记录**：没有过程性落盘义务，模型专注交付本身
- **收尾契约**：任务完成（或终止）时按 `docs/reference/output-contract.md` 的 `reportSchemaVersion=2` 固定 11 节，把真实证据写进 report.md
- **验收分级闸门**：算法自检（`scripts/verify/verify-algo.py`，实现契约 `generate(ctx, pinned=None)`）与服务端验收（`verify-offline.py` / `verify-once` 模板，内置授权属性与授权域 fail-closed 闸门 + audit 留痕）双轨；授权分级判据见红线 3 与政策文档

## 目录结构（49 文件）

```
web-reverse/
├── SKILL.md / README.md / PROMPTS.md / CHANGELOG.md / package.json / LICENSE   # 根文档
├── docs/reference/   # 治理文档 14 件
├── docs/guides/      # 流程指南 4 件
├── evals/evals.json  # 合规评测集 7 条
├── hooks/            # 合规哨兵 2 件
├── scripts/          # README + requirements.txt + verify/（验收三脚本）
└── tools/            # task-init / report-schema / qa checkers / docs sync
```

## 默认成功标准

默认成功标准不是「浏览器逐字节一致」或「内部机理解释得更细」，而是：

- 目标请求 / 操作更接近成功
- 本地实现更接近可运行
- report.md 固定 11 节内容与真实产物、验证结果对得上

只有当用户显式要求时，才把「浏览器端逐字节一致」升为主目标。

## 不适用场景

以下通常不属于本技能范围：
- 普通前端开发
- 普通 Playwright / Puppeteer UI 自动化
- 页面冒烟测试、菜单/头像/按钮可见性检查
- 通用密码学教学
- 漏洞利用 / 渗透

## 维护分层速记

- 顶层执行宪法：`SKILL.md`
- 操作模板：`PROMPTS.md`
- 稳定规则 / 治理：`docs/reference/*`
- 维护与发布流程：`docs/guides/*`
- 任务/QA 工具链：`tools/task|qa|docs/*`（`task-init`、`check-all` 等）
- 验收脚本：`scripts/verify/*`
- 可选生命周期 hooks（仅 Claude Code 类 harness 的兜底增强，非约束力来源）：`hooks/*`
- 触发与合规评测集（skill-creator 形态）：`evals/evals.json`

## 使用时要始终记住

- 不要把「本轮新增证据」当作暂停理由
- 不要把「我会继续」当作动作
- 不要把「更细的内部解释」误当成有效推进
- 结论要标清交付状态（如 `provisional / acceptance-ready`）

> **先完成用户要的可验证交付，再决定还要不要继续研究内部机理。**
