import { failWith, readText } from "./common.mjs";

const findings = [];

try {
  const checker = await import("./check-report-schema.mjs");
  const purity = checker.checkSchemaPurity();
  if (!purity.ok) {
    findings.push("report schema purity: " + purity.code);
  } else {
    const schema = await checker.loadProductionSchema();
    const production = checker.checkProductionContract(schema.REPORT_SECTIONS, schema.REPORT_SCHEMA_VERSION, checker.readContract(), schema);
    if (!production.ok) findings.push("report production contract: " + production.code);
    if (production.ok) {
      const generated = checker.checkGeneratedBlock(readText("docs/reference/output-contract.md"), schema.renderReportSectionsBlock());
      if (!generated.ok) findings.push("report generated block: " + generated.code);
    }
    for (const finding of checker.collectStaticFindings(schema)) findings.push("report schema dependency: " + finding.code);
  }

  const outputContract = readText("docs/reference/output-contract.md");
  for (const needle of ["固定 11 节合同", "reportSchemaVersion", "具体 N/A", "会话标识、凭据与存储快照必须脱敏", "收尾时删除骨架注释与提示行"]) {
    if (!outputContract.includes(needle)) findings.push("output-contract missing required text: " + needle);
  }
  for (const forbidden of ["state/external-research", "task-close.mjs", "assert-can-reply"]) {
    if (outputContract.includes(forbidden)) findings.push("output-contract still contains forbidden text: " + forbidden);
  }

  const bootstrap = readText("docs/reference/reverse-bootstrap.md");
  for (const needle of ["task-init.mjs", "骨架生成于"]) {
    if (!bootstrap.includes(needle)) findings.push("reverse-bootstrap missing required anchor: " + needle);
  }
  for (const forbidden of ["task-boot", "task-sync", "task-advance"]) {
    if (bootstrap.includes(forbidden)) findings.push("reverse-bootstrap still references retired machinery: " + forbidden);
  }
  failWith(findings, "check-operating-contracts");
} catch (error) {
  console.error("[check-operating-contracts] " + (error?.stack || error));
  process.exitCode = 2;
}
