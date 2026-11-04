import path from "node:path";
import {
  allowedRootDirs,
  allowedRootFiles,
  failWith,
  isAllowedDirName,
  isKebabStem,
  rel,
  repoRoot,
  walk
} from "./common.mjs";

const findings = [];

for (const entry of walk(repoRoot, {
  includeFiles: false,
  includeDirs: true,
  skip: new Set(["dist", "node_modules", ".git", ".idea", ".vscode", "artifacts", "__pycache__"])
})) {
  const relative = rel(entry);
  const parts = relative.split("/");
  if (parts[0] === ".history" || parts[0].startsWith(".")) {
    continue;
  }
  if (parts.length === 1) {
    if (!allowedRootDirs.has(parts[0])) {
      findings.push(`root directory is not allowed: ${relative}`);
    }
    continue;
  }
  const name = path.basename(entry);
  if (!isAllowedDirName(name)) {
    findings.push(`directory must use kebab-case or _TEMPLATE: ${relative}`);
  }
}

for (const entry of walk(repoRoot, {
  includeFiles: true,
  includeDirs: false,
  skip: new Set(["dist", "node_modules", ".git", ".idea", ".vscode", "artifacts", "__pycache__"])
})) {
  const relative = rel(entry);
  const parts = relative.split("/");
  const name = path.basename(entry);
  if (parts[0] === ".history" || parts[0].startsWith(".")) {
    continue;
  }
  if (parts.length === 1 && /^rollout-.*\.md$/i.test(name)) {
    continue;
  }
  if (parts[0] === "legacy") {
    continue;
  }
  if (parts.length === 1) {
    if (!allowedRootFiles.has(name)) {
      findings.push(`root file is not allowed: ${relative}`);
    }
    continue;
  }
  if (name === "README.md") {
    continue;
  }
  if (!isKebabStem(name)) {
    findings.push(`file must use kebab-case naming: ${relative}`);
  }
}

// 打包卫生（R3）：仓库内不得残留 __pycache__ 目录或 .pyc 文件。
// 独立 walk——skip 不得含 __pycache__；含 .history（现有 walk 靠 parts[0].startsWith(".") 旁路，独立断言须自持）。
// 本地 Python 冒烟请设 PYTHONDONTWRITEBYTECODE=1。
const HYGIENE_SKIP = new Set(["node_modules", ".git", "dist", ".history", ".idea", ".vscode", "artifacts"]);
for (const entry of walk(repoRoot, { includeFiles: true, includeDirs: true, skip: HYGIENE_SKIP })) {
  const relPath = rel(entry);
  if (path.basename(relPath) === "__pycache__" || relPath.endsWith(".pyc")) {
    findings.push(`打包卫生：仓库内不得残留 __pycache__ / .pyc（本地 Python 冒烟请设 PYTHONDONTWRITEBYTECODE=1）: ${relPath}`);
  }
}

failWith(findings, "check-naming");
