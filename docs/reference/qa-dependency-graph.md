<!-- publish: framework -->
# QA 检查依赖图（R4 终态）

## 共享库（lib）

```text
tools/report-schema.mjs              ← 纯生产真源（version=2、11 sections、skeleton/doc renderer）
tools/qa/common.mjs                  ← 核心共享工具（failWith、readText、readJson、repoRoot、walk、exists、DENY_TOKENS）
  └── tools/qa/check-manifest.mjs
      └── getChecksForGroup()、checkManifest[]、tier metadata
tools/docs/sync-report-schema.mjs    ← 只更新 output-contract generated block
```

## 检查脚本依赖树

```text
check-all.mjs
├── check-manifest.mjs (tier grouping)
└── [spawns all checks based on tier]

分组执行顺序（cumulative）:
  fast/full (9 checks)
  ├── check-utf8.mjs                 → common.mjs
  ├── check-naming.mjs               → standalone（消费 common.allowedRootDirs）
  ├── check-report-schema.mjs        → fs/path/child_process；purity check before dynamic import report-schema.mjs；independent fixtures；task-init.mjs
  ├── check-prompt-coverage.mjs      → common.mjs
  ├── check-operating-contracts.mjs  → common.mjs；dynamic import report-schema.mjs 与 check-report-schema.mjs
  ├── check-skill-contract.mjs       → common.mjs
  ├── check-algo-selfcheck.mjs       → common.mjs
  ├── check-authorization-banners.mjs → common.mjs（DENY_TOKENS、BANNER_FILES、fail-closed 正则、分发禁令双 needle）
  └── check-evals.mjs                → common.mjs（DENY_TOKENS、URL 白名单）
```

> `report-schema-contract.json` 中的 `sourcePlan`/`sourcePlanSha256` 是可选的 maintenance evidence 元数据。source-only 安装没有 `.optimization-evidence/round-1/04-final-plan.md` 时，checker 明确输出 `SKIP` 并继续；只有证据存在时才用 checker 内固定 hash 校验计划。该证据不是 source runtime 依赖。

## 关键依赖路径

| 修改内容 | 影响范围 | 应重跑的检查 |
|----------|---------|-------------|
| tools/report-schema.mjs 变更 | task-init、output-contract block、report-coupled QA | npm run check:report-schema -- --self-test + check:fast |
| tools/docs/sync-report-schema.mjs 变更 | output-contract generated block | node tools/docs/sync-report-schema.mjs 两次 + check:report-schema |
| tools/task/task-init.mjs 变更 | schema task-init 行为冒烟 | check:report-schema -- --self-test |
| check-report-schema.mjs 变更 | contract fixture、parser、N/A、schema mutation、task-init 集成 | check:report-schema -- --self-test + check:fast |
| SKILL.md 正文变更 | check-skill-contract、check-algo-selfcheck、check-authorization-banners | check:fast |
| report contract 文档变更 | operating-contracts、report-schema | check:fast |
| evals.json 变更 | check-evals | check:evals |
| PROMPTS.md 变更 | check-prompt-coverage | check:prompt-coverage |
| verify 脚本 / 模板变更 | check-authorization-banners、check-algo-selfcheck | check:fast |

## 执行建议

- 日常开发后：npm run check:fast。
- 发布前：npm run release:prep（schema self-test + serial fast）。
- check:full 明确是 fast 的别名（deep 组已随深检对象消失而退役）。
- 单点验证：直接运行对应 check 脚本，例如 node tools/qa/check-evals.mjs。
