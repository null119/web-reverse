#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReportSectionsBlock } from "../report-schema.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = path.join(repoRoot, "docs", "reference", "output-contract.md");
const beginMarker = "<!-- BEGIN GENERATED: report-sections -->";
const endMarker = "<!-- END GENERATED: report-sections -->";

function syncReportSchema() {
  const original = fs.readFileSync(target, "utf8");
  const beginCount = original.split(beginMarker).length - 1;
  const endCount = original.split(endMarker).length - 1;
  if (beginCount !== 1 || endCount !== 1) {
    throw new Error(`generated markers must occur exactly once (begin=${beginCount}, end=${endCount})`);
  }
  const begin = original.indexOf(beginMarker);
  const end = original.indexOf(endMarker);
  if (end <= begin) throw new Error("generated markers are out of order");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const generated = renderReportSectionsBlock().replaceAll("\n", newline);
  const next = `${original.slice(0, begin)}${beginMarker}${newline}${generated}${newline}${endMarker}${original.slice(end + endMarker.length)}`;
  if (next !== original) fs.writeFileSync(target, next, "utf8");
  return { changed: next !== original, path: target };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const result = syncReportSchema();
    console.log(`[sync-report-schema] ${result.changed ? "updated" : "unchanged"} ${result.path}`);
  } catch (error) {
    console.error(`[sync-report-schema] ${error?.message || error}`);
    process.exitCode = 1;
  }
}

export { syncReportSchema };
