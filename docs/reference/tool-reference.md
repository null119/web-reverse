# Tool Reference

`web-reverse` 默认不捆绑新的 MCP server，实现层优先依赖现有工具。

任务生命周期只有一条 CLI：`task-init`（建任务目录 + report.md 与 AUTHORIZATION.md 两个骨架）。其余工具面是验收三脚本与仓库自带的 QA 命令。

## 仓库内置任务工具

- `node $TOOL_DIR/task-init.mjs <task-id>`——唯一开机命令（幂等；`--allow-skill-dir` 仅自测用）

## 验收脚本（scripts/verify/）

- `scripts/verify/verify-algo.py`——算法自检（控制变量逐字节比对；实现契约 `generate(ctx, pinned=None)`）
- `scripts/verify/verify-offline.py`——服务端验收（Python 路线；内置授权属性 + 授权域 fail-closed 闸门）
- `scripts/verify/verify-once.template.mjs`——服务端验收（Node 模板；复制到任务目录后使用，内置同款闸门与 audit 留痕）

## 校验与构建工具（开发仓库自用）

- `npm run check:report-schema -- --self-test`
- `npm run check` / `npm run check:fast`
- `npm run release:prep`（发布前自检）

## 收尾

- 收尾不是"写完报告就结束"：先跑通最终验证，再按 `docs/reference/output-contract.md` 填 report.md
- report.md 里的复现命令必须真实可跑——验收人可能原样执行
