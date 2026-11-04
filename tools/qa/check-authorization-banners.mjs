import fs from "node:fs";
import path from "node:path";
import {
  DENY_TOKENS,
  exists,
  failWith,
  readText,
  repoRoot,
  walk
} from "./common.mjs";

// check-authorization-banners —— 红线 3（授权准入）防回潮门禁：
//   1. 授权横幅对象清单已随 R4 清空（common.BANNER_FILES 恒为空；横幅校验循环随之移除，
//      授权口径由 verify-once 模板首行注释 + 下方模板断言承担）；
//   2. SKILL.md 红线 3 关键措辞不得被静默删弱；
//   3. 真实目标品牌不得回流（DENY_TOKENS 全域扫描）；
//   4. task-init 授权登记不得回退；
//   5. 公开分发决策双 needle（2026-11-04 解禁，自分发禁令 needle 演进）。

const findings = [];

const skill = readText("SKILL.md");
for (const needle of ["授权准入", "无法归类时", "三条红线"]) {
  if (!skill.includes(needle)) {
    findings.push(`SKILL.md is missing red line 3 wording: ${needle}`);
  }
}

// 公开分发决策双 needle（2026-11-04 解禁）：政策文档与 README 均须保留「公开分发」决策句，
// 防回潮为禁令表述或无表述。
for (const file of [
  "docs/reference/legal-and-case-safety-policy.md",
  "README.md"
]) {
  if (!exists(file)) {
    findings.push(`distribution-banner target missing: ${file}`);
    continue;
  }
  if (!readText(file).includes("公开分发")) {
    findings.push(`missing distribution-banner wording (公开分发): ${file}`);
  }
}

// fail-closed 逻辑级防退化（R3）：needle 为完整表达式正则——
// 防"注释保字符串、逻辑取首命中"的回改形态（如 hits[0] ?? null + 尾注释）。
// 正则锚定完整语句（const klass = …/行首 if …），裸表达式子串或注释内字符串不满足。
const verifyOnceTpl = readText("scripts/verify/verify-once.template.mjs");
if (!/const klass = hits\.length === 1 \? hits\[0\] : null;/.test(verifyOnceTpl)) {
  findings.push("verify-once.template.mjs must keep fail-closed expression: hits.length === 1 ? hits[0] : null");
}
const verifyOffline = readText("scripts/verify/verify-offline.py");
if (!/^\s*if len\(hits\) == 1:/m.test(verifyOffline)) {
  findings.push("verify-offline.py must keep fail-closed gate: if len(hits) == 1:");
}

// 真实目标品牌/代号防回潮（全域文本扫描）：DENY_TOKENS 唯一权威来源在 common.mjs；
// 合法持有 token 的仅限下方 QA_TOKEN_HOLDERS 豁免集（三个消费 checker 自身）。
// 纯 ASCII 字母数字 token 用 \b 词边界匹配，CJK token 用 includes，防子串误伤/漏报。
const QA_TOKEN_HOLDERS = new Set([
  "tools/qa/common.mjs",
  "tools/qa/check-authorization-banners.mjs",
  "tools/qa/check-evals.mjs"
]);
const TEXT_EXTENSIONS = new Set([
  ".md", ".json", ".jsonl", ".yaml", ".yml", ".mjs", ".js", ".py", ".txt"
]);
const isLatinToken = (token) => /^[A-Za-z0-9]+$/.test(token);

for (const file of walk(repoRoot, {
  includeFiles: true,
  includeDirs: false,
  skip: new Set(["node_modules", ".git", "artifacts", "dist", ".idea", ".vscode", "__pycache__"])
})) {
  const relative = path.relative(repoRoot, file).replaceAll("\\", "/");
  if (QA_TOKEN_HOLDERS.has(relative)) continue;
  const ext = relative.slice(relative.lastIndexOf("."));
  if (!TEXT_EXTENSIONS.has(ext)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const token of DENY_TOKENS) {
    const hit = isLatinToken(token)
      ? new RegExp("\\b" + token + "\\b").test(content)
      : content.includes(token);
    if (hit) {
      findings.push(`real-target token "${token}" regressed in: ${relative}`);
    }
  }
}

if (!readText("tools/task/task-init.mjs").includes("AUTHORIZATION")) {
  findings.push("task-init.mjs no longer writes AUTHORIZATION.md (red line 3 regression)");
}

// Node 侧服务端验收模板（verify-once.template.mjs）逻辑级断言——防"注释糊弄"的装饰性模板：
// 必须真实实现属性闸门 / 域闸门 / fail-closed 退出 / 红线 3 口径 / 授权登记 / audit 留痕。
const VERIFY_ONCE_TEMPLATE = "scripts/verify/verify-once.template.mjs";
if (!exists(VERIFY_ONCE_TEMPLATE)) {
  findings.push(`verify-once template missing: ${VERIFY_ONCE_TEMPLATE}`);
} else {
  const template = readText(VERIFY_ONCE_TEMPLATE);
  for (const needle of [
    "function gateClass",
    "function gateHost",
    "process.exit(4)",
    "红线 3",
    "AUTHORIZATION.md",
    "audit.log"
  ]) {
    if (!template.includes(needle)) {
      findings.push(`verify-once.template.mjs missing gate marker: ${needle}`);
    }
  }
}

failWith(findings, "check-authorization-banners");
