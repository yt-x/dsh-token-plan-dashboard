# CONTEXT

## 词条

| 术语 | 含义 | 证据来源 |
|---|---|---|
| AFP | Agent Fuel Points，火山方舟 Agent Plan 的统一计量单位 | 火山官方文档（调研报告） |
| Credits | 小米 MiMo Token Plan 的月度计量单位，按模型分档折算 token | 小米订阅文档（调研报告） |
| 窗口 | 额度重置周期：5h / weekly / monthly | PLAN.md |
| bundle | DSH 插件分发形态：npm 包 + cordis.patch.yml | cordis-plugin-development SKILL.md |
| keyed slot | 按 key 寻址的槽位；sidebar.panellist 的 id 与 main 的 key 配对成页 | dsh-client-ui-sidebar README.zh.md |
| 半区 | Host 半区（Node，插件 index.js）/ Client 半区（浏览器，client.js） | PLAN.md |

## 待确认区

| 术语 | 我的理解 | 证据来源 | 待确认问题 |
|---|---|---|---|
| MiMo currentPeriodEnd 时区 | 按 UTC 解析（跟随 CodexBar 实现） | CodexBar MiMoUsageFetcher.swift | 小米服务端返回的是北京时间还是 UTC？影响重置倒计时，需实机核对 |
| MiMo percent 语义 | 0..1 小数，防御式兼容 >1 按百分数处理 | CodexBar 代码推断，无真实响应样本 | 实机响应确认 |

## 变更日志

- 2026-10-13：建文件。初始词条来自 PLAN.md 与两份调研报告（三家额度接口、DSH 插件机制）。
