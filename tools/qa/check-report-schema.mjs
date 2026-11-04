#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";


const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const contractPath = path.join(repoRoot, "tools", "qa", "fixtures", "report-schema-contract.json");
const casesPath = path.join(repoRoot, "tools", "qa", "fixtures", "report-schema-cases.json");
const outputContractPath = path.join(repoRoot, "docs", "reference", "output-contract.md");
const taskInitPath = path.join(repoRoot, "tools", "task", "task-init.mjs");
const productionSchemaPath = path.join(repoRoot, "tools", "report-schema.mjs");
const beginMarker = "<!-- BEGIN GENERATED: report-sections -->";
const endMarker = "<!-- END GENERATED: report-sections -->";

const normativeFiles = [
  "SKILL.md",
  "README.md",
  "PROMPTS.md",
  "docs/guides/getting-started.md",
  "docs/guides/task-lifecycle.md",
  "docs/guides/release-workflow.md",
  "docs/reference/output-contract.md",
  "docs/reference/deliverable-ladder.md",
  "docs/reference/reverse-artifacts.md",
  "docs/reference/eval-assertion-protocol.md",
  "docs/reference/claim-hygiene.md",
  "docs/reference/tool-reference.md",
  "docs/reference/qa-dependency-graph.md",
  "docs/reference/reverse-bootstrap.md",
  "docs/reference/stop-loss-parameters.md"
];

const staleTerms = ["六节", "任务目标与结果", "难点与坑点", "经验沉淀", "交付物与复现", "关键链路与锚点", "关键调用点"];
const skeletonNeedles = ["骨架生成于"];

// The independent contract fixture is the only N/A policy source.  Do not
// duplicate its section policy here: coordinated drift must fail closed.
const expectedPlanPath = ".optimization-evidence/round-1/04-final-plan.md";
const frozenSourcePlanSha256 = "bec5e43c1fe9d43d90c76714c40b64cf16a5dc4e6595fcf136fbc3ef28d60d13";
const requiredRuleKeys = [
  "codeFenceHeadingsIgnored",
  "htmlCommentHeadingsIgnored",
  "h3Allowed",
  "crlfAccepted",
  "nonEmptyBodyRequired",
  "extraTopLevelH2Rejected",
  "oldReportsReadOnly",
  "generatedBlockHasNoTimestamp"
];

let contractCache = null;
let productionModulePromise = null;

function readContract() {
  if (contractCache === null) contractCache = readJson(contractPath);
  return contractCache;
}

async function loadProductionSchema() {
  // The purity gate must run before the dynamic import.  Import evaluation is
  // an execution boundary: checking afterwards is too late for a side effect.
  const purity = checkSchemaPurity();
  if (!purity.ok) throw new Error("production schema purity gate: " + purity.details.join(" | "));
  if (productionModulePromise === null) productionModulePromise = import(pathToFileURL(productionSchemaPath).href + "?r1-remediation=1");
  return productionModulePromise;
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function result(ok, code = null, details = []) {
  return { ok, code, details };
}

function contractSections(contract) {
  return Array.isArray(contract?.sections) ? contract.sections : [];
}

function sameSectionList(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => item?.ordinal === right[index]?.ordinal && item?.title === right[index]?.title);
}

