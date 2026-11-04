// 授权前提（SKILL.md 红线 3）：仅限自有资产/书面授权评估/CTF 自建靶场使用；
// 开工先在 AUTHORIZATION.md 勾选任务属性；未授权目标禁止服务端验收。
//
// verify-once.template.mjs — 服务端验收（Node 编排路线）模板。
// 用法：复制本文件到任务目录 run/ 下改名 verify-once.mjs，按目标站点填三个 TODO
// （buildContext / buildRequest / isAccepted），然后：
//   node verify-once.mjs --impl run/impl-xxx.mjs
// 闸门次序与 scripts/verify/verify-offline.py 逐行对齐：
//   loadImpl → 属性闸门（先于 buildContext，仓库态可冒烟）
//   → 循环{ buildContext → 域闸门 → generate → buildRequest → isAccepted → audit }
// 边界（与政策文档一致）：本闸门仅约束验收编排层；任务期自写脚本、任意其它文件名、
// 直接 curl/浏览器发请求、impl.generate() 自身网络副作用均不在拦截范围。

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CLASS_MARKS = [["①", 1], ["②", 2], ["③", 3], ["④", 4]];
// ⚠ 骨架四行顺序①②③④不得调换；多勾 fail-closed（勾选数≠1 视为登记无效）。

// ----- 红线 3 授权闸门（与 verify-offline.py 同款语义） -----

