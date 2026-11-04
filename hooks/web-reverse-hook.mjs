#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// web-reverse 生命周期 hook 分发器（report-only 契约版）。两个事件：
//
//   session-start  检测未完成任务目录（report.md 仍为骨架）→ 提醒继续；无任务 → 提醒先 boot
//   guard          PreToolUse：拦截把任务产物写到 cwd 根目录的 Write/Edit/NotebookEdit
//
// 已删除（随过程落盘机制一并移除）：stop / evidence 自动快照。
// 在 .claude/settings.json 中按事件挂载本脚本（见同目录 README）。
// 设计为绝不崩溃：任何异常都 exit 0。唯有 guard 在「明确违反产物纪律」时返回 deny。

const hookDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(hookDir, "..", "tools", "task");
const cwd = process.cwd();

// 骨架标记：boot 生成的 report.md 首部注释。仍含该标记 = 任务未收尾。
const SKELETON_MARKER = "骨架生成于";

function listTaskDirs() {
  const tasksRoot = path.join(cwd, "artifacts", "tasks");
  if (!fs.existsSync(tasksRoot)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
      continue;
    }
    const report = path.join(tasksRoot, entry.name, "report.md");
    if (fs.existsSync(report)) {
      out.push({ id: entry.name, report, mtimeMs: fs.statSync(report).mtimeMs });
    }
  }
  return out.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

// 红线 3：任务授权登记是否未勾选（无已勾选任务属性行即未登记；无文件视为未登记）。
// 判定与 verify-offline.py 一致：勾选形态为「[x] ①/②/③/④」——骨架说明行
// 「把对应 [ ] 改为 [x]」本身含字面 [x]，不能用裸 includes("[x]") 判定。

// 勾选判定：每标记一次布尔判定（与模板 CLASS_MARKS.filter / verify-offline.py 的 hits 计数同款）——
// 同一标记重复勾两行仍算 1 hit；不做出现次数累计（matchAll 计数会把重复勾判 2，与验收工具口径漂移）。
// hits==1 → 已登记；0（未勾）或 ≥2（多勾=登记无效，政策 :17）→ 未登记。
const AUTH_MARKS = ["①", "②", "③", "④"];
function authTextUnchecked(authText) {
  const hits = AUTH_MARKS.filter((m) => new RegExp("\\[x\\]\\s*" + m).test(authText));
  return hits.length !== 1;
}