function hashText(value) {
  return crypto.createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function checkContractShape(contract) {
  const sections = contractSections(contract);
  const titles = sections.map((section) => section?.title);
  const nA = contract?.nA;
  const rules = contract?.rules;
  const ruleShape = rules && typeof rules === "object"
    && requiredRuleKeys.every((key) => Object.prototype.hasOwnProperty.call(rules, key) && rules[key] === true)
    && Object.keys(rules).length === requiredRuleKeys.length;
  const sectionShape = contract?.schemaVersion === 2
    && typeof contract?.sourcePlanSha256 === "string"
    && /^[0-9a-f]{64}$/u.test(contract.sourcePlanSha256)
    && contract?.titleFormat === "ATX H2"
    && contract?.topLevelSectionCount === 11
    && sections.length === 11
    && new Set(titles).size === 11
    && new Set(sections.map((section) => section?.ordinal)).size === 11
    && sections.every((section, index) => section?.ordinal === index + 1 && typeof section?.title === "string" && section.title.length > 0);
  const naShape = nA && typeof nA === "object" && Object.keys(nA).length === titles.length
    && titles.every((title) => Object.prototype.hasOwnProperty.call(nA, title)
      && (nA[title] === null || (typeof nA[title] === "string" && nA[title].length > 0
        && (nA[title] === "无" || nA[title].endsWith("："))))); 
  if (!sectionShape || !ruleShape || !naShape) {
    return result(false, "contract-mismatch", ["independent contract shape is invalid"]);
  }
  return result(true);
}

export function checkSourcePlanTrust(contract = readContract()) {
  if (contract?.sourcePlan !== expectedPlanPath) {
    return result(false, "contract-mismatch", ["sourcePlan must be " + expectedPlanPath]);
  }
  const planPath = path.resolve(repoRoot, contract.sourcePlan);
  const relative = path.relative(repoRoot, planPath).replaceAll(path.sep, "/");
  if (relative.startsWith("../") || path.isAbsolute(relative)) {
    return result(false, "contract-mismatch", ["sourcePlan is outside the repository"]);
  }
  // The plan is maintenance evidence, not a source runtime dependency.  A
  // source-only installation has no .optimization-evidence tree and is valid;
  // when the evidence is present, the hash is anchored in this checker rather
  // than in the mutable fixture metadata.
  if (!fs.existsSync(planPath)) {
    return result(true, "source-plan-skip", ["SKIP sourcePlan evidence is absent; source-only install remains valid"]);
  }
  const planStat = fs.lstatSync(planPath);
  if (!planStat.isFile() || planStat.isSymbolicLink()) {
    return result(false, "contract-mismatch", ["sourcePlan evidence is not a regular file"]);
  }
  const actual = hashText(readText(planPath));
  if (actual !== frozenSourcePlanSha256) {
    return result(false, "contract-mismatch", ["sourcePlanSha256 expected=" + frozenSourcePlanSha256, "sourcePlanSha256 actual=" + actual]);
  }
  return result(true);
}

export function checkRendererSkeleton(productionModule, contract = readContract()) {
  if (typeof productionModule?.renderReportSkeleton !== "function") {
    return result(false, "contract-mismatch", ["production skeleton renderer is missing"]);
  }
  let skeleton;
  try {
    skeleton = productionModule.renderReportSkeleton("__renderer-oracle__", "2026-01-01T00:00:00.000Z");
  } catch (error) {
    return result(false, "contract-mismatch", ["production skeleton renderer threw: " + (error?.message || error)]);
  }
  if (typeof skeleton !== "string") {
    return result(false, "contract-mismatch", ["production skeleton renderer did not return a string"]);
  }
  const actual = parseReportSections(skeleton);
  const expected = contractSections(contract);
  const actualTitles = actual.map((section) => section.title);
  const expectedTitles = expected.map((section) => section.title);
  if (actualTitles.length !== expectedTitles.length || actualTitles.some((title, index) => title !== expectedTitles[index])) {
    return result(false, "contract-mismatch", ["renderer skeleton sections=" + JSON.stringify(actualTitles), "contract sections=" + JSON.stringify(expectedTitles)]);
  }
  return result(true);
}

export function checkProductionContract(sections, version, contract = readContract(), productionModule = null) {
  const shape = checkContractShape(contract);
  if (!shape.ok) return shape;
  const expected = contractSections(contract);
  if (productionModule !== null) {
    if (typeof productionModule.renderReportSkeleton !== "function" || typeof productionModule.renderReportSectionsBlock !== "function") {
      return result(false, "contract-mismatch", ["production renderer surface is missing"]);
    }
    const renderer = checkRendererSkeleton(productionModule, contract);
    if (!renderer.ok) return renderer;
  }
  const sectionListOk = Array.isArray(sections) && sections.length === expected.length && sections.every((item, index) => {
    const wanted = expected[index];
    const policy = contract.nA[wanted.title];
    const productionNA = item?.na;
    const naMatches = productionNA === policy
      || (typeof productionNA === "string" && typeof policy === "string"
        && productionNA.startsWith(policy)
        && /^<[^>\r\n]+>(?:\s*(?:→|->)\s*<[^>\r\n]+>)*$/u.test(productionNA.slice(policy.length).trim()));
    return item?.ordinal === wanted?.ordinal
      && item?.title === wanted?.title
      && naMatches;
  });
  if (version !== contract.schemaVersion || !sameSectionList(sections, expected) || !sectionListOk) {
    return result(false, "contract-mismatch", ["production version=" + version, "expected version=" + contract.schemaVersion, "production sections=" + JSON.stringify((sections || []).map((item) => [item?.ordinal, item?.title, item?.na])), "contract sections=" + JSON.stringify(expected.map((item) => [item.ordinal, item.title, contract.nA[item.title]]))]);
  }
  return result(true);
}

// This is deliberately a small, explicit Markdown block subset required by
// the 04 contract.  It is not a complete CommonMark implementation: it
// handles top-level ATX H2, fenced code, HTML comments, blockquotes, list
// containers, and raw <pre> blocks.  Container state is checked before a line
// can become a top-level heading, and fence state wins over comment text.
function fenceOpening(line, container = null) {
  let index = 0;
  const maxIndent = container ? line.length : 3;
  while (index < maxIndent && line[index] === " ") index += 1;
  const marker = line[index];
  if (marker !== String.fromCharCode(96) && marker !== "~") return null;
  let length = 0;
  while (line[index + length] === marker) length += 1;
  if (length < 3) return null;
  const info = line.slice(index + length);
  if (marker === String.fromCharCode(96) && info.includes(String.fromCharCode(96))) return null;
  return { marker, length, container: container ? { ...container } : null };
}

function isFenceClosing(line, fence) {
  let rest = line;
  if (fence.container?.kind === "quote") {
    if (!/^ {0,3}>/u.test(line)) return false;
    rest = line.replace(/^ {0,3}>[ \t]*/u, "");
  } else if (fence.container?.kind === "list") {
    const indent = leadingSpaces(line);
    if (indent < Number(fence.container.indent || 0)) return false;
    rest = line.slice(indent);
  } else {
    let index = 0;
    while (index < 3 && rest[index] === " ") index += 1;
    rest = rest.slice(index);
  }
  const marker = rest[0];
  if (marker !== fence.marker) return false;
  let length = 0;
  while (rest[length] === marker) length += 1;
  return length >= fence.length && rest.slice(length).trim() === "";
}

function atxHeading(line) {
  let index = 0;
  while (index < 3 && line[index] === " ") index += 1;
  if (line.slice(index, index + 2) !== "##" || line[index + 2] === "#") return null;
  index += 2;
  if (line[index] !== " " && line[index] !== String.fromCharCode(9)) return null;
  while (line[index] === " " || line[index] === String.fromCharCode(9)) index += 1;
  let title = line.slice(index).trim();
  if (!title) return null;
  // ATX closing sequence is optional and is part of the Markdown line, not
  // part of the title.  Only strip it when whitespace separates it.
  let end = title.length;
  while (end > 0 && title[end - 1] === "#") end -= 1;
  if (end < title.length) {
    let before = end;
    while (before > 0 && (title[before - 1] === " " || title[before - 1] === String.fromCharCode(9))) before -= 1;
    if (before > 0 && before < end) title = title.slice(0, before).trim();
  }
  return title || null;
}

function leadingSpaces(line) {
  let count = 0;
  while (line[count] === " ") count += 1;
  return count;
}

function listMarkerAt(line, start = 0) {
  const match = line.slice(start).match(/^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+|$)/);
  if (!match) return null;
  const leading = match[1].length;
  const marker = match[2];
  const spaces = match[3].length;
  const markerEnd = start + leading + marker.length;
  return { marker, indent: markerEnd + Math.max(1, spaces), markerEnd, contentStart: markerEnd + spaces };
}

