# 任务生命周期

report-only 契约下的任务生命周期非常简单：

1. `Boot`：`node $TOOL_DIR/task-init.mjs <task-id>`（幂等：建任务目录 + report.md 与 AUTHORIZATION.md 两个骨架）
2. 执行：按授权范围执行任务（方法论与领域知识自备），过程零强制记录
3. `Close`：跑通最终验证 → 按契约填写 report.md（`docs/reference/output-contract.md`）

## 关键纪律

### Boot
- 新任务与续跑任务都只有这一条命令；目录已存在时不覆盖任何文件
- 产物（脚本/样本/中间数据）随手写进 `artifacts/tasks/<task-id>/`，cwd 根保持干净

### 执行阶段
- 每轮自问是否更接近最终验收
- 同一主路线 / 假说连续两轮无进展，先复盘再继续（停损表见 `docs/reference/stop-loss-parameters.md`）
- 过程中不做阶段性汇报，不写状态播报

### Close
- 先确认交付梯度已满足、最终验证真实跑通
- 按 `docs/reference/output-contract.md` 的固定 `reportSchemaVersion=2` 合同填写 report.md 全部 11 节；保持过程零强制记录。
- 不要把"报告已写完"误当 Close 完成——报告内容必须与真实产物和验证结果对得上

## 允许停下的唯一理由

- 用户协作阻塞（写清用户此刻必须执行的唯一动作，如"现在请登录"）
- 高风险副作用需确认
- 已完成可验证交付（含 report.md 已写）
- 需要说明路线级偏差（说明后继续）

除此之外，生命周期中的每一环都应直接流向下一环。不要只写"需要协助""请确认是否继续"这类抽象暂停语。
