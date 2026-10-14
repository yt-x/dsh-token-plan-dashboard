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

**换机器时的表现**：解析链已改为**自带 vendored 副本优先**（`plugin/vendor/schemastery.mjs`，见下一条坑与 decisions/0004），因此不再依赖「node.exe 由 DSH 自己启动」这一形态——所有设备走同一条路径，跨设备降级**不再是预期行为**。execPath 祖先探测保留为兜底候选（第 3 顺位），可用 `DSH_APP_RESOURCES` 直接指向应用 resources 根强制指定。

## 2026-10-13：Config 依赖解析链只在「DSH 自带 node.exe」形态成立 → 换设备开关静默失效

**这是用户报告的「其他设备安装后开关不可用」的真因，已修（0.2.4）。**

现象：在别的设备安装后，页面提示「设置服务中找不到本插件的配置项（host 侧 Config 未激活）：开关状态的修改不会保存。」——注意这是 `config_unavailable`（entry 不在 settings 镜像），不是 `config_missing`（服务未注入）。

因果链（已逐行核实，非推测）：

1. bundle 安装器不落实 `dependencies`（上一条坑）→ 裸 import schemastery **在所有设备**都失败；
2. `loadSchemastery()` 只剩「从 `execPath` 逐级向上枚举祖先目录找应用自带副本」一条路，而它只在「host 进程 = DSH 自带 node.exe，且其祖先目录含 `app.asar.unpacked/node_modules`」时命中；
3. 换设备后（DSH 装在别的路径层级 / 用系统 node 跑 host / 进程形态或自带版本不同）该探测落空 → `Config = undefined`（降级）；
4. `settings.describe()` 对每个 entry 的门禁是 `const schema = this.schema(entry)`（= `entry.fiber.runtime.Config`，且须有 `toJSON`），**`schema === undefined` 即 `return []` 静默丢弃该 entry**（`dsh-settings/lib/index.js:415-420`）；
5. 镜像里没有本命名空间 → 客户端 `configForms.get(...)` 的 `derive()` 命中 `view === undefined` 分支 → `status = 'unavailable'`（`dsh-client-ui-settings/lib/client.js:1227-1232`）→ 开关禁用 + 该提示。

**关键认知**：这不是「缺依赖导致插件崩溃」，而是**缺依赖导致 Config 静默降级**。降级本是刻意设计的韧性行为，但它把「开关」这个核心能力一起降没了，且提示文案无法指导用户自愈。`configActive: true` 只在本机成立过——那是 execPath 侥幸命中，**跨设备失效是这条侥幸路径的必然结果**。

规避（已落地）：把 Config 真正需要的闭包 vendoring 进 bundle —— `plugin/vendor/schemastery.mjs`（635 行）+ `plugin/vendor/cosmokit.mjs`（418 行），解析链改为**自带副本优先**。支撑事实四条：

- **闭包极小**：schemastery 唯一 import 是 cosmokit，且只用 10 个具名导出；cosmokit 零自身依赖。
- **loader 是鸭子类型检查**：`isSchemastery()` 只判 `schema?.["~standard"].vendor === "schemastery"`（`cordis-plugin-loader/lib/index.js:280`），不认库身份。
- **dsh-settings 用它自己的真库重建我们的 schema**：`plainSchema()` 走 `new z(schema.toJSON())`（`dsh-settings/lib/index.js:104`），`z` 是 dsh-settings 自己 import 的真 schemastery。所以我们只需产出**正确的 `toJSON()`**——不需要副本与官方副本是同一对象，也不需要跨副本 volatile 识别。
- **volatile 走 `Symbol.for`**：全局注册表符号，跨副本天然一致。

**维护提醒**：`plugin/vendor/` 下的文件带 `VENDORED` 头注释，**不要手动编辑**（唯一改动是 schemastery 那行的 import 改相对路径）。升级 DSH 后如需同步版本，从 DSH 自带 `node_modules` 重新复制并重做该行改动。vendored 版本记录在文件头（schemastery 3.18.4 / cosmokit 1.8.5）。

