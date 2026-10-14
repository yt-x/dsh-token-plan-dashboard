# CONSTRAINTS.md（坑与规避）

## 2026-10-13：火山签名路径从未实机验证，SignedHeaders 顺序与官方要求不符

**待实机验证项，不是已确认结论。** 火山签名 V4 要求 canonical headers 与 SignedHeaders 用**固定顺序** `host;x-date;x-content-sha256;content-type`（非字母序，见 docs/reference/upstream-apis.md）。

`plugin/providers/volcano.js` 的 `sign()` 用 `Object.keys(signed).sort()` 构造，实际产出字母序 `content-type;host;x-content-sha256;x-date`，**与固定序不同**。

两种可能，现有证据无法区分：

1. 火山网关实际接受字母序 → 当前实现可用；
2. 火山严格校验固定序 → 当前实现签名必然失败。

**我们手上没有真实 AK/SK，这条路径从未端到端跑通**（冒烟只覆盖三家的失效分支，走不到签名成功分支）。规避：**首次用真实 AK/SK 验证时，若返回签名类错误，第一件事是把 SignedHeaders 改成固定序**，不要先去怀疑 AK/SK 填错。改法是把 `.sort()` 换成显式固定数组。

## 2026-10-13：火山 Action 名与其它第三方实现不同（勿据他人代码改我们的）

我们调 `GetAgentPlanAFPUsage`（`plugin/providers/volcano.js` 的 `ACTION` + spec/current.md 一致，**无内部漂移**）。另有第三方实现调 `GetAFPUsage`。

回源核验：某第三方完整实现里 `GetAFPUsage` 出现 12 次、`GetAgentPlanAFPUsage` 出现 **0 次**。即这是**两家各自在使用不同 Action 名**，不是谁写错。

两个名字是否同一 Action 的别名，**未核实**（无法独立确认官方文档，其页面为 JS 渲染）。

规避：**不要**因为读到他方实现就改我们的 `ACTION` —— 我们的写法与自家规格自洽。但记住 `GetAFPUsage` 是**已验证可用的回落候选**：若 `GetAgentPlanAFPUsage` 某天被上游下线或持续报未知 Action，优先试它。

## 2026-10-13：火山签名类错误常返 HTTP 400，不是 401/403

火山 OpenAPI 网关对签名/凭据类错误**常返 4xx（多为 HTTP 400）**，并携带与 200 路径相同的 `ResponseMetadata.Error` 信封，**而非 401/403**。

`plugin/providers/volcano.js` 当前对非 401/403 一律 `failure()`（普通错误）。后果：**AK/SK 填错时用户看到「HTTP 400」，而不是「凭证失效、去更新 AK/SK」的引导**，卡片不进 expired 态。

规避（待修）：4xx 也要读响应体信封，按 `Code` 判定是否为鉴权类错误再决定 `expired()` / `failure()`。另注意**错误信封也可能是顶层 `Error`**（不只 `ResponseMetadata.Error`）。见 TODO.md 下一步。

## 2026-10-13：DSH Desktop bundle 安装器不落实 dependencies

现象：插件 package.json 声明 `dependencies`（如 `@deepseek-ai/schemastery`）后，`dsh plugin add` / Web 插件页安装会生成 generation 并写好 pnpm lock（`lock.yaml` 有记录、`.modules.yaml` 的 hoistedLocations 也列出），但 **包文件不落盘**——`node_modules/@deepseek-ai/` 是空目录，运行时裸 import 解析失败。实测于 DSH Desktop 0.1.7-rc.2（registry 为 npmmirror）。

规避：host 半区一律按「依赖不可解析」设计——关键库用动态 import + 解析链兜底（本插件对 schemastery 的兜底：裸 import → 应用自带 `resources/app.asar.unpacked/node_modules` → 降级无 Config）。package.json 里保留 dependencies 声明仅作意图记录与未来安装器修复后的首选路径，**不要指望它生效**。

相关事实：DSH Desktop 的 host 进程不是 Electron 主进程，是应用自带的 plain node.exe（`resources/app.asar.unpacked/node_modules/node/bin/node.exe`，入口 `resources/harness-node-entry.mjs`）——**没有 `process.resourcesPath`**。定位应用 resources 根要从 `process.execPath` 逐级向上枚举祖先目录，按 `app.asar.unpacked/node_modules` 与 `node_modules` 两种前缀探测（0.2.1 用 `dirname(execPath)/resources` 拼错过一次层级）。

**换机器时的表现（接手前先知道）**：解析链靠 `process.execPath` 逐级向上找应用自带副本，因此**只对"node.exe 由 DSH 自己启动"这一形态有效**。若换到 DSH 装在别处的机器、或用系统 node 跑冒烟，裸 import 与祖先探测都会落空 → **走降级分支：Config 失效、开关不可用并显示提示，其余功能（卡片墙、刷新、凭证）正常**。这不是故障而是设计内的韧性行为；需要强制指定时用环境变量 `DSH_APP_RESOURCES` 指向应用 resources 根。

## 2026-10-13：client 半区 inject 分两级，故障面完全不同

现象与结论（0.2.0 → 0.2.3 三轮实机排障）：

- **包级注入**（package.json `dsh.client.inject`）：按 profile 依赖树解析包。profile 只装组合列出的 bundle（dsh-base / dsh-web-app / 市场包 / 本插件），写不在依赖树里的包（如 `@deepseek-ai/dsh-client-ui-settings`）→ 解析失败 → **整个 client 插件不激活，侧边栏入口、页面、样式全部消失**。
- **服务级 inject**（client.js 返回的 `inject: [...]`）：按 cordis 服务名注入。服务在组合里存在就能注（已核实 `dsh-client-ui-settings` 的 `ui-settings` 行在 dsh-web-app patch 中）；反过来，未声明的服务在插件 ctx 上访问不到（`ctx.configForms` 探测只得 null）。
- 正确姿势：服务级 inject 正常声明所需服务（如 `configForms`）；包级 inject 只写 profile 依赖树里有的包；apply 内对拿到的服务再做一次 try/catch 兜底，极端情况降级而不是全灭。
