# Tool Defaults

- 一次只做一个最小变更决策
- 默认连续两轮无进展必须回退；已开启深挖 permit 的高成本微路线，改按 `maxRounds + exitCondition + highValueEvidence` 决定是否继续
- 重要动作必须写 task artifact
- 浏览器 profile 默认写临时目录，不默认沉到 task-local
- 会话与响应样本默认先做最小化 / redact，再决定是否保留原文
