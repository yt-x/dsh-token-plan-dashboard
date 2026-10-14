# 0004：Config 声明自带 schemastery 闭包，消除跨设备依赖解析失败

日期：2026-10-13

## Problem

插件在**其他设备**安装后，监测开关不可用，页面提示：

> 设置服务中找不到本插件的配置项（host 侧 Config 未激活）：开关状态的修改不会保存。

这是 `config_unavailable` 分支（不是 `config_missing`）。含义：client 侧 `ctx.configForms` 服务**已注入**、`get()` 也返回了控制器，但 `derive()` 在 settings 镜像的 `view.namespaces` 里**找不到 `token-plan-dashboard` 这个 entry**（`dsh-client-ui-settings/lib/client.js` 的 `ConfigFormController::derive`），于是 `status = "unavailable"`。

entry 为什么不在镜像里？镜像来自 Host 的 `settings.describe()`，而 `describe()` 对每个 entry 有一串硬门禁（`dsh-settings/lib/index.js` 的 `SettingsForms::describe`）：

```js
const schema = this.schema(entry);          // = entry.fiber.runtime.Config，且须有 toJSON
if (schema === void 0 || entry.fiber === void 0 ||
    entry.fiber.runtime === null || entry.fiber.state !== 2) return [];   // 直接丢弃该 entry
const form = volatileForm(schema);
if (form === void 0) return [];             // 无 volatile 字段也丢弃
```

本插件三处都满足时 entry 才会出现。**在本机三处都满足（configActive: true），在别的设备第一处就断了**：

`index.js` 的 `export const Config` 取决于 `loadSchemastery()` 的解析链：

1. 裸 `import('@deepseek-ai/schemastery')` —— 依赖 bundle 的 `dependencies` 落盘；
2. 从 `process.execPath` 逐级向上枚举祖先目录，按 `app.asar.unpacked/node_modules` 与 `node_modules` 两种前缀探测应用自带副本；
3. 都失败 → `Config = undefined` → **降级**。

第 1 条在**所有**设备都不成立：DSH Desktop 的 bundle 安装器不落实 `dependencies`（lock 有记录、文件不落盘，见 CONSTRAINTS.md）。

第 2 条是本机侥幸成立的原因，也**正是跨设备失败的原因**：它依赖「host 进程的 `execPath` 恰好指向 DSH 自带 node.exe，且其祖先目录里能找到 `app.asar.unpacked/node_modules`」。换设备后任一环节变化即落空：

- DSH 装在别的路径层级、或该设备用系统 node 跑 host；
- host 进程形态变化（host 不由自带 node.exe 启动）；
- 其他设备上 DSH 版本不同，自带 schemastery 版本与本插件声明的不一致（`~3.18.4`）。

落空后 `Config = undefined`，`entry.fiber.runtime.Config` 为 `undefined` → `schema(entry)` 返回 `undefined` → describe **静默丢弃**该 entry → 镜像里没有本命名空间 → 客户端 `unavailable`。**开关失效，但页面与卡片正常**——与用户报告的现象完全一致。

关键点：**这不是「缺依赖」导致插件崩溃，而是依赖缺失导致 Config 静默降级**。降级是 0.2.x 刻意设计的韧性行为，但它把「开关」这个核心功能一起降没了，且提示文案只说「Config 未激活」，用户无从修复。

## Decision

**把 Config 真正需要的那一小块 schemastery 闭包 vendoring 进 bundle**，让第 1 条（裸 import）在所有设备上自足成立，不依赖安装器或应用自带副本。

依据（已核实的事实）：

1. **闭包极小**：`@deepseek-ai/schemastery@3.18.4` 的 ESM 入口 `lib/index.mjs` 只有 635 行，唯一 import 是 `@deepseek-ai/cosmokit`，且只用到 10 个具名导出（`Binary, clone, createVolatile, deepEqual, filterKeys, isNullable, isPlainObject, isVolatile, pick, valueMap`）。`cosmokit/lib/index.js` 418 行、零依赖。二者合计约 1050 行，可随包发布。
2. **loader 用的是鸭子类型检查，不是库身份**：`isSchemastery()` 判 `schema?.["~standard"].vendor === "schemastery"`（`cordis-plugin-loader/lib/index.js` 的 `isSchemastery`）。自带副本只要产出正确的 `~standard` 信封即被认可。
3. **dsh-settings 会用它自己的真库重建我们的 schema**：`plainSchema()` 走 `new z(schema.toJSON())`（`dsh-settings/lib/index.js` 的 `plainSchema`），其中 `z` 是 **dsh-settings 自己 import 的真 schemastery**。所以我们这边只需要产出**正确的 `toJSON()`**，重建由官方真库完成——不需要我们的副本与官方副本是同一个对象，也不需要跨副本的 volatile 识别。
4. **volatile 走 `Symbol.for`**：schemastery 内部用 `Symbol.for("schemastery")` / `createVolatile`（`schemastery/lib/index.mjs:3-4, 480`），是全局注册表符号，跨副本天然一致。

因此 vendoring 是低风险、高确定性的修法：本机与跨设备**走同一条路径**，「本机能用、别的设备不能用」这个分歧从根上消失。

### 落地形状

- 新增 `plugin/vendor/schemastery.mjs`（schemastery 的 `lib/index.mjs`）与 `plugin/vendor/cosmokit.mjs`（cosmokit 的 `lib/index.js`），后者由前者以相对路径 import。
- `index.js` 的 `loadSchemastery()` 解析链改为：**自带副本优先** → 裸 import → 应用自带副本 → 降级。
- `package.json` 的 `dependencies` 保留 `@deepseek-ai/schemastery`（意图记录；未来安装器修复后仍可走官方路径），并加 `files` 条目把 `vendor` 打进 bundle。

**顺序很关键**：自带副本放第一位，才能保证「所有设备行为一致」；把它放后面就等于继续赌环境。

## Alternatives considered

- **维持现状 + 修文档**：接受「换设备就失去开关」。否决——开关是 V1.1 的核心能力，且失败态对用户不可自愈（提示文案无法指导修复）。
- **环境变量 `DSH_APP_RESOURCES` 兜底**：需要用户手工设环境变量，等于把部署问题转嫁给用户。否决（保留为解析链第 3 顺位的候选路径）。
- **手写最小 schema 对象模拟 schemastery**：零依赖，但需逐项对齐 `new z(toJSON())` 的反序列化与 volatile 内部结构，DSH 升级即可能静默失效（decisions/0003 已就此否决）。自带真闭包比手写模拟更稳。
- **把开关迁出 Config，自造持久化**：decisions/0003 已否决（脱离官方设置体系）。

## 影响

- 新增 `plugin/vendor/` 两个文件（约 1050 行，非本仓库自写代码，属 vendored 第三方，需在文件头注明来源与版本）。
- `plugin/package.json` `files` 增 `vendor`。
- spec/current.md 的 Config 解析链一节需改写（能力未变，但机制变更 → 属「实现修正 + 契约细化」）。
- CONSTRAINTS.md「换机器时的表现」一条需改写：跨设备降级是设计外的故障路径，自带副本保证所有设备走同一路径。
- client 侧 `config_unavailable` 文案保留（仍是极端情况的兜底），正常路径下该提示不出现。
