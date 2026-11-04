import os from "node:os";

const tierRank = {
  fast: 0,
  full: 1
};

export const checkManifest = [
  { name: "check-utf8.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-naming.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-report-schema.mjs", tier: "fast", estimatedMs: 180 },
  { name: "check-prompt-coverage.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-operating-contracts.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-skill-contract.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-algo-selfcheck.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-authorization-banners.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-evals.mjs", tier: "fast", estimatedMs: 100 }
];

export const supportedCheckGroups = ["fast", "full", "all"];

export function normalizeCheckGroup(group = "all") {
  const normalized = String(group || "all").trim().toLowerCase();
  return supportedCheckGroups.includes(normalized) ? normalized : null;
}

export function getChecksForGroup(group = "all") {
  const normalized = normalizeCheckGroup(group);
  if (!normalized) {
    throw new Error(`unknown check group: ${group}`);
  }

  const maxRank = normalized === "fast" ? tierRank.fast : tierRank.full;

  return checkManifest.filter((item) => tierRank[item.tier] <= maxRank);
}

export function defaultJobsForGroup(group = "all") {
  const normalized = normalizeCheckGroup(group) || "all";
  const available = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : 4;
  const reserve = available > 2 ? 1 : 0;
  const suggested = Math.max(1, available - reserve);
  const cap = 4;
  return Math.max(1, Math.min(cap, suggested));
}
