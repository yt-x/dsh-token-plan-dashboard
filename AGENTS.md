# AGENTS.md（项目级）

本文件只写本项目与全局契约的差异、分工表、规格工作流登记。形状规则（TODO 契约 / 决策记录 / 开工顺序 / 文档规则）见全局 AGENTS.md，不重述。

## 接手顺序（新会话按此读）

1. **本文件**（已自动加载）—— 硬约束与分工表。
2. `TODO.md` 的「当前状态 / 下一步 / 阻塞」—— 现在做到哪、下一步做什么。
3. 要动码：先读 `spec/current.md`（行为契约事实源），再按需读对应 `plugin/providers/*.js`。
4. 动手前扫一遍 `CONSTRAINTS.md` —— 已踩过的坑（尤其火山签名相关三条）。
5. 碰上游接口（端点 / 签名 / 字段）：读 `docs/reference/upstream-apis.md`。

仓库零依赖，`node verification/smoke.mjs` 即可验证（预期末行 `SMOKE OK`）。

## 分工表

| 内容类型 | 家 |
|---|---|
| 已确认方案（历史来源） | PLAN.md |
| 当前行为契约（规格事实源） | spec/current.md |
| 调度（进度/下一步/阻塞） | TODO.md |
| 本轮变更明细（目标/任务/验证） | changes/ |
| 验证证据 | verification/ |
| 术语与领域知识 | CONTEXT.md |
| 上游接口事实（端点/签名/字段/错误语义） | docs/reference/upstream-apis.md |
| 非平凡决策因果 | decisions/ |
| 坑与规避 | CONSTRAINTS.md（第一个坑出现时建） |
| 插件实现 | plugin/（可安装 bundle） |

规格与实现的关系：spec/current.md 与实现漂移时，以「能力是否变更」判断——变更就先改规格再动码；实现错误就修实现。PLAN.md 是历史方案，不再是事实源。

## 插件开发的硬约束（与全局契约的差异）

- Host 半区不 import 任何 `@deepseek-ai/*` 包；只用 Node 内置模块 + cordis 注入的服务。唯一例外：`@deepseek-ai/schemastery`，仅用于声明 `export const Config`（decisions/0003）。该库及其依赖 cosmokit 的真实闭包已 vendoring 到 `plugin/vendor/`（decisions/0004），**不要手动编辑 vendor 下文件**。
- Client 半区不 import 宿主 Client 包；React 从浏览器共享模块表 `require('react')`；样式只用 `--dsw-alias-*` 主题 token；可见文案走 Client locale 服务。
- 凭证只走 `ctx.credentials` 服务；浏览器永远拿不到密钥值；禁止把凭证写进任何进 git 的文件。
- 禁止手写 profile 的 package.json / cordis.patch.yml；安装只走 `plugin_manager` install_bundle / Web 插件页 / `dsh plugin add`。

## 规格工作流登记

- 核心工作流：能力变更维护当前规格，并保留本轮变更记录和验证证据；不强制采用某个框架的完整流程。
- 当前规格入口：`spec/current.md`
- 当前变更入口：`changes/`
- 历史变更入口：`changes/`（归档与进行中同目录，按文件名日期排序）
- 验证证据入口：`verification/`

### 已检测的规格工具

| 工具或框架 | 检测依据 | 当前状态 | 适配说明 |
|---|---|---|---|
| 无 | 工作区仅有 PLAN.md，无 .specify/、openspec/、docs/superpowers/ | 未检测到 | 使用自定义入口：spec/current.md 为当前规格，changes/ 为变更记录，verification/ 为验证证据 |
