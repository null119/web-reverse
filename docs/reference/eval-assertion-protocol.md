<!-- publish: framework -->
# Eval Assertion 协议

每个 eval 条目可携带 `assertions` 数组，用于程序化验证 skill 行为。

## 断言类型

### 文件存在断言

```json
{
  "type": "artifact_exists",
  "path": "artifacts/tasks/<task-id>/report.md",
  "description": "report.md 应已生成"
}
```

### 内容包含断言

```json
{
  "type": "content_contains",
  "path": "artifacts/tasks/<task-id>/report.md",
  "needle": "任务概览",
  "description": "report.md 应包含固定小节标题"
}
```

### 推理标签断言

```json
{
  "type": "reasoning_tag_present",
  "tag": "acceptance-boundary-first",
  "description": "应包含 acceptance-boundary-first 推理标签"
}
```

### 推理标签禁止断言

```json
{
  "type": "reasoning_tag_forbidden",
  "tag": "resume-then-advance",
  "description": "新任务不应出现 resume 推理标签"
}
```

### 无任务产物断言（用于 shouldTrigger=false）

```json
{
  "type": "no_task_artifacts",
  "description": "不应创建任何 task artifacts"
}
```

### 多文件内容断言

```json
{
  "type": "content_contains_any_file",
  "paths": ["run/input-map.md", "run/fixtures.json"],
  "needle": "target_field",
  "description": "至少一个产物文件应包含目标字段"
}
```

## 断言的使用

历史版本曾允许自由文本形式的任务模式断言（仅描述路由规划素材，不是 v2 report.md 的字段）；当前评测集已收敛为合规行为用例，不再携带该类断言，也不改变固定 11 节、无额外状态字段的当前合同。

`evals/evals.json` 中的断言供人工评测与后续评测器实现参考；按新契约，正向条目的核心断言是：①任务产物均在 `artifacts/tasks/<task-id>/`；②收尾 report.md 含固定 11 节且非骨架。

## 自动生成规则

基于 eval 字段自动推导断言：

| 现有字段 | 自动生成的断言类型 |
|----------|-------------------|
| `expectedArtifacts` 中的路径 | `artifact_exists` |
| `expectedReasoningTags` 中的 tag | `reasoning_tag_present` |
| `forbiddenReasoningTags` 中的 tag | `reasoning_tag_forbidden` |
| `shouldTrigger=false` | `no_task_artifacts` |