function quotePrefixAt(line) {
  const match = line.match(/^ {0,3}>[ \t]?/);
  return match ? { length: match[0].length } : null;
}

const rawBlockTags = new Set([
  "address", "article", "aside", "blockquote", "details", "dialog", "div", "dl", "fieldset",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main",
  "nav", "ol", "p", "pre", "script", "section", "style", "table", "tbody", "td", "textarea",
  "tfoot", "th", "thead", "tr", "ul"
]);

function rawOpening(line, container = false) {
  // Only a block-start tag opens raw state.  Inline mentions such as
  // "use <pre> here" remain ordinary prose.
  const match = line.match(/^ {0,3}<([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*?)?>/iu);
  if (!match || !rawBlockTags.has(match[1].toLowerCase())) return null;
  return { start: match.index || 0, tag: match[1].toLowerCase(), opening: match[0] };
}

function rawClosing(line, tag) {
  return new RegExp("</\\s*" + tag + "\\s*>", "iu").test(line);
}

function visibleOutsideLine(line, commentState) {
  let visible = "";
  let cursor = 0;
  let state = commentState;
  while (cursor < line.length) {
    if (state) {
      const end = line.indexOf("-->", cursor);
      if (end < 0) return { text: visible, state };
      cursor = end + 3;
      state = false;
      continue;
    }
    const start = line.indexOf("<!--", cursor);
    if (start < 0) {
      visible += line.slice(cursor);
      break;
    }
    visible += line.slice(cursor, start);
    cursor = start + 4;
    state = true;
  }
  return { text: visible, state };
}

function containerLine(line, state) {
  const quote = quotePrefixAt(line);
  if (quote) {
    const rest = line.slice(quote.length);
    const list = listMarkerAt(rest);
    return { kind: "quote", rest, list, listContinuation: true };
  }
  const indent = leadingSpaces(line);
  if (state.listActive) {
    if (line.trim() === "") return { kind: "list", rest: line, listContinuation: true, indent };
    if (indent >= state.listIndent) {
      const list = listMarkerAt(line);
      return { kind: "list", rest: line, list, listContinuation: true, indent };
    }
    state.listActive = false;
    state.listIndent = 0;
  }
  const list = listMarkerAt(line);
  if (list) {
    state.listActive = true;
    state.listIndent = list.indent;
    return { kind: "list", rest: line.slice(list.markerEnd), list, listContinuation: false, indent };
  }
  return { kind: "top", rest: line, list: null, listContinuation: false, indent };
}

export function parseReportSections(text) {
  const source = String(text).replaceAll(String.fromCharCode(13, 10), String.fromCharCode(10)).replaceAll(String.fromCharCode(13), String.fromCharCode(10));
  const lines = source.split(String.fromCharCode(10));
  const sections = [];
  let fence = null;
  let rawHtml = null;
  let comment = false;
  let current = null;
  const container = { listActive: false, listIndent: 0 };
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (fence) {
      if (isFenceClosing(rawLine, fence)) fence = null;
      continue;
    }
    if (rawHtml) {
      if (rawClosing(rawLine, rawHtml)) rawHtml = null;
      continue;
    }
    const commentView = visibleOutsideLine(rawLine, comment);
    comment = commentView.state;
    if (comment && !commentView.text.trim()) continue;
    const line = commentView.text;
    const info = containerLine(line, container);
    if (info.kind === "quote") {
      // A quoted line can contain a list item or a fence, but never a
      // top-level section heading.  Keep ordinary quoted prose as body text.
      const quoteRest = info.rest;
      const quotedList = info.list;
      const quoteFenceLine = quotedList ? quoteRest.slice(quotedList.markerEnd) : quoteRest;
      const opening = fenceOpening(quoteFenceLine, { kind: "quote", indent: 0 });
      if (opening) fence = opening;
      const quotedRaw = rawOpening(quoteFenceLine, true);
      if (quotedRaw) {
        rawHtml = rawClosing(quoteFenceLine.slice(quotedRaw.start + quotedRaw.opening.length), quotedRaw.tag) ? null : quotedRaw.tag;
        continue;
      }
      if (current && quoteRest.trim() && atxHeading(quoteRest) === null) current.bodyLines.push(quoteRest);
      continue;
    }
    if (info.kind === "list") {
      const list = info.list;
      const fenceLine = info.rest;
      const listIndent = list?.indent ?? container.listIndent;
      const opening = fenceOpening(fenceLine, { kind: "list", indent: listIndent });
      if (opening) fence = opening;
      const listRaw = rawOpening(fenceLine, true);
      if (listRaw) {
        rawHtml = rawClosing(fenceLine.slice(listRaw.start + listRaw.opening.length), listRaw.tag) ? null : listRaw.tag;
        continue;
      }
      // A heading on a list marker or continuation is not top-level.  Other
      // list prose remains valid section evidence.
      if (current && info.rest.trim() && atxHeading(info.rest) === null) current.bodyLines.push(info.rest);
      continue;
    }
    const openingRaw = rawOpening(line, false);
    if (openingRaw) {
      const afterOpening = line.slice(openingRaw.start + openingRaw.opening.length);
      rawHtml = rawClosing(afterOpening, openingRaw.tag) ? null : openingRaw.tag;
      continue;
    }
    const opening = fenceOpening(line);
    if (opening) {
      fence = opening;
      continue;
    }
    const title = atxHeading(line);
    if (title !== null) {
      current = { title, line: index + 1, bodyLines: [] };
      sections.push(current);
      continue;
    }
    if (current && line.trim() !== "") current.bodyLines.push(line);
  }
  return sections;
}