function findAuthorization(startDir) {
  // 从 startDir（--impl 所在目录）向上最多 4 级探测 AUTHORIZATION.md，返回绝对路径或 null
  let cur = path.resolve(startDir || ".");
  for (let i = 0; i < 4; i += 1) {
    const cand = path.join(cur, "AUTHORIZATION.md");
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function loadAuthorization(authPath) {
  const text = fs.readFileSync(authPath, "utf8");
  // hits = CLASS_MARKS 中匹配 /\[x\]\s*<mark>/ 的编号数组；
  // len(hits) === 1 → klass = hits[0]；否则 klass = null（零勾/多勾均无效，fail-closed）
  const hits = CLASS_MARKS
    .filter(([mark]) => new RegExp("\\[x\\]\\s*" + mark).test(text))
    .map(([, num]) => num);
  const klass = hits.length === 1 ? hits[0] : null;
  // 授权范围行解析：/[，,;；\s]+/ 切分、跳过 < 开头占位（与 Python 版同款）
  const hosts = [];
  const scope = text.match(/授权范围[^\n:：]*[：:]\s*([^\n]+)/);
  if (scope) {
    for (const token of scope[1].trim().split(/[，,;；\s]+/)) {
      if (token && !token.startsWith("<")) hosts.push(token);
    }
  }
  return { klass, hosts };
}

function gateClass(klass) {
  if (![1, 2, 3].includes(klass)) {
    console.error(
      `[verify] 服务端验收被红线 3 拦截：AUTHORIZATION.md 任务属性 klass=${klass}` +
        `（须勾选 ①/②/③，且只允许四选一勾选）。仅可执行算法自检（verify-algo.py）。`
    );
    process.exit(4);
  }
}

function gateHost(allowedHosts, targetHost) {
  const hit = allowedHosts.some((h) => targetHost === h || targetHost.endsWith("." + h));
  if (!hit) {
    console.error(
      `[verify] 服务端验收被红线 3 拦截：目标域 '${targetHost}' 不在授权范围 ` +
        `[${allowedHosts.join(", ")}]。仅可执行算法自检（verify-algo.py）。`
    );
    process.exit(4);
  }
}

function auditServerVerify(authPath, host, klass, scopeSource, roundNo, total) {
  // 与 Python 版同格式（audit.log 追加留痕）；写失败仅 warn 不阻断
  const mark = "①②③"[klass - 1];
  const line =
    `${new Date().toISOString().replace(/\.\d+Z$/, "Z")} server-verify ` +
    `host=${host} round=${roundNo}/${total} auth=${mark} scope_source=${scopeSource}\n`;
  try {
    fs.appendFileSync(path.join(path.dirname(authPath), "audit.log"), line, "utf8");
  } catch {
    console.warn("[verify] warn: audit.log 留痕失败（不阻断）。");
  }
}

async function loadImpl(implPath) {
  const mod = await import(pathToFileURL(path.resolve(implPath)).href);
  if (typeof mod.generate !== "function") {
    console.error(`[verify] ${implPath} 必须暴露 generate(ctx, pinned=null) -> dict`);
    process.exit(2);
  }
  return mod;
}

// ===== 按目标站点填写的三个 TODO =====
function buildContext() { throw new Error("TODO: 按目标站点实现 buildContext（至少返回 { url, ... }）"); }
function buildRequest(ctx, sign) { throw new Error("TODO: 按目标站点实现 buildRequest"); }
function isAccepted(resp) { throw new Error("TODO: 按目标站点实现 isAccepted（业务成功判据，非 2xx 即真）"); }

// ====================================================================

function parseArgs(argv) {
  const args = { impl: null, rounds: 5, intervalMs: 3000, authorization: null, authorizedScope: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--impl") args.impl = argv[++i];
    else if (arg === "--rounds") args.rounds = Number(argv[++i]);
    else if (arg === "--interval-ms") args.intervalMs = Number(argv[++i]);
    else if (arg === "--authorization") args.authorization = argv[++i];
    else if (arg === "--authorized-scope") args.authorizedScope = argv[++i];
    else {
      console.error(`[verify] 未知参数：${arg}`);
      process.exit(2);
    }
  }
  if (!args.impl) {
    console.error("[verify] 缺少 --impl（本地实现文件，暴露 generate(ctx, pinned=null)->dict）");
    process.exit(2);
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const impl = await loadImpl(args.impl);

  // 红线 3 闸门之一：授权文件存在 + 属性已勾选 ①②③（先于 buildContext，仓库态可冒烟）
  const authPath =
    args.authorization || findAuthorization(path.dirname(path.resolve(args.impl)));
  if (!authPath || !fs.existsSync(authPath)) {
    console.error(
      "[verify] 服务端验收被红线 3 拦截：未找到 AUTHORIZATION.md" +
        "（基于 --impl 目录向上探测；可用 --authorization 指定）。" +
        "先完成授权登记，或仅执行算法自检（verify-algo.py）。"
    );
    process.exit(4);
  }
  const { klass, hosts } = loadAuthorization(authPath);
  if (args.authorizedScope) {
    for (const h of args.authorizedScope.trim().split(/[,，\s]+/)) {
      if (h) hosts.push(h);
    }
  }
  const scopeSource = "file" + (args.authorizedScope ? "+arg" : "");
  gateClass(klass);

  let ok = 0;
  for (let i = 0; i < args.rounds; i += 1) {
    const ctx = buildContext();
    // 红线 3 闸门之二：目标域必须在授权范围内（先于 generate/buildRequest，不发请求即拦）
    const hostNow = new URL(String(ctx.url)).hostname;
    gateHost(hosts, hostNow);
    const sign = impl.generate(ctx); // 本地实现：每轮随机照常参与
    const resp = buildRequest(ctx, sign);
    const accepted = isAccepted(resp);
    if (accepted) ok += 1;
    auditServerVerify(authPath, hostNow, klass, scopeSource, i + 1, args.rounds);
    console.log(`[round ${i + 1}/${args.rounds}] accepted=${accepted}`);
    if (i + 1 < args.rounds && args.intervalMs > 0) await sleep(args.intervalMs);
  }

  const rate = ok / args.rounds;
  console.log(`\n[verify] 通过率 ${ok}/${args.rounds} = ${(rate * 100).toFixed(0)}%`);
  if (rate < 1) {
    console.error("[verify] 未全部通过 → 实现或输入仍有问题，回实现与输入逐项排查。");
    process.exit(1);
  }
  if (args.rounds === 1) {
    console.log("[verify] OK 单发通过（单样本，不构成稳定验收；稳定验收需 --rounds ≥ 3）。");
  } else {
    console.log("[verify] OK 验收通过：本地实现生成的参数被服务器稳定接受。");
  }
}

main().catch((err) => {
  console.error(`[verify] ${err && err.message ? err.message : err}`);
  process.exit(1);
});