// 从 startDir 向上 ≤4 级探测 AUTHORIZATION.md（探测循环与模板 findAuthorization :23-34 同款：
// existsSync/statSync().isFile()，到根即止）；找到 → 按勾选判定；找不到 → true（未登记）。
function authUncheckedUp(startDir) {
  let cur = startDir;
  for (let i = 0; i < 4; i++) {
    let text = null;
    try {
      const cand = path.join(cur, "AUTHORIZATION.md");
      const st = fs.statSync(cand);
      if (st.isFile()) text = fs.readFileSync(cand, "utf8");
    } catch {}
    if (text !== null) return authTextUnchecked(text);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return true;
}

function authUnchecked(taskDirPath) {
  try {
    const auth = fs.readFileSync(path.join(taskDirPath, "AUTHORIZATION.md"), "utf8");
    return authTextUnchecked(auth);
  } catch {
    return true;
  }
}

function isSkeleton(reportPath) {
  try {
    return fs.readFileSync(reportPath, "utf8").includes(SKELETON_MARKER);
  } catch {
    return true;
  }
}

function emitContext(message) {
  // SessionStart：stdout 会作为附加上下文注入模型。
  process.stdout.write(`${message}\n`);
}

// cwd 根目录唯一允许直接存在的文件（与 SKILL.md「产物集中」白名单一致）。
const ROOT_WHITELIST = new Set([".web-reverse-tool-dir", ".gitignore", "SKILL.md", "SKILL.md.bak"]);

// 即使没有 workspace 标记，这些文件名也强烈暗示是 web-reverse 任务产物（通用工程命名形态）——
// 用于打破「不初始化 → 无标记 → guard 放行 → 继续写根目录」的死锁。
const WEB_REVERSE_ARTIFACT_RE =
  /^(?:REPORT|report)\.md$|^(?:test_|challenge_|search_|verify-|impl|core_|load_).*\.(?:py|js|mjs|json|jpg|png|har)$|^fixtures\.json$|^state.*\.json$|^__pycache__$/i;

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 检查当前 cwd 是否已经是 web-reverse workspace（有标记目录或已有产物）。
function detectWebReverseWorkspace() {
  const hasMarker =
    fs.existsSync(path.join(cwd, ".web-reverse-tool-dir")) ||
    fs.existsSync(path.join(cwd, "artifacts", "tasks"));
  if (hasMarker) {
    return { isWorkspace: true, hasMarker: true };
  }
  try {
    const files = fs.readdirSync(cwd);
    const hasArtifacts = files.some((f) => WEB_REVERSE_ARTIFACT_RE.test(f));
    return { isWorkspace: hasArtifacts, hasMarker: false };
  } catch {
    return { isWorkspace: false, hasMarker: false };
  }
}

// PreToolUse 守卫：阻止把任务产物写到 cwd 根目录。
function guardRootWrite() {
  const payload = readStdinJson();
  if (!payload || typeof payload !== "object") {
    return; // 解析不了就放行
  }

  const input = payload.tool_input || {};
  const target = input.file_path || input.notebook_path || input.path || "";
  if (!target || typeof target !== "string") {
    return;
  }

  const { isWorkspace, hasMarker } = detectWebReverseWorkspace();
  if (!isWorkspace) {
    return; // 不是 web-reverse 项目，放行
  }

  const abs = path.resolve(cwd, target);

  // 红线 3 合规哨兵：默认静默（不改变任何判定）；WEB_REVERSE_AUTH_ENFORCE=1 时
  // 对任务目录内的服务端验收类产物（verify-once*）启用两级 deny（opt-in 强化档）：
  //   (a) 未登记（AUTHORIZATION.md 无勾选）→ deny；
  //   (b) 已登记但 Write 全量内容缺 gateClass / process.exit(4) 闸门标记 → deny
  //       （提示从仓库模板复制；仅检查 Write 的全量 content，Edit 局部改动无全量内容、不检查）。
  if (
    process.env.WEB_REVERSE_AUTH_ENFORCE === "1" &&
    abs.replaceAll("\\", "/").includes("/artifacts/tasks/") &&
    /^verify-once.*\.(?:py|js|mjs)$/i.test(path.basename(abs))
  ) {
    const verifyOnceName = path.basename(abs);
    let denyReason = null;
    if (authUncheckedUp(path.dirname(abs))) {
      denyReason =
        "[web-reverse 红线 3] 服务端验收类产物（" + verifyOnceName +
        "）需先在任务目录 AUTHORIZATION.md 勾选任务属性（四选一）后才可生成。（多勾视为未登记，请保留唯一勾选）";
    } else if (
      typeof input.content === "string" &&
      !(input.content.includes("gateClass") && input.content.includes("process.exit(4)"))
    ) {
      denyReason =
        "[web-reverse 红线 3] " + verifyOnceName +
        " 缺少授权闸门标记：请从 scripts/verify/verify-once.template.mjs 复制（内置闸门与 audit 留痕）。";
    }
    if (denyReason) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: denyReason
          }
        }) + "\n"
      );
      return;
    }
  }

  if (path.dirname(abs) !== path.resolve(cwd)) {
    return;
  }

  const base = path.basename(abs);
  if (ROOT_WHITELIST.has(base)) {
    return;
  }

  if (!hasMarker && !WEB_REVERSE_ARTIFACT_RE.test(base)) {
    return;
  }

  const tasks = listTaskDirs();
  const latest = tasks[0];
  const dest = latest ? `artifacts/tasks/${latest.id}/` : "artifacts/tasks/<task-id>/";
  const isReport = /^report\.md$/i.test(base) || /report/i.test(base) && base.toLowerCase().endsWith(".md");

  let hint;
  if (!hasMarker && !latest) {
    hint =
      `当前目录没有初始化 web-reverse 任务（无 .web-reverse-tool-dir / artifacts/tasks/）。` +
      `请先执行：node ${path.join(toolDir, "task-init.mjs")} <task-id>。`;
  } else if (isReport) {
    hint = `最终报告就是 ${dest}report.md（小写，收尾时直接编辑填充，勿在根目录另建 REPORT.md）。`;
  } else {
    hint = `脚本/样本/中间数据请写到 ${dest} 下。`;
  }

  const reason =
    `[web-reverse 产物纪律] 禁止把 '${base}' 写到工作目录根 (${cwd})。` +
    `cwd 根仅允许 .web-reverse-tool-dir / .gitignore。${hint}`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    }) + "\n"
  );
}

function main() {
  const event = (process.argv[2] || "").toLowerCase();

  if (event === "guard") {
    guardRootWrite();
    return;
  }

  if (event === "session-start") {
    const tasks = listTaskDirs();
    if (tasks.length > 0 && authUnchecked(path.dirname(tasks[0].report))) {
      emitContext(
        `[web-reverse] 红线 3：任务 '${tasks[0].id}' 的 AUTHORIZATION.md 未勾选任务属性（四选一）。` +
          `开工先完成授权登记；属性 ④/未勾选不得进入服务端验收。`
      );
    }
    const unfinished = tasks.filter((t) => isSkeleton(t.report));
    if (unfinished.length > 0) {
      const t = unfinished[0];
      emitContext(
        `[web-reverse] 检测到未完成任务 '${t.id}'（artifacts/tasks/${t.id}/report.md 仍为骨架）。` +
          `继续它：node ${path.join(toolDir, "task-init.mjs")} ${t.id}；` +
          `完成时把全面总结写进 report.md（必填小节见骨架内注释）。`
      );
    } else if (tasks.length === 0) {
      emitContext(
        `[web-reverse] 当前目录没有授权分析任务。需要执行任务时先运行唯一开机命令：` +
          `node ${path.join(toolDir, "task-init.mjs")} <task-id>（幂等：建目录 + report.md 与 AUTHORIZATION.md 两个骨架）。`
      );
    }
    return;
  }
}

try {
  main();
} catch {
  // hook 绝不阻断主流程
}
process.exit(0);
