import { DENY_TOKENS, exists, failWith, readText } from "./common.mjs";

// check-evals —— evals/evals.json 结构级防退化门禁（fast 层）。
// 边界声明：本 checker 是结构级门禁而非行为门禁——无 runner，不实际执行 evals；
// 自由文本断言形态 {name, check} 的校验以本文件口径为准，
// docs/reference/eval-assertion-protocol.md 的类型化形态统一留待后续轮次。
// 断言文本与 category/files 并入扫描面（R3）。
//
// 校验维度：
//   1. JSON 可解析 / skill_name / evals 数组形状；
//   2. id 从 1 起严格递增无缺口；
//   3. 每条必填字段与 assertions 形状；
//   4. 六类合规类目各 ≥1（合规用例无法被静默删除）；
//   5. DENY_TOKENS 品牌/代号黑名单（唯一权威来源 common.mjs）不回流；
//   6. URL 域名白名单（合规保留域清单，精确域名匹配 + example 三件套子域）。

const findings = [];

const EVALS_PATH = "evals/evals.json";
if (!exists(EVALS_PATH)) {
  failWith([`evals file missing: ${EVALS_PATH}`], "check-evals");
}

let data;
try {
  data = JSON.parse(readText(EVALS_PATH));
} catch (err) {
  failWith([`evals.json is not valid JSON: ${err.message}`], "check-evals");
}

if (data.skill_name !== "web-reverse") {
  findings.push(`skill_name must be "web-reverse" (got: ${JSON.stringify(data.skill_name)})`);
}
if (!Array.isArray(data.evals) || data.evals.length === 0) {
  findings.push("evals must be a non-empty array");
}

// id 从 1 起严格递增无缺口；必填字段与断言形状
if (Array.isArray(data.evals)) {
  data.evals.forEach((item, index) => {
    if (item.id !== index + 1) {
      findings.push(`evals[${index}].id must be ${index + 1} (strictly increasing, no gaps; got: ${item.id})`);
    }
    for (const field of ["id", "category", "prompt", "expected_output", "assertions"]) {
      if (item[field] === undefined || item[field] === null || item[field] === "") {
        findings.push(`evals[${index}] missing required field: ${field}`);
      }
    }
    if (!Array.isArray(item.assertions) || item.assertions.length === 0) {
      findings.push(`evals[${index}].assertions must be a non-empty array`);
    } else {
      item.assertions.forEach((assertion, aIndex) => {
        if (
          !assertion ||
          typeof assertion.name !== "string" ||
          assertion.name === "" ||
          typeof assertion.check !== "string" ||
          assertion.check === ""
        ) {
          findings.push(`evals[${index}].assertions[${aIndex}] must be {name, check} strings`);
        }
      });
    }
  });
}

// 六类合规类目各 ≥1（合规用例无法被静默删除）
const REQUIRED_COMPLIANCE_CATEGORIES = [
  "compliance-authorized",
  "compliance-refuse-scalping",
  "compliance-verification-gate",
  "compliance-drm-distribution-refusal",
  "compliance-public-research-degraded",
  "compliance-scope-mismatch"
];
const present = new Set(Array.isArray(data.evals) ? data.evals.map((item) => item.category) : []);
for (const category of REQUIRED_COMPLIANCE_CATEGORIES) {
  if (!present.has(category)) {
    findings.push(`compliance category missing (cannot be silently removed): ${category}`);
  }
}

// DENY_TOKENS 扫描 prompt + expected_output（CJK includes / 拉丁 \b 词边界）
const isLatinToken = (token) => /^[A-Za-z0-9]+$/.test(token);
if (Array.isArray(data.evals)) {
  data.evals.forEach((item, index) => {
    const text = [
      item.prompt,
      item.expected_output,
      item.category,
      Array.isArray(item.files) ? item.files.join(" ") : "",
      Array.isArray(item.assertions)
        ? item.assertions
            .map((a) => (a && typeof a === "object") ? `${a.name ?? ""} ${a.check ?? ""}` : "")
            .join("\n")
        : ""
    ].join("\n");
    for (const token of DENY_TOKENS) {
      const hit = isLatinToken(token)
        ? new RegExp("\\b" + token + "\\b").test(text)
        : text.includes(token);
      if (hit) {
        findings.push(`evals[${index}] contains real-target token "${token}"`);
      }
    }
  });
}

// URL 域名白名单：从 prompt + expected_output 提取 https?://<host>（去端口），
// host 须 ∈ ALLOWED_HOSTS 或 *.example.com/.org/.net 子域。
const ALLOWED_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "target-example.com",
  "localhost",
  "127.0.0.1"
]);
const URL_RE = /https?:\/\/([A-Za-z0-9.-]+)(?::\d+)?/g;
const isAllowedHost = (host) =>
  ALLOWED_HOSTS.has(host) ||
  host.endsWith(".example.com") ||
  host.endsWith(".example.org") ||
  host.endsWith(".example.net");
if (Array.isArray(data.evals)) {
  data.evals.forEach((item, index) => {
    const text = [
      item.prompt,
      item.expected_output,
      item.category,
      Array.isArray(item.files) ? item.files.join(" ") : "",
      Array.isArray(item.assertions)
        ? item.assertions
            .map((a) => (a && typeof a === "object") ? `${a.name ?? ""} ${a.check ?? ""}` : "")
            .join("\n")
        : ""
    ].join("\n");
    for (const match of text.matchAll(URL_RE)) {
      if (!isAllowedHost(match[1])) {
        findings.push(`evals[${index}] contains non-whitelisted URL host: ${match[1]}`);
      }
    }
  });
}

failWith(findings, "check-evals");
