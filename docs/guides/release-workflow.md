# 发布流程

本流程用于减少接入 prompt 与主文档之间的发布漂移（v4.4 收缩版：QA 为 fast 9 项；check:full 只是 fast 的别名）。

## 最小发布前流程

```bash
npm run check:report-schema -- --self-test
npm run check:fast -- --jobs=1
```

也可以直接执行：

```bash
npm run release:prep
```

release:prep 依次执行 `check:report-schema -- --self-test`、串行 fast。维护证据中的 04 计划只用于有证据时的固定 hash 校验；source-only 安装没有该目录时 checker 明确 SKIP，不形成 runtime 依赖。

## 变更类型与额外动作

### 1. 改 task contract / template

至少执行：

```bash
npm run check:report-schema -- --self-test
npm run check:fast -- --jobs=1
```

并补必要的迁移说明；旧 report 保持只读，不自动迁移。

### 2. 改接入层 prompt / README / 顶层规则

除常规 QA 外，重点核对：

- PROMPTS.md
- SKILL.md
- README.md
- docs/guides/task-lifecycle.md

确保三条红线（含授权准入）、固定 11 节 contract、交付梯度和 README 阅读顺序口径一致。

### 3. 新增对抗性执行内容

新增对抗性执行内容（逐目标对策、求解链、对抗模板等）违反本仓库定位（v4.4 起为无领域知识的治理框架），默认不接受；
若确需评估，先过红线 3 与分发约束评估，并人工复核。

滥用反馈入口（[abuse-report] issue 前缀）与获取者核验、三级响应流程见
`docs/reference/distribution-and-abuse-response-policy.md`。

## 发布前人工检查

至少确认：

- 没有 generated block 漂移
- README 的命令仍可运行
- 变更记录和迁移说明符合仓库约定
- 本次改动的真源位置清晰（reference / guide / top-level）
- ① 本版本是否新增厂商点名参数 / 成品对抗脚本 / 红线类目内容？
- ② 若①为是，是否已对照分发约束政策完成人工复核？
- ③ check:fast（含 check-evals 与 check-authorization-banners）是否全绿？
- 授权横幅与 fail-closed 闸门断言仍然生效（check-authorization-banners）。
- 仓库内无 __pycache__ 目录与 .pyc 文件残留（check-naming 已断言）。

## 推荐 CI / PR 门禁

- 日常开发后可跑 npm run check:fast。
- 发布前可跑 npm run release:prep；该入口按 schema self-test → serial fast 执行。
- 若 PR 修改 task schema / template，应附迁移说明或明确说明不需要迁移。
- 若 PR 修改 SKILL.md / PROMPTS.md / README.md，应在描述中说明口径是否已同步。

## 推荐提交粒度

推荐把一次结构性改动拆成：

1. 真源改动（tools / templates）
2. generated block 同步
3. guide / migration note

这样更容易 review，也更容易追踪回归来源。
