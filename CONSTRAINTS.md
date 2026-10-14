# CONSTRAINTS.md（坑与规避）

## 2026-10-13：DSH Desktop bundle 安装器不落实 dependencies

现象：插件 package.json 声明 `dependencies`（如 `@deepseek-ai/schemastery`）后，`dsh plugin add` / Web 插件页安装会生成 generation 并写好 pnpm lock（`lock.yaml` 有记录、`.modules.yaml` 的 hoistedLocations 也列出），但 **包文件不落盘**——`node_modules/@deepseek-ai/` 是空目录，运行时裸 import 解析失败。实测于 DSH Desktop 0.1.7-rc.2（registry 为 npmmirror）。

规避：host 半区一律按「依赖不可解析」设计——关键库用动态 import + 解析链兜底（本插件对 schemastery 的兜底：裸 import → 应用自带 `resources/app.asar.unpacked/node_modules` → 降级无 Config）。package.json 里保留 dependencies 声明仅作意图记录与未来安装器修复后的首选路径，**不要指望它生效**。

相关事实：DSH Desktop 的 host 进程不是 Electron 主进程，是应用自带的 plain node.exe（`resources/app.asar.unpacked/node_modules/node/bin/node.exe`，入口 `resources/harness-node-entry.mjs`）——**没有 `process.resourcesPath`**。定位应用 resources 根要从 `process.execPath` 逐级向上枚举祖先目录，按 `app.asar.unpacked/node_modules` 与 `node_modules` 两种前缀探测（0.2.1 用 `dirname(execPath)/resources` 拼错过一次层级）。

## 2026-10-13：client 半区 inject 分两级，故障面完全不同

现象与结论（0.2.0 → 0.2.3 三轮实机排障）：

- **包级注入**（package.json `dsh.client.inject`）：按 profile 依赖树解析包。profile 只装组合列出的 bundle（dsh-base / dsh-web-app / 市场包 / 本插件），写不在依赖树里的包（如 `@deepseek-ai/dsh-client-ui-settings`）→ 解析失败 → **整个 client 插件不激活，侧边栏入口、页面、样式全部消失**。
- **服务级 inject**（client.js 返回的 `inject: [...]`）：按 cordis 服务名注入。服务在组合里存在就能注（已核实 `dsh-client-ui-settings` 的 `ui-settings` 行在 dsh-web-app patch 中）；反过来，未声明的服务在插件 ctx 上访问不到（`ctx.configForms` 探测只得 null）。
- 正确姿势：服务级 inject 正常声明所需服务（如 `configForms`）；包级 inject 只写 profile 依赖树里有的包；apply 内对拿到的服务再做一次 try/catch 兜底，极端情况降级而不是全灭。