function stripInvisibleCharacters(value) {
  return [...String(value)].filter((character) => {
    if (character === "\n" || character === "\r" || character === "\t") return true;
    return !/[\p{Cf}\p{Cc}]/u.test(character);
  }).join("");
}

function bodyText(section) {
  return stripInvisibleCharacters(section.bodyLines.join(String.fromCharCode(10))).trim();
}

function visibleLineText(line) {
  let text = stripInvisibleCharacters(line).trim();
  text = text.replace(/^ {0,3}>[ \t]?/u, "");
  text = text.replace(/^(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/u, "").trim();
  return text;
}

function isMeaningfulBody(section) {
  return bodyText(section).split(String.fromCharCode(10)).some((line) => {
    const trimmed = visibleLineText(line);
    if (!trimmed) return false;
    if (/^ {0,3}#{1,6}(?:[ \t]+|$)/u.test(trimmed)) return false;
    if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/u.test(trimmed)) return false;
    if (/^(?:[-+*]|\d{1,9}[.)])$/u.test(trimmed)) return false;
    return true;
  });
}

function normalizeInlineText(value) {
  return stripInvisibleCharacters(value).normalize("NFKC").trim();
}

function stripInlineWrapper(value) {
  let text = normalizeInlineText(value);
  for (let round = 0; round < 8; round += 1) {
    const before = text;
    text = text.replace(/(?:\*\*|__|~~|\*|_|<\/?(?:em|strong|code|span)\b[^>]*>|\x60+)/giu, "");
    if (text === before) break;
  }
  return text.trim();
}

function normalizeClaimText(value) {
  return stripInlineWrapper(value).normalize("NFKC").trim();
}

function isNAClaim(value) {
  const compact = normalizeClaimText(value);
  if (/^n\s*\/\s*a/iu.test(compact)) return true;
  if (/^na(?:$|[\s\p{P}\p{S}])/iu.test(compact)) return true;
  for (const token of ["当前无未解决难点", "未遇到影响结果的坑点", "本任务无跨任务新增", "未命中", "一次收敛"]) {
    if (compact.startsWith(token)) return true;
  }
  return /^无(?:[\s\p{P}\p{S}]|$)/u.test(compact);
}

function hasReason(value) {
  const reason = normalizeClaimText(value);
  if (!reason || /<[^>\r\n]+>|\{[^}\r\n]+\}|\[[^\]\r\n]+\]/u.test(reason)) return false;
  if (/\b(?:todo|tbd|placeholder|xxx+|x{1,3})\b|待补充|待填写|待完成|待定/iu.test(reason)) return false;
  const meaningful = [...reason].filter((character) => !/\s/u.test(character));
  if (meaningful.length < 2) return false;
  if (/^[\p{P}\p{S}]+$/u.test(reason)) return false;
  const core = reason.replace(/[\s\p{P}\p{S}]/gu, "");
  const placeholderTokens = ["具体依据", "检查范围", "已检查范围", "已检查", "依据", "范围", "证据", "说明", "原因", "暂无", "无"];
  let remainder = core;
  for (const token of [...placeholderTokens].sort((left, right) => right.length - left.length)) remainder = remainder.replaceAll(token, "");
  if (core.length > 0 && remainder.length === 0) return false;
  return meaningful.some((character) => !/[\p{P}\p{S}]/u.test(character));
}

function validateSpecificNA(policy, value) {
  const compact = normalizeClaimText(value);
  const normalizedPolicy = normalizeClaimText(policy);
  if (normalizedPolicy === "无") {
    return compact === "无" || skeletonNeedles.some((needle) => compact.includes(needle));
  }
  if (!compact.startsWith(normalizedPolicy)) return false;
  const reason = compact.slice(normalizedPolicy.length).trim();
  if (!hasReason(reason)) return false;
  return true;
}

function validateSectionContent(section, value, contract) {
  const policy = contract?.nA?.[section.title];
  if (policy === undefined) return false;
  // A substantive, non-N/A explanation is valid even in an allow section;
  // once the text is an N/A claim, however, the exact contract prefix and a
  // concrete reason are mandatory.
  if (policy === null) return !isNAClaim(value);
  if (!isNAClaim(value)) return true;
  return validateSpecificNA(policy, value);
}

function expectedTitles(sections) {
  return sections.map((section) => section.title);
}

export function validateReportText(text, expectedSections = readContract().sections, contract = readContract()) {
  const actual = parseReportSections(text);
  const expected = expectedTitles(expectedSections);
  const counts = new Map();
  for (const section of actual) counts.set(section.title, (counts.get(section.title) || 0) + 1);
  const missing = expected.filter((title) => !counts.has(title));
  if (missing.length > 0) return result(false, "missing-section", missing);
  const duplicates = expected.filter((title) => counts.get(title) > 1);
  if (duplicates.length > 0) return result(false, "duplicate-section", duplicates);
  const extras = actual.map((section) => section.title).filter((title) => !expected.includes(title));
  if (extras.length > 0) return result(false, "extra-section", extras);
  if (actual.map((section) => section.title).some((title, index) => title !== expected[index])) return result(false, "order", actual.map((section) => section.title));
  for (const section of actual) if (!isMeaningfulBody(section)) return result(false, "empty-section", [section.title]);
  for (const section of actual) if (!validateSectionContent(section, bodyText(section), contract)) return result(false, "insufficient-evidence", [section.title]);
  if (skeletonNeedles.some((needle) => String(text).includes(needle))) return result(false, "unfinished-skeleton", skeletonNeedles.filter((needle) => String(text).includes(needle)));
  return result(true);
}

