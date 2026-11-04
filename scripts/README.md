# scripts 索引（v4.4：verify 三脚本 + 授权口径）

> 本目录只保留**验收双闸门脚本**（直接 `node`/`python` 调用，勿重写）。与 `tools/`（任务契约/QA 机制）不同，
> 这些脚本是授权验收的即跑工具。落盘约定不变：本任务产生的
> impl/样本/中间数据一律进 `artifacts/tasks/<task-id>/run/`（红线 2）；本目录脚本本身是 skill 包内工具，不属于任务产物。

## 验证双闸门（核心）

| 脚本 | 作用 | 何时跑 |
|------|------|--------|
| `verify/verify-algo.py` | **控制变量自检**：钉死随机源后本地输出与参照输出逐字节相等 → 验**实现对不对** | 本地实现完成后、服务端验收前 |
| `verify/verify-offline.py` | **服务端验收（Python 路线）**：本地实现生成的参数被服务器稳定接受 → 验**真成功**，对随机免疫 | 声称完成前（与 `run/verify-once.mjs` 二选一） |
| `verify/verify-once.template.mjs` | **服务端验收（Node 路线）模板**：复制到任务目录 run/ 下改名 verify-once.mjs，内置与 verify-offline.py 同款红线 3 闸门与 audit.log 留痕 | 声称完成前（与 Python 路线二选一） |

二者共用实现契约 `generate(ctx, pinned=None)`：`pinned=None` 随机照常（验收），`pinned` 给定替换随机源（自检）。

服务端验收的授权分级（红线 3：属性 ①②③ 且域匹配才可；④/未填只做本地自检）见 `SKILL.md` 与 `docs/reference/legal-and-case-safety-policy.md`。

## 依赖安装（按需）

- Python：`pip install -r scripts/requirements.txt`（verify-offline.py 需 `requests`；verify-algo.py 仅标准库）
- Node：verify-once 模板仅用 Node 内置能力，零第三方依赖。