**回归防护**：`verification/smoke.mjs` 现在**断言** `Config` 必须 present（不再接受降级），并校验三道门禁：`toJSON` 存在、`~standard.vendor === 'schemastery'`、`new z(toJSON())` 往返后 `monitors.meta.volatile` 仍为 true。任何一条失败即报错退出——这些正是 describe() 丢弃 entry 的条件。

## 2026-10-13：装完≠生效——「新装」可 HMR 生效，「覆盖/重装」必须重启应用

**这是「重装后行为没变、以为修复无效」这类误判的来源，排障前先读。**

`dsh-plugin-manager` 的 `install()` 判定逻辑（`dsh-plugin-manager/lib/index.js` 的 `PluginManager::install`）：

```js
if (mutation?.replaced === true || Object.hasOwn(before, name)) return "restart-required";
if (options?.enabled !== false) result.warnings = await this.reload();   // 走 HMR → "applied"
```

即：

- **首次安装**（profile 里原本没有这个 bundle）→ 走 `reload()` HMR 就地挂载，返回 `applied`，**当次会话即生效，不必重启**。
- **覆盖安装 / 重装 / 改版本**（`replaced === true` 或该 bundle 已在 profile 里）→ 直接返回 **`restart-required`**，**运行中的 host 仍是旧 JS**。官方技能文档亦确认：*"Installing a new bundle can activate through HMR; replacing an installed package requires restart to load a fresh JavaScript module generation."*

**为什么这条对本插件特别重要**：本插件的 host 半区在**模块加载时**（顶层 `await loadSchemastery()`）就决定了 `export const Config`。所以「装了什么版本」与「跑的是哪份代码」不一致时，表现是**旧行为继续**——例如 0.2.4 的 vendored 闭包已落盘、但 host 仍跑 0.2.3 的解析链，就会继续按旧的「应用自带副本」路径解析。0.2.0 首轮排障已踩过一次（`/state` 返回 0.1.0 形状、无 `enabled` 字段）。

**规避**：

1. 覆盖安装后**完全退出并重启 DSH Desktop**（不是刷新页面、不是重开窗口）——client 半区也随应用重启重新加载。
2. 验收前先**确认跑的是新代码**，而不是先怀疑新代码错：看插件页报告的 `application` 是 `applied` 还是 `restart-required`；或探 `/dsh-token-plan-dashboard/state` 的 `configActive` 与字段形状是否为新版。
3. 跨设备首装（profile 里没有本 bundle）→ 属「首次安装」，理论上 HMR 即生效；但**首次装就走到「要重启」也完全可能**（取决于 profile 里是否已有同名/同 spec 条目、以及 host 是否提供 hmr 服务）。**一律按「装完重启」执行**，成本极低而能排除整类误判。

## 2026-10-13：client 半区 inject 分两级，故障面完全不同

现象与结论（0.2.0 → 0.2.3 三轮实机排障）：

- **包级注入**（package.json `dsh.client.inject`）：按 profile 依赖树解析包。profile 只装组合列出的 bundle（dsh-base / dsh-web-app / 市场包 / 本插件），写不在依赖树里的包（如 `@deepseek-ai/dsh-client-ui-settings`）→ 解析失败 → **整个 client 插件不激活，侧边栏入口、页面、样式全部消失**。
- **服务级 inject**（client.js 返回的 `inject: [...]`）：按 cordis 服务名注入。服务在组合里存在就能注（已核实 `dsh-client-ui-settings` 的 `ui-settings` 行在 dsh-web-app patch 中）；反过来，未声明的服务在插件 ctx 上访问不到（`ctx.configForms` 探测只得 null）。
- 正确姿势：服务级 inject 正常声明所需服务（如 `configForms`）；包级 inject 只写 profile 依赖树里有的包；apply 内对拿到的服务再做一次 try/catch 兜底，极端情况降级而不是全灭。