export function checkGeneratedBlock(text, expectedBlock) {
  const beginCount = String(text).split(beginMarker).length - 1;
  const endCount = String(text).split(endMarker).length - 1;
  if (beginCount !== 1 || endCount !== 1) return result(false, "generated-doc-drift", ["markers begin=" + beginCount + " end=" + endCount]);
  const begin = text.indexOf(beginMarker);
  const end = text.indexOf(endMarker);
  const actual = text.slice(begin + beginMarker.length, end).replace(/^\r?\n/, "").replace(/\r?\n$/, "").replace(/\r\n/g, "\n");
  if (actual !== expectedBlock) return result(false, "generated-doc-drift", ["generated block differs from production schema"]);
  return result(true);
}

export function scanStaleReferences(relativePath, text) {
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const hit = staleTerms.find((term) => lines[index].includes(term));
    if (hit) return `stale-report-reference:${relativePath}:${index + 1}`;
  }
  return null;
}

function stripCommentsForPurity(source) {
  let output = "";
  let state = "code";
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (character === "/" && next === "*") { state = "block"; index += 1; continue; }
      if (character === "/" && next === "/") { state = "line"; index += 1; continue; }
      if (character === String.fromCharCode(34) || character === String.fromCharCode(39) || character === String.fromCharCode(96)) { state = "string"; quote = character; output += character; continue; }
      output += character;
      continue;
    }
    if (state === "block") {
      if (character === "*" && next === "/") { state = "code"; index += 1; }
      continue;
    }
    if (state === "line") {
      if (character === String.fromCharCode(10) || character === String.fromCharCode(13)) { state = "code"; output += character; }
      continue;
    }
    output += character;
    if (character === String.fromCharCode(92) && index + 1 < source.length) { output += source[++index]; continue; }
    if (character === quote) state = "code";
  }
  return output;
}

