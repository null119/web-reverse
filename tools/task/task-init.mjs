#!/usr/bin/env node
// task-init —— 唯一开机入口（report-only 契约版）。
//
//   node <TOOL_DIR>/task-init.mjs <task-id> [--allow-skill-dir]
//
// 只做四件事（幂等）：
//   1. 建任务目录 cwd/artifacts/tasks/<task-id>/（已存在则不动任何文件 = 续跑锚定）
//   2. 任务目录内无 report.md 时写入 report.md 报告骨架（必填小节见骨架内注释）
//   3. 打印产物写入锚点
//   4. 任务目录内无 AUTHORIZATION.md 时写入授权登记骨架（红线 3）
//
// 过程零强制记录：不再生成 task.json / state / clues / narrative / 账本 / run 模板，
// 不再串 init→sync→advance。任务完成（或明确终止）时，由执行者把全面总结
// 直接写进 report.md——这是唯一的过程文档义务。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReportSkeleton } from "../report-schema.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

function isSkillPackageDir() {
  // 两条判据任一命中即视为 skill 包目录：
  //   a. cwd 自身具备 skill 根布局（SKILL.md + tools/task/task-init.mjs）——覆盖源仓库与安装副本
  //   b. 从 toolDir 向上能找到本框架的 package.json 且 cwd 即其根
  const hasSkillLayout =
    fs.existsSync(path.join(cwd, "SKILL.md")) &&
    fs.existsSync(path.join(cwd, "tools", "task", "task-init.mjs"));
  if (hasSkillLayout) {
    return true;
  }
  let dir = toolDir;
  for (let i = 0; i < 4; i += 1) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg?.name === "web-reverse-skill-framework") {
          return path.resolve(cwd) === path.resolve(dir);
        }
      } catch {
        // ignore malformed package.json
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

// task-id 即目录名：禁止路径穿越、分隔符和 Windows device alias。
function isWindowsDeviceSegment(value) {
  const normalized = String(value).replace(/[ .]+$/u, "").toUpperCase();
  return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/u.test(normalized);
}

function isValidTaskId(taskId) {
  return /^[A-Za-z0-9_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5.-]*$/.test(taskId)
    && !taskId.includes("..")
    && !taskId.endsWith(".")
    && !isWindowsDeviceSegment(taskId);
}

function makeReportSkeleton(taskId) {
  return renderReportSkeleton(taskId, new Date().toISOString());
}

// 红线 3 授权登记骨架（长期授权档案：勾选后保留，收尾无需删除）
const AUTHORIZATION_SKELETON = [
  "<!-- 骨架生成于 task-init；本文件是任务授权档案：勾选后长期保留，收尾时无需删除 -->",
  "# 任务授权登记（红线 3：开工先填，四选一）",
  "",
  "- 任务属性（四选一，把对应 [ ] 改为 [x]）：",
  "  [ ] ① 自有资产（本方拥有/运营的站点、小程序、接口）",
  "  [ ] ② 书面授权的安全评估",
  "  [ ] ③ CTF / 公开靶场 / 自建环境",
  "  [ ] ④ 公开合规研究（仅本地分析，不向真实业务端点提交请求）",
  "- 授权方（②必填）：",
  "- 授权范围（域名 / 包名 / 接口白名单，①②③必填，逗号分隔）：",
  "- 授权期限：",
  "- 证据（合同 / 邮件 / 授权函编号或链接）：",
  "- 登记时间（勾选时填写）：",
  "",
  "> 无法归类时先向用户索要授权依据，索要不到即终止任务。",
  "> 永拒类别（无论授权与否）：代抢代拍刷量、验证码代打、未授权批量爬取、",
  "> DRM 解密产物对外分发/传播/批量提取存储、账号盗用辅助、",
  "> 以欺诈或牟利为目的的支付/风控绕过、改包客户端对外分发。",
  ""
].join("\n");

function main() {
  const args = process.argv.slice(2);
  const allowSkillDir = args.includes("--allow-skill-dir");
  const taskId = args.find((item) => !item.startsWith("--"));

  if (isSkillPackageDir() && !allowSkillDir) {
    console.error("[task-init] 当前工作目录是 SKILL 包目录。默认不在此创建任务，以免把交付物写进 SKILL 包。");
    console.error("[task-init] 请切换到你的项目目录后重试；若确实要在包目录内自测，追加 --allow-skill-dir。");
    process.exit(3);
  }
  if (!taskId) {
    console.error("usage: node <TOOL_DIR>/task-init.mjs <task-id> [--allow-skill-dir]");
    process.exit(1);
  }
  if (!isValidTaskId(taskId)) {
    console.error(`[task-init] 非法 task-id "${taskId}"：只允许字母/数字/中文/._-，且不得包含路径分隔符或 ".."。`);
    process.exit(1);
  }

  try {
    fs.writeFileSync(path.join(cwd, ".web-reverse-tool-dir"), `${path.resolve(toolDir)}\n`);
  } catch {
    // 元数据写入失败不阻断开机
  }

  const taskDir = path.join(cwd, "artifacts", "tasks", taskId);
  const isResume = fs.existsSync(path.join(taskDir, "report.md"));
  if (!isResume) {
    try {
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(path.join(taskDir, "report.md"), makeReportSkeleton(taskId));
    } catch (error) {
      console.error(`[task-init] 任务目录初始化失败：${taskDir}`);
      console.error(`[task-init] ${error?.message || error}`);
      process.exit(2);
    }
  }

  const authPath = path.join(taskDir, "AUTHORIZATION.md");
  if (!fs.existsSync(authPath)) {
    try {
      fs.writeFileSync(authPath, AUTHORIZATION_SKELETON);
    } catch (error) {
      console.error(`[task-init] AUTHORIZATION.md 写入失败（不阻断）：${error?.message || error}`);
    }
  }

  const displayDir = taskDir.replaceAll("\\", "/");
  const displayReport = path.join(taskDir, "report.md").replaceAll("\\", "/");
  console.log(`[task-init] mode=${isResume ? "resume" : "new-task"} taskId=${taskId}`);
  console.log(`[task-init] ready 任务目录=${displayDir}`);
  console.log(`[task-init] 产物写入锚点：`);
  console.log(`[task-init]   所有脚本/样本/中间数据 → ${displayDir}（不要写进 cwd 根）`);
  console.log(`[task-init]   任务报告（收尾填写）    → ${displayReport}`);
  console.log(`[task-init]   授权登记（开工先勾选，四选一）→ ${path.join(displayDir, "AUTHORIZATION.md").replaceAll("\\", "/")}`);
  console.log("[task-init] 未勾选任务属性前不得进入服务端验收（红线 3：属性 ④/未勾选 = 只做本地算法自检）。");
  console.log("[task-init] 过程无需任何记录；收尾 report.md 全面总结 + 可运行示例 = 交付。");
}

main();
