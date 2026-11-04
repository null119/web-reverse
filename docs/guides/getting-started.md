# 快速上手

report-only 契约下的最短使用路径。

## 新任务 / 续跑任务（同一条命令）

```bash
node $TOOL_DIR/task-init.mjs <task-id>
```

幂等：目录已存在则只锚定，不动任何文件。开机只创建 `artifacts/tasks/<task-id>/` 与 report.md、AUTHORIZATION.md 两个骨架。

## 执行

按授权范围执行任务（框架不提供方法论，执行知识由使用者自备），过程零强制记录；产物随手写进任务目录。第一轮最少想清楚：任务目标、交付梯度、当前验证深度与成功判据。

## 收尾

先跑通最终验证（可运行示例 + 服务端实测或降级判据），再按 `docs/reference/output-contract.md` 的固定 `reportSchemaVersion=2` 合同填满 `report.md` 全部 11 节。章节顺序与语义只从该 contract 读取，不在快速上手页复制一份。

## 一个最小闭环命令序列

```bash
node $TOOL_DIR/task-init.mjs <task-id>
# ...按授权范围执行任务，产物落 artifacts/tasks/<task-id>/...
# ...最终示例真实跑通...
# 编辑 artifacts/tasks/<task-id>/report.md 填充固定 11 节总结
```

## 记住三条铁律

1. 除非阻塞或交付，否则不要等待用户再输入"继续"
2. 默认两轮没有逼近最终验收，必须 pivot
3. 结论必须标清 `provisional / route-ready / acceptance-ready / delivered`（见 `docs/reference/claim-hygiene.md`）