export function checkSchemaPurity(sourceText = null) {
  const source = sourceText === null ? readText(productionSchemaPath) : String(sourceText);
  const code = stripCommentsForPurity(source);
  const forbidden = [
    [/\bimport\s*\(/u, "dynamic import"],
    [/\bimport\s+(?:[^;\r\n]*?\s+from\s+)?["'][^"'\r\n]+["']/u, "static import"],
    [/\bexport\s+(?:[^;\r\n]*?\s+from\s+)?["'][^"'\r\n]+["']/u, "static re-export"],
    [/\brequire\s*\(/u, "require call"],
    [/\b(?:import|export)\s+[^;\r\n]*?\bfrom\s+["'](?:node:)?(?:assert|buffer|child_process|cluster|console|crypto|dns|events|fs|http|https|module|net|os|path|process|stream|url|util|vm)(?:\/[^"']*)?["']/iu, "node builtin import"],
    [/\brequire\s*\(\s*["'](?:node:)?(?:assert|buffer|child_process|cluster|console|crypto|dns|events|fs|http|https|module|net|os|path|process|stream|url|util|vm)(?:\/[^"']*)?["']/iu, "node builtin require"],
    [/\bprocess\b/u, "process access"],
    [/\bBuffer\b/u, "Buffer access"],
    [/\bDate\b/u, "clock access"],
    [/\bperformance\s*\./u, "clock access"],
    [/\bprocess\s*\.\s*hrtime\b/u, "clock access"],
    [/\b(?:readFile|writeFile|existsSync|mkdirSync|readdirSync|statSync|lstatSync|realpathSync)\b/u, "filesystem call"],
    [/\breport-schema-contract\b|\breport-schema-cases\b/u, "fixture import/reference"],
    [/\bcheck-report-schema\b|\bcheck-skill-contract\b|\bcheck-operating-contracts\b/u, "QA import/reference"]
  ];
  const hits = forbidden.filter(([pattern]) => pattern.test(code)).map(([, label]) => label);
  return hits.length > 0 ? result(false, "contract-mismatch", hits) : result(true);
}

export function collectStaticFindings(productionModule, contract = readContract()) {
  const findings = [];
  const trust = checkSourcePlanTrust(contract);
  if (!trust.ok) findings.push(trust);
  const production = checkProductionContract(productionModule?.REPORT_SECTIONS, productionModule?.REPORT_SCHEMA_VERSION, contract, productionModule);
  if (!production.ok) findings.push(production);
  if (production.ok && typeof productionModule?.renderReportSectionsBlock === "function") {
    const generatedResult = checkGeneratedBlock(readText(outputContractPath), productionModule.renderReportSectionsBlock());
    if (!generatedResult.ok) findings.push(generatedResult);
  }
  const purity = checkSchemaPurity();
  if (!purity.ok) findings.push(purity);
  for (const relativePath of normativeFiles) {
    const file = path.join(repoRoot, relativePath);
    if (!fs.existsSync(file)) {
      findings.push(result(false, "stale-report-reference", ["missing normative file: " + relativePath]));
      continue;
    }
    const stale = scanStaleReferences(relativePath, readText(file));
    if (stale) findings.push(result(false, stale, [relativePath]));
  }
  return findings;
}

export async function staticFindings(productionModule = null) {
  return collectStaticFindings(productionModule || (await loadProductionSchema()), readContract());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionRegex(title) {
  // Keep mutation selection aligned with the parser's top-level ATX subset,
  // including optional indentation and an ATX closing sequence.  Mutations
  // still operate only on literal report fixtures, never on parsed objects.
  // Body capture spans through the next top-level heading or absolute EOF —
  // a bare negative lookahead here would match at almost every position and
  // make replace* mutations leave the old body behind (self-test regression).
  const heading = `(?:^ {0,3}##[ \\t]+${escapeRegExp(title)}[ \\t]*(?:#+[ \\t]*)?$)`;
  return new RegExp(`(${heading}\\n)([\\s\\S]*?)(?=^ {0,3}##[ \\t]+(?!#)|(?![\\s\\S]))`, "m");
}

export function applyReportMutation(text, mutation = {}) {
  let value = String(text).replace(/\r\n?/g, "\n");
  const appendMutationText = () => {
    if (mutation.appendText) value += mutation.appendText;
  };
  const replaceBody = (title, body) => {
    const pattern = sectionRegex(title);
    if (!pattern.test(value)) throw new Error(`mutation section not found: ${title}`);
    value = value.replace(pattern, (_match, heading) => heading + body + "\n\n");
  };
  if (mutation.op === "removeSection") {
    value = value.replace(sectionRegex(mutation.title), "");
    appendMutationText();
  } else if (mutation.op === "swapSections") {
    const firstPattern = sectionRegex(mutation.first);
    const secondPattern = sectionRegex(mutation.second);
    const first = value.match(firstPattern)?.[0];
    const second = value.match(secondPattern)?.[0];
    if (!first || !second) throw new Error("swap mutation section not found");
    const firstToken = "__REPORT_SWAP_FIRST__";
    const secondToken = "__REPORT_SWAP_SECOND__";
    value = value.replace(first, firstToken).replace(second, secondToken).replace(firstToken, second).replace(secondToken, first);
    appendMutationText();
  } else if (mutation.op === "duplicateSection") {
    const block = value.match(sectionRegex(mutation.title))?.[0];
    if (!block) throw new Error("duplicate mutation section not found");
    value = value.replace(block, `${block}\n${block}`);
    appendMutationText();
  } else if (mutation.op === "insertBeforeSection") {
    if (mutation.removeTitle) {
      const removePattern = sectionRegex(mutation.removeTitle);
      if (!removePattern.test(value)) throw new Error(`removal section not found: ${mutation.removeTitle}`);
      value = value.replace(removePattern, "");
    }
    const pattern = sectionRegex(mutation.title);
    if (!pattern.test(value)) throw new Error(`insertion section not found: ${mutation.title}`);
    value = value.replace(pattern, (match) => (mutation.text || "") + match);
    appendMutationText();
  } else if (mutation.op === "appendText") {
    value += mutation.text || "";
    appendMutationText();
  } else if (mutation.op === "emptySection") {
    replaceBody(mutation.title, "");
    appendMutationText();
  } else if (mutation.op === "replaceBody") {
    replaceBody(mutation.title, mutation.body || "");
    appendMutationText();
  } else {
    throw new Error(`unknown report mutation: ${mutation.op}`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashBuffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFile(file) {
  return hashBuffer(fs.readFileSync(file));
}

function runNode(script, args, options) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", ...options });
}

async function runSchemaSourceMutation(source, kind, tempRoot, contract) {
  const nl = String.fromCharCode(10);
  let mutated = source;
  if (kind === "drop-last-section") {
    const marker = nl + "  Object.freeze({" + nl + "    ordinal: 11";
    const from = mutated.indexOf(marker);
    const to = from < 0 ? -1 : mutated.indexOf(nl + "  })" + nl + "]);", from);
    if (from < 0 || to < 0) throw new Error("schema drop mutation marker missing");
    mutated = mutated.slice(0, from) + nl + "]);" + mutated.slice(to + (nl + "  })" + nl + "]);").length);
  } else if (kind === "swap-2-3") {
    mutated = mutated.replace('title: "分析与路线决策"', 'title: "__SCHEMA_SWAP_A__"').replace('title: "实现路径"', 'title: "分析与路线决策"').replace('title: "__SCHEMA_SWAP_A__"', 'title: "实现路径"');
  } else if (kind === "duplicate-4") {
    mutated = mutated.replace('title: "任务坑点"', 'title: "任务难点"');
  } else {
    throw new Error("unknown schema mutation: " + kind);
  }
  const file = path.join(tempRoot, "schema-" + kind + ".mjs");
  fs.writeFileSync(file, mutated, "utf8");
  const module = await import(pathToFileURL(file).href + "?mutation=" + encodeURIComponent(kind));
  return checkProductionContract(module.REPORT_SECTIONS, module.REPORT_SCHEMA_VERSION, contract);
}

function runPurityMutationTests(source) {
  const mutations = [
    ["static import", 'import "./evil-side-effect.mjs";'],
    ["dynamic import", 'import("./evil-side-effect.mjs");'],
    ["require call", 'require("./evil-side-effect.mjs");'],
    ["node builtin", 'import fs from "node:fs";'],
    ["process access", 'process.exit(0);'],
    ["Buffer access", 'Buffer.from("x");'],
    ["clock access", 'Date.now();']
  ];
  for (const [label, snippet] of mutations) {
    const check = checkSchemaPurity(source + "\n" + snippet);
    assert(!check.ok && check.code === "contract-mismatch", "purity mutation was accepted: " + label);
  }
}

async function runMutationTests(fixtures, tempRoot, contract, productionModule) {
  const schemaSource = readText(productionSchemaPath);
  const schemaMutations = [["drop-last-section", "contract-mismatch"], ["swap-2-3", "contract-mismatch"], ["duplicate-4", "contract-mismatch"]];
  for (const [kind, expectedCode] of schemaMutations) {
    const resultValue = await runSchemaSourceMutation(schemaSource, kind, tempRoot, contract);
    assert(!resultValue.ok && resultValue.code === expectedCode, "schema mutation " + kind + " did not return " + expectedCode);
  }
  const report = fixtures.baseReports.all_applicable;
  const reportCases = [[{ op: "swapSections", first: "分析与路线决策", second: "实现路径" }, "order"], [{ op: "duplicateSection", title: "关键曲折与试错记录" }, "duplicate-section"]];
  for (const [mutation, expectedCode] of reportCases) {
    const resultValue = validateReportText(applyReportMutation(report, mutation), contract.sections, contract);
    assert(!resultValue.ok && resultValue.code === expectedCode, "report mutation did not return " + expectedCode);
  }
  const multiline = fixtures.baseReports.multiline;
  const replaced = applyReportMutation(multiline, { op: "replaceBody", title: "任务概览", body: "新的唯一证据" });
  assert(!replaced.includes("第二行证据"), "sectionRegex did not replace a multiline body through EOF");
  assert(validateReportText(replaced, contract.sections, contract).ok, "multiline replacement report failed");
  const doc = readText(outputContractPath);
  const mutatedDoc = doc.replace("成果及使用示例", "旧成果与复现");
  const generatedResult = checkGeneratedBlock(mutatedDoc, productionModule.renderReportSectionsBlock());
  assert(!generatedResult.ok && generatedResult.code === "generated-doc-drift", "generated block mutation not caught");
}

async function runTaskInitChecks(tempRoot, fixtures, contract) {
  const workspace = path.join(tempRoot, "task-workspace");
  fs.mkdirSync(workspace, { recursive: true });
  const env = { ...process.env, TEMP: tempRoot, TMP: tempRoot };
  const run = (args, cwd = workspace) => runNode(taskInitPath, args, { cwd, env });
  const first = run(["schema-smoke"]);
  assert(first.status === 0, `task-init new task exit=${first.status}`);
  const taskDir = path.join(workspace, "artifacts", "tasks", "schema-smoke");
  const reportPath = path.join(taskDir, "report.md");
  assert(fs.existsSync(reportPath), "task-init did not create report.md");
  assert(fs.readdirSync(taskDir).sort().join(",") === "AUTHORIZATION.md,report.md", "task-init created unexpected task templates");
  const skeletonTitles = parseReportSections(fs.readFileSync(reportPath, "utf8")).map((section) => section.title);
  const expectedTitles = contract.sections.map((section) => section.title);
  assert(skeletonTitles.length === expectedTitles.length && skeletonTitles.every((title, index) => title === expectedTitles[index]), "task-init report skeleton title/order mismatch: " + JSON.stringify(skeletonTitles));
  const firstHash = hashFile(reportPath);
  const authPath = path.join(taskDir, "AUTHORIZATION.md");
  assert(fs.existsSync(authPath), "task-init did not create AUTHORIZATION.md");
  const firstAuthHash = hashFile(authPath);
  const second = run(["schema-smoke"]);
  assert(second.status === 0 && hashFile(reportPath) === firstHash, "task-init hash idempotency failed");
  assert(hashFile(authPath) === firstAuthHash, "task-init AUTHORIZATION idempotency failed");
  const noId = run([]);
  assert(noId.status === 1, `task-init missing id exit=${noId.status}`);
  const invalidId = run(["../escape"]);
  assert(invalidId.status === 1, `task-init invalid id exit=${invalidId.status}`);
  for (const alias of ["NUL", "CON", "COM1", "LPT1", "NUL.txt", "CON.log", "COM1.md"]) {
    const aliasRun = run([alias]);
    assert(aliasRun.status === 1, `task-init device alias ${alias} exit=${aliasRun.status}`);
  }
  const pathFailWorkspace = path.join(tempRoot, "path-fail");
  fs.mkdirSync(pathFailWorkspace, { recursive: true });
  fs.writeFileSync(path.join(pathFailWorkspace, "artifacts"), "block mkdir", "utf8");
  const pathFail = run(["path-fail"], pathFailWorkspace);
  assert(pathFail.status === 2, `task-init path failure exit=${pathFail.status}`);
  const packageRoot = run(["schema-smoke"], repoRoot);
  assert(packageRoot.status === 3, `task-init skill-root guard exit=${packageRoot.status}`);
  const oldDir = path.join(workspace, "artifacts", "tasks", "old-six");
  fs.mkdirSync(oldDir, { recursive: true });
  const oldReport = path.join(oldDir, "report.md");
  const legacy = fixtures.baseReports.legacy_six;
  fs.writeFileSync(oldReport, legacy, "utf8");
  const oldHash = hashFile(oldReport);
  const oldRun = run(["old-six"]);
  assert(oldRun.status === 0 && hashFile(oldReport) === oldHash, "task-init overwrote legacy report");
  return {
    newTask: first.status,
    missingId: noId.status,
    invalidId: invalidId.status,
    pathFailure: pathFail.status,
    skillRootGuard: packageRoot.status,
    idempotent: true,
    legacyPreserved: true
  };
}

function applyCaseTransform(report, transform) {
  if (transform !== "atx-closing-sequence") return report;
  const nl = String.fromCharCode(10);
  return report.split(nl).map((line) => line.startsWith("## ") ? line + " ##" : line).join(nl);
}

export async function runSelfTest() {
  const productionModule = await loadProductionSchema();
  const fixtures = readJson(casesPath);
  const contract = readContract();
  const trust = checkSourcePlanTrust(contract);
  assert(trust.ok, "independent contract source plan hash is not trusted");
  const shape = checkContractShape(contract);
  assert(shape.ok, "independent contract shape is invalid");
  const contractCheck = checkProductionContract(productionModule.REPORT_SECTIONS, productionModule.REPORT_SCHEMA_VERSION, contract, productionModule);
  assert(contractCheck.ok, "production contract does not match frozen fixture");
  const wrongRenderer = {
    ...productionModule,
    renderReportSkeleton: () => "# 伪报告\\n\\n" + Array.from({ length: 11 }, () => "## 伪标题").join("\\n")
  };
  const wrongRendererCheck = checkProductionContract(productionModule.REPORT_SECTIONS, productionModule.REPORT_SCHEMA_VERSION, contract, wrongRenderer);
  assert(!wrongRendererCheck.ok && wrongRendererCheck.code === "contract-mismatch", "wrong renderer mutation was accepted");
  runPurityMutationTests(readText(productionSchemaPath));
  const changedNA = productionModule.REPORT_SECTIONS.map((section, index) => index === 3 ? { ...section, na: "不存在：" } : section);
  const changedNACheck = checkProductionContract(changedNA, productionModule.REPORT_SCHEMA_VERSION, contract);
  assert(!changedNACheck.ok && changedNACheck.code === "contract-mismatch", "production .na drift did not return contract-mismatch");
  for (const item of fixtures.cases.filter((entry) => entry.kind === "renderer-mutation")) {
    const wrong = { ...productionModule, renderReportSkeleton: () => "# 伪报告\\n\\n" + Array.from({ length: 11 }, () => "## 伪标题").join("\\n") };
    const check = checkProductionContract(productionModule.REPORT_SECTIONS, productionModule.REPORT_SCHEMA_VERSION, contract, wrong);
    assert(!check.ok && check.code === item.expectedCode, item.id + " returned " + check.code);
  }
  for (const item of fixtures.cases.filter((entry) => entry.kind === "purity-mutation")) {
    const check = checkSchemaPurity(readText(productionSchemaPath) + "\n" + item.snippet);
    assert(!check.ok && check.code === item.expectedCode, item.id + " returned " + check.code);
  }
  for (const item of fixtures.cases.filter((entry) => entry.kind === "valid")) {
    const report = item.mutation
      ? applyReportMutation(fixtures.baseReports[item.baseReport], item.mutation)
      : applyCaseTransform(fixtures.baseReports[item.baseReport], item.transform);
    const check = validateReportText(report, contract.sections, contract);
    assert(check.ok, "valid fixture failed: " + item.id + " " + (check.code || ""));
  }
  for (const item of fixtures.cases.filter((entry) => entry.kind === "negative")) {
    if (item.id === "stale_generated_block") {
      const check = checkGeneratedBlock(readText(outputContractPath).replace("成果及使用示例", "旧成果"), productionModule.renderReportSectionsBlock());
      assert(!check.ok && check.code === item.expectedCode, item.id + " returned " + check.code);
      continue;
    }
    if (item.id === "schema_title_changed") {
      const changed = productionModule.REPORT_SECTIONS.map((section, index) => index === 0 ? { ...section, title: "旧标题" } : section);
      const check = checkProductionContract(changed, productionModule.REPORT_SCHEMA_VERSION, contract);
      assert(!check.ok && check.code === item.expectedCode, item.id + " returned " + check.code);
      continue;
    }
    if (item.id === "stale_normative_reference") {
      const check = scanStaleReferences("fixture.md", "旧口径：交付物与复现");
      assert(check === "stale-report-reference:fixture.md:1", item.id + " returned " + check);
      continue;
    }
    const report = item.raw !== undefined ? item.raw : item.mutation ? applyReportMutation(fixtures.baseReports[item.baseReport], item.mutation) : fixtures.baseReports[item.baseReport];
    const check = validateReportText(report, contract.sections, contract);
    assert(!check.ok && check.code === item.expectedCode, item.id + " returned " + check.code);
  }
  const tempRoot = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), "report-schema-self-test-"));
  try {
    await runMutationTests(fixtures, tempRoot, contract, productionModule);
    return { ...(await runTaskInitChecks(tempRoot, fixtures, contract)), rendererOracle: true };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function printFailure(code, details = []) {
  const suffix = details.length > 0 ? ` additional=${details.join(" | ")}` : "";
  console.log(`REPORT_SCHEMA_ERROR=${code}${suffix}`);
}

async function main() {
  try {
    // Keep this as the first runtime action in the checker.  loadProductionSchema
    // repeats the guard for direct callers, but main must never import before it.
    const purity = checkSchemaPurity();
    if (!purity.ok) {
      printFailure(purity.code, purity.details);
      process.exitCode = 1;
      return;
    }
    const productionModule = await loadProductionSchema();
    const contract = readContract();
    const findings = collectStaticFindings(productionModule, contract);
    if (findings.length > 0) {
      const first = findings[0];
      printFailure(first.code, first.details);
      process.exitCode = 1;
      return;
    }
    const trust = checkSourcePlanTrust(contract);
    if (trust.code === "source-plan-skip") console.log("[report-schema] sourcePlan=SKIP (maintenance evidence absent)");
    if (process.argv.includes("--self-test")) {
      const taskResult = await runSelfTest();
      console.log("[report-schema] OK self-test task=" + JSON.stringify(taskResult));
      return;
    }
    console.log("[report-schema] OK version=" + productionModule.REPORT_SCHEMA_VERSION + " sections=" + productionModule.REPORT_SECTIONS.length);
  } catch (error) {
    printFailure("E_INTERNAL");
    console.error("[report-schema] " + (error?.stack || error));
    process.exitCode = 2;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();

export { readContract, loadProductionSchema, main };
