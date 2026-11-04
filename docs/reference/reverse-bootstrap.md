<!-- publish: framework -->
# Reverse Bootstrap（最小启动协议）

## 新会话先读

1. `SKILL.md`（三条红线 + 验收分级 + 收尾契约）
2. 需要时按 SKILL.md 治理文档路由表按需读取对应治理文档

其余文档一律**按需加载**，不要开局通读。

## 新任务

当前 workspace 的 `artifacts/tasks/` 下没有未完成任务时：

1. 执行 `node $TOOL_DIR/task-init.mjs <task-id>`——唯一开机命令（幂等）：创建 `artifacts/tasks/<task-id>/` 与 report.md 骨架，并打印产物写入锚点，同时创建 AUTHORIZATION.md 授权登记骨架——开工先完成任务属性四选一（红线 3）
2. 在授权范围内开始执行（方法论与领域知识由使用者自备）；过程零强制记录，产物（脚本/样本/中间数据）随手写进任务目录

## 续跑任务

`artifacts/tasks/<task-id>/report.md` 仍为骨架（含「骨架生成于」标记）= 存在未完成任务：

1. 执行 `node $TOOL_DIR/task-init.mjs <task-id>` 锚定同一任务目录（不会动任何已有文件）
2. 从会话历史 / 任务目录中已有产物恢复上下文，继续推进
3. 已接近完成时：先跑通最终验证，再按 `docs/reference/output-contract.md` 填写 report.md

## 路径纪律

- 任务真源 = `workspaceRoot/artifacts/tasks/<task-id>/`；报告与产物引用一律用这组真实路径
- 外部 workspace 可以是空目录；工具复用 skill 仓库里的 `tools/task/task-init.mjs` 即可
- cwd 根不堆任务产物（有一条红线 + 可选 PreToolUse hook 兜底）
