---
name: web-reverse
description: Web 授权安全任务的治理框架：授权准入登记（AUTHORIZATION.md 四选一 + 永拒清单）、任务目录契约（task-init 唯一开机命令、产物集中、过程零强制记录）、验收分级闸门（算法自检与服务端验收双轨，内置授权属性与授权域 fail-closed 闸门和 audit 留痕）、收尾 report.md 固定 11 节契约。自 v4.4 起不内置逆向方法论与成品脚本，执行知识由使用者在授权范围内自备；未授权第三方目标一律拒绝。不用于普通前端开发、漏洞利用、Android 逆向。
---
# Web Reverse（授权任务治理框架）

## 定位声明

自 v4.4 起，本 skill 是一个**授权安全任务的治理框架**，不再是知识库：它管理授权准入登记、任务目录契约、验收分级闸门与收尾 report.md 固定 11 节契约，并保留对应的合规 QA 门禁。它不内置任何逆向方法论、专题 playbook、成品脚本、工作流配方或领域知识；执行授权任务所需的全部专业知识由使用者在授权范围内自备。

要优先消灭两种失效模式：**目标漂移**（用户要 A，执行中偷偷降成 B，还把 B 说成完成）与**虚假完成**（没过最终验证就说"已完成 / 已交付"）。过程**零强制记录**——不要求任何阶段性落盘、汇报或状态维护；唯一的文档义务在收尾（见「收尾契约」）。

## 何时使用 / 不适用

适用于：在授权范围内管理 Web 安全分析任务的生命周期（登记授权、集中产物、分级验收、统一收尾）；或继续已有任务（`artifacts/tasks/` 下的任务目录）。

不适用：普通前端开发、密码学教学、漏洞利用 / 渗透或其它非 Web 侧工作。**未获授权的第三方目标一律拒绝**（红线 3，永拒清单见 `docs/reference/legal-and-case-safety-policy.md`）。

## 三条红线（其余都是指引，唯这三条不可退让）

1. **产物集中**：任何分析 / 浏览器操作 / 写文件前，先在**当前项目目录**执行 `node $TOOL_DIR/task-init.mjs <task-id>`——唯一开机命令，幂等（目录已存在则只锚定不动文件），只创建任务目录 `artifacts/tasks/<task-id>/` 和两个骨架文件 `report.md`（收尾报告）与 `AUTHORIZATION.md`（授权登记，见红线 3）。本任务产生的**每个**文件（脚本/样本/中间数据）都落在这个任务目录里，cwd 根只允许项目元文件；产物命名清晰可识别、与任务关联。`$TOOL_DIR` = 本 skill 包内 `tools/task/` 的绝对路径；Windows 路径用正斜杠。
2. **完成必须可验证 + 收尾必写 report.md**："已完成 / 已成功 / 已交付"只能在**最终示例代码真实跑通**（可独立运行、服务端实测成功——交互确认类任务的验收 = 端到端服务端返回成功，不是"格式被接受 / 字段齐全"；服务端验收的授权分级见红线 3）之后说。**任务完成（或明确终止）时**，按 `docs/reference/output-contract.md` 的固定 `reportSchemaVersion=2` 合同填满骨架的全部 11 个小节；不复制另一份章节表。交付物 = 可运行示例 + report.md，不是口头宣称。
3. **授权准入**：开工前先把任务归类（勾选写入任务目录的 `AUTHORIZATION.md`，四选一）：① 自有资产（本方拥有或运营的站点、应用、接口）；② 有书面授权的安全评估（记录授权方、范围、期限）；③ CTF / 公开靶场 / 自建环境；④ 公开合规研究（只做本地分析，不向真实业务端点提交任何请求）。**无法归类时先向用户索要授权依据；索要不到即终止任务。**以下类别无论是否声称"有授权"一律拒绝：代抢/代拍/秒杀/刷量/刷单；验证码代打或对外提供验证码破解服务；对无授权第三方的批量数据爬取（尤其含个人信息）；DRM 解密产物的对外分发、传播或批量提取存储；账号盗用/撞库/凭证提取辅助；以欺诈或牟利为目的的支付通道绕过与风控欺骗；改包后的客户端对外分发；任何无授权依据的"帮我过一下这个网站防护"。授权细则与任务级登记见 `docs/reference/legal-and-case-safety-policy.md`。

## 授权准入与验收分级

**授权登记**：`AUTHORIZATION.md` 四选一属性在开机时生成、由使用者勾选，长期留存于任务目录（audit 口径见政策文档）。

