# 文档分层

这个仓库已经不是单一提示词文件，而是多层协作的执行框架。  
为了避免顶层文档继续膨胀，后续维护统一按以下分层落盘。

> **两层分层（v4.4 起）：**
> - **治理层（policy）**：`docs/reference/` + `docs/guides/`——定义执行协议、交付梯度、验收分级、收尾契约——"怎么执行、怎么判断"
> - **任务层（task）**：`artifacts/tasks/<task-id>/`——任务期产物与授权登记，收尾时浓缩为 report.md

## 1. `SKILL.md`：运行时执行宪法

只保留会直接影响模型运行行为的内容：

- 何时触发 skill
- 开机命令（task-init）
- 三条红线（产物集中 / 完成必须可验证 + 收尾必写 report.md / 授权准入）
- 验收分级闸门
- 停损 / pivot 原则
- 证据、结论精度

不应继续向 `SKILL.md` 叠加：

- 过长的教学内容
- 发布流程细节
- schema 演进说明
- 不会改变运行行为的维护说明

## 2. `PROMPTS.md`：操作员提示模板

用于给使用者复制、拼装和复用提示词。

适合放这里的内容：

- 新任务 / 续跑任务模板
- 验收导向模板
- 交付梯度与结论精度模板

规则真源仍是 `SKILL.md`，收尾契约真源是 `docs/reference/output-contract.md`。

## 3. `docs/reference/*`：稳定规则与治理文档

这里承载"重要但不该塞进顶层 prompt"的内容，例如：

- report.md 收尾契约（output-contract）
- 启动协议（reverse-bootstrap）
- 交付梯度（deliverable-ladder）
- 停损参数（stop-loss-parameters）
- claim hygiene
- 授权与法律边界（legal-and-case-safety-policy）

## 4. `docs/guides/*`：维护与发布流程

这里放：

- 快速上手
- 任务生命周期
- 发布流程

目标是服务维护者和使用者，而不是给运行时模型追加负担。

## 5. 任务层：`artifacts/tasks/<task-id>/`

任务期全部产物（脚本/样本/中间数据）+ `AUTHORIZATION.md` + `report.md` 骨架。任务完成时按收尾契约填写 report.md；旧任务只读。

## 维护原则

新增规则前先问三件事：

1. 它是否会直接改变运行时行为？
2. 它是否属于治理规则（reference）或流程说明（guide）？
3. 它是否不该塞进顶层 prompt？

默认答案顺序应是：

`docs/reference > docs/guides > SKILL.md`

只有必须影响运行时决策的内容，才回到 `SKILL.md`。
