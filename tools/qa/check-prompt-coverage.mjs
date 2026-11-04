import { failWith, readText } from "./common.mjs";

// check-prompt-coverage —— PROMPTS.md 治理契约覆盖门禁（R4 收缩版）：
//   1. 必须包含三组治理关键词：红线 3 口径、task-init 开机命令、reportSchemaVersion=2 收尾契约；
//   2. 不得残留任何 <!-- topics: ... --> 专题覆盖标记（知识层已移除）。
const prompts = readText("PROMPTS.md");
const findings = [];

for (const needle of ["红线 3", "task-init.mjs", "reportSchemaVersion=2"]) {
  if (!prompts.includes(needle)) {
    findings.push(`PROMPTS.md is missing governance keyword: ${needle}`);
  }
}

const markerRegex = /<!--\s*topics:/;
if (markerRegex.test(prompts)) {
  findings.push("PROMPTS.md still contains <!-- topics: ... --> markers (retired machinery)");
}

failWith(findings, "check-prompt-coverage");
