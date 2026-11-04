import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const allowedRootFiles = new Set([
  "SKILL.md",
  "README.md",
  "PROMPTS.md",
  "package.json",
  "CHANGELOG.md",
  "LICENSE"
]);

export const allowedRootDirs = new Set([
  "docs",
  "evals",
  "hooks",
  "scripts",
  "tools"
]);

// 品牌/代号黑名单唯一权威来源（红线 3 防回潮）：终检 grep、check-evals 一律以此处为准；
// 合法持有本数组的文件仅限 tools/qa/ 下三个消费 checker（扫描豁免集）。
// 新增 token 形态约定：纯拉丁字母数字（/^[A-Za-z0-9]+$/）或含非 ASCII 的 CJK 词——两个消费 checker 的 isLatinToken 程序式判定依赖此形态；含连字符/点号的 token 会误入 CJK includes 分支（子串匹配，向误伤方向偏移）。
export const DENY_TOKENS = [
  "停宜慧", "gkdg", "dkduanju", "fengniao", "蜜雪", "杜仲",
  "惠企查", "风鸟", "天蚕", "hqc", "oilprice"
];

// 授权横幅文件清单（R4 起为空）：横幅对象已于 R4 移除；
// 授权口径由 verify-once 模板首行注释与 check-authorization-banners 模板断言承担。
export const BANNER_FILES = [];

export function walk(dir, options = {}) {
  const { includeFiles = true, includeDirs = true, skip = new Set() } = options;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (includeDirs) results.push(fullPath);
      results.push(...walk(fullPath, options));
    } else if (includeFiles) {
      results.push(fullPath);
    }
  }
  return results;
}

export function rel(target) {
  return path.relative(repoRoot, target).replaceAll("\\", "/");
}

export function exists(relPath) {
  const target = path.isAbsolute(relPath)
    ? relPath
    : path.join(repoRoot, ...relPath.split("/"));
  return fs.existsSync(target);
}

export function readText(relPath) {
  return fs.readFileSync(
    path.isAbsolute(relPath)
      ? relPath
      : path.join(repoRoot, ...relPath.split("/")),
    "utf8"
  );
}

export function failWith(findings, title) {
  if (findings.length === 0) {
    console.log(`${title}: OK`);
    return;
  }
  console.error(`${title}: FAILED`);
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
}

export async function loadCaseModule(fullPath) {
  return import(pathToFileURL(fullPath).href);
}

export function isKebabStem(fileName) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*\.[a-z0-9]+$/.test(fileName);
}

export function isAllowedDirName(dirName) {
  return dirName === "_TEMPLATE" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dirName);
}

export function containsSuspiciousSecrets(text) {
  const patterns = [
    /https?:\/\/[^\s`)"']+/i,
    /\b(cookie|token|secret|authorization)\b\s*[:=]\s*["'][^"']{8,}/i
  ];
  return patterns.find((pattern) => pattern.test(text)) || null;
}