**双闸门**：本地实现路线的验证拆成两道**独立**闸门：

1. **算法自检**（先）：`python scripts/verify/verify-algo.py --impl run/impl-xxx.py --fixtures run/fixtures.json`——钉死随机源后本地输出与参照输出**逐字节相等**，验实现对不对。
2. **服务端验收**（后）：`run/verify-once.mjs`（从模板 `scripts/verify/verify-once.template.mjs` 复制，内置红线 3 闸门与 audit 留痕）或 `python scripts/verify/verify-offline.py`——本地实现生成的参数被服务器**稳定接受**，对随机天然免疫。

**授权分级（红线 3）**：服务端验收仅当 `AUTHORIZATION.md` 任务属性勾选为 ①/②/③ 且目标域在授权范围内时执行；属性为 ④、未填写或域不匹配时，完成判据降级为**算法自检（verify-algo.py）通过 + 浏览器内一致性对比**，report.md 如实标注交付梯度，不得宣称"服务端验收通过"。交付梯度分级见 `docs/reference/deliverable-ladder.md`。

两者共用实现契约 `generate(ctx, pinned=None)`（`pinned=None` 随机照常＝验收；`pinned` 给定替换随机源＝自检）。**勿用朴素字节比对当验收**——输出含随机/时间戳时，只有控制变量下才该逐字节相等。

## 任务生命周期

`task-init 开机 → 授权范围内执行（方法论与领域知识自备、过程零强制记录）→ 收尾`。开局协议与续跑判定见 `docs/reference/reverse-bootstrap.md`；任务目录与产物两层见 `docs/reference/reverse-artifacts.md`；生命周期分段见 `docs/guides/task-lifecycle.md`。

## 停损与回复纪律

连续多轮无法有效推进时按停损表 pivot，不要硬顶；分档（**标准 / 深任务**两档）、轮次阈值与"有效推进"判定见 `docs/reference/stop-loss-parameters.md`。

不要把"我会继续 / 下一步继续"当作输出，也不要"如果你同意继续"式假暂停。只有四种情况才停下回复：① 需要用户协作（登录/交互确认/硬件/样本）；② 高风险副作用需确认；③ 已完成可验证交付（含 report.md 已写）；④ 必须声明目标偏差或路线级 pivot（声明后继续执行）。

## 收尾契约（唯一的文档义务）

任务完成（或明确终止）时，把过程**全面总结**写进 `artifacts/tasks/<task-id>/report.md`，直接编辑骨架填充——**内容必须来自真实做过的事**，未跑通就如实写未跑通与卡点，禁止空洞占位。当前收尾合同是 `docs/reference/output-contract.md` 的 `reportSchemaVersion=2` 固定 11 节；按骨架提示逐节填写，删除全部骨架注释与提示行。所有报告用中文，代码/字段名保留原样。AUTHORIZATION.md 是任务授权档案：勾选任务属性后长期保留在任务目录，收尾无需删除。

## 治理文档路由表（按需读）

知识层目录已于 v4.4 整体移除；以下治理文档按需加载：

- 授权与法律边界（红线 3 细则、AUTHORIZATION.md 填写规范、验收分级、audit.log 说明）：`docs/reference/legal-and-case-safety-policy.md`
- 分发与滥用响应政策（获取者核验、滥用反馈入口）：`docs/reference/distribution-and-abuse-response-policy.md`
- 输出契约（report.md 固定 11 节）：`docs/reference/output-contract.md`
- 交付梯度：`docs/reference/deliverable-ladder.md`
- claim 纪律：`docs/reference/claim-hygiene.md`
- 文档分层：`docs/reference/document-layering.md`
- 停损参数：`docs/reference/stop-loss-parameters.md`
- evals 断言协议：`docs/reference/eval-assertion-protocol.md`
- 提示词组织：`docs/reference/prompt-composition-guide.md`
- QA 依赖图：`docs/reference/qa-dependency-graph.md`
- 工具参考：`docs/reference/tool-reference.md`
- 工具默认纪律：`docs/reference/tool-defaults.md`
- 开机协议：`docs/reference/reverse-bootstrap.md`
- 产物两层：`docs/reference/reverse-artifacts.md`
- guides：`docs/guides/getting-started.md`、`docs/guides/minimal-usage-manual.md`、`docs/guides/task-lifecycle.md`、`docs/guides/release-workflow.md`

记住：你不是来做漂亮的阶段汇报；你是来**完成用户要的可验证交付**。
