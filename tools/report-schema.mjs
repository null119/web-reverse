// Fixed report contract. This module is deliberately pure: no fs, process, clock,
// Markdown parsing, or task/QA imports live here.
export const REPORT_SCHEMA_VERSION = 2;

export const REPORT_SECTIONS = Object.freeze([
  Object.freeze({
    ordinal: 1,
    title: "任务概览",
    hint: "用户目标、实际结果/偏差与最近验证状态。",
    minimum: "用户目标 + 实际结果/偏差 + 最近验证状态。",
    na: null
  }),
  Object.freeze({
    ordinal: 2,
    title: "分析与路线决策",
    hint: "路线选择、理由与被放弃的替代路线。",
    minimum: "选中路线 + 理由 + 至少一个替代方案或无替代的依据。",
    na: null
  }),
  Object.freeze({
    ordinal: 3,
    title: "实现路径",
    hint: "从输入到产物的可重放步骤，回指文件、函数、端点或命令。",
    minimum: "1～5 个有序步骤，每步回指关键证据。",
    na: null
  }),
  Object.freeze({
    ordinal: 4,
    title: "任务难点",
    hint: "仍未解决的边界及其对验收的影响。",
    minimum: "未解决边界及影响，或当前无未解决难点的验证依据。",
    na: "当前无未解决难点：<依据>"
  }),
  Object.freeze({
    ordinal: 5,
    title: "任务坑点",
    hint: "具体误导/错误、纠正方式与防复发办法。",
    minimum: "症状/误导 → 纠正 → 防复发，或未遇到影响结果坑点的检查范围。",
    na: "未遇到影响结果的坑点：<检查范围/依据>"
  }),
  Object.freeze({
    ordinal: 6,
    title: "外部约束与检查记录",
    hint: "环境或依赖约束、证据与明确检查范围。",
    minimum: "约束及证据，或已检查的范围。",
    na: "未命中：<已检查信号/范围>"
  }),
  Object.freeze({
    ordinal: 7,
    title: "关键曲折与试错记录",
    hint: "被证伪的假设、转折、pivot，或一次收敛的依据。",
    minimum: "一个证伪/pivot/转折，或一次收敛的具体依据。",
    na: "一次收敛：<依据>"
  }),
  Object.freeze({
    ordinal: 8,
    title: "核心逻辑与实现方案",
    hint: "交付物的实际机制、逻辑边界、输入输出与验证层级。",
    minimum: "机制或逻辑边界、输入输出、fixture/验证层级。",
    na: null
  }),
  Object.freeze({
    ordinal: 9,
    title: "资产沉淀与方法论升级",
    hint: "可跨任务复用的规则、工具、检查表或 eval 改进及边界。",
    minimum: "一条可跨任务复用的规则/工具/检查表/eval 改进及适用边界。",
    na: "本任务无跨任务新增：<依据>"
  }),
  Object.freeze({
    ordinal: 10,
    title: "成果及使用示例",
    hint: "真实产物路径、可执行命令与最小输入/输出或实测结果。",
    minimum: "真实产物路径 + 可执行命令 + 最小输入/输出或实测结果。",
    na: null
  }),
  Object.freeze({
    ordinal: 11,
    title: "其它",
    hint: "限制、清理、未纳入范围或后续建议。",
    minimum: "至少写限制、清理、未纳入范围、后续建议之一；无则写“无”。",
    na: "无"
  })
]);

export const REPORT_TITLES = Object.freeze(REPORT_SECTIONS.map((section) => section.title));

export function renderReportSkeleton(taskId, generatedAt = "") {
  const stamp = generatedAt ? ` ${generatedAt}` : "";
  const lines = [
    `# 任务报告：${taskId}`,
    "",
    `<!-- 骨架生成于${stamp}。收尾时填充全部固定小节并删除本注释与提示行；内容必须来自真实做过的事。 -->`,
    ""
  ];
  for (const section of REPORT_SECTIONS) {
    lines.push(`## ${section.title}`);
    lines.push(`<!-- ${section.hint} -->`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderReportSectionsBlock() {
  const lines = [
    `reportSchemaVersion: ${REPORT_SCHEMA_VERSION}`,
    "",
    ...REPORT_SECTIONS.map((section) => `${section.ordinal}. **${section.title}** — ${section.minimum}`)
  ];
  return lines.join("\n");
}

export function reportSectionByTitle(title) {
  return REPORT_SECTIONS.find((section) => section.title === title) || null;
}
