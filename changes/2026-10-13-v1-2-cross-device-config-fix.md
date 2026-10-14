# 变更：跨设备开关失效修复（2026-10-13，版本 0.2.3 → 0.2.4）

## 目标

修复用户报告的问题：**插件在其他设备上安装时，监测开关无法正常使用**，页面提示

> 设置服务中找不到本插件的配置项（host 侧 Config 未激活）：开关状态的修改不会保存。

这是 V1.1 监测开关的唯一阻塞项——本机可用、换设备即失效。

## 根因（已逐行核实）

用户所见是 `config_unavailable` 分支（**不是** `config_missing`），含义很具体：client 侧 `configForms` 服务已注入、`get()` 已返回控制器，但 settings 镜像的 `view.namespaces` 里**没有 `token-plan-dashboard` 这个 entry**。

entry 为何消失？Host `settings.describe()` 对每个 entry 的门禁（`dsh-settings/lib/index.js:415-420`）：

```js
const schema = this.schema(entry);   // = entry.fiber.runtime.Config，须有 toJSON
if (schema === void 0 || entry.fiber === void 0 ||
    entry.fiber.runtime === null || entry.fiber.state !== 2) return [];  // 静默丢弃
```

`schema(entry)` 为 `undefined` 的充要条件就是 **`export const Config === undefined`**——即本插件刻意设计的降级分支。因果链：

```
bundle dependencies 不落盘（安装器已知缺陷，所有设备）
  → 裸 import schemastery 必失败
  → 只剩「execPath 祖先目录探测应用自带副本」一条路
  → 换设备后该探测落空（路径层级 / 进程形态 / 自带版本任一变化）
  → Config = undefined（降级）
  → describe() 静默丢弃该 entry
  → 客户端 configForms 读到 status: 'unavailable'
  → 开关禁用 + 「Config 未激活」提示
```

**关键认知：这不是「缺依赖导致插件崩溃」，而是「缺依赖导致 Config 静默降级」。** 降级是 0.2.x 刻意加的韧性行为，但它把「开关」这个 V1.1 核心能力一起降没了，且提示文案无法指导用户自愈。本机 `configActive: true` 是 execPath 侥幸命中的结果——**跨设备失效是这条侥幸路径的必然结果，不是偶发**。

## 任务（已完成）

1. **新增 vendored 闭包**（逐字节复制，仅改一处 import 路径）
   - `plugin/vendor/cosmokit.mjs` ← `@deepseek-ai/cosmokit@1.8.5/lib/index.js`（418 行，零自身依赖）
   - `plugin/vendor/schemastery.mjs` ← `@deepseek-ai/schemastery@3.18.4/lib/index.mjs`（635 行），唯一 import 由裸包名改为 `./cosmokit.mjs`
   - 两文件均加 `VENDORED — 请勿手动编辑` 头注释（来源、版本、改动点、升级方式）
2. **`plugin/index.js`**：解析链改序为**自带副本优先** → 裸 import → 应用自带副本（含 `DSH_APP_RESOURCES`）→ 降级。自带副本用 `new URL('./vendor/schemastery.mjs', import.meta.url)` 定位（不依赖 cwd）。
3. **`plugin/package.json`**：version 0.2.3 → 0.2.4；`files` 增 `vendor`（确保打进 bundle）。`dependencies` 保留（意图记录，安装器修复后仍走官方路径）。
4. **`verification/smoke.mjs`**：新增 Config 门禁断言——Config 必须 present（不再接受降级），且 `toJSON` 存在、`~standard.vendor === 'schemastery'`、`new z(toJSON())` 往返后 `monitors.meta.volatile` 仍为 true。
5. **文档**：spec/current.md（Config 来源一节 + 架构图 + 新增验收判定 11）、CONSTRAINTS.md（改写「换机器时的表现」+ 新增完整因果链一条）、decisions/0004、本记录、TODO.md、AGENTS.md 约束例外。

## 方案依据（四条已核实事实）

| 事实 | 证据 |
|---|---|
| 闭包极小 | schemastery 唯一 import 是 cosmokit，只用 10 个具名导出；cosmokit 零自身依赖 |
| loader 是鸭子类型检查 | `isSchemastery()` 只判 `schema?.["~standard"].vendor === "schemastery"`（`cordis-plugin-loader/lib/index.js:280`） |
| dsh-settings 用**它自己的真库**重建我们的 schema | `plainSchema()` 走 `new z(schema.toJSON())`（`dsh-settings/lib/index.js:104`），`z` 来自 dsh-settings 自己的 import |
| volatile 走 `Symbol.for` | 全局注册表符号（`schemastery/lib/index.mjs:3-4`），跨副本天然一致 |

第三条尤其关键：我们**不需要**副本与官方副本是同一对象，也不需要跨副本 volatile 识别——重建由官方真库完成，我们只需产出正确的 `toJSON()`。

## 验证

见 verification/2026-10-13-v1.2.md。核心证据是**模拟异地环境**：把 plugin 复制到无 `node_modules`、无 DSH 应用目录的干净位置，用系统 node 并令 `DSH_APP_RESOURCES` 指向不存在路径（即旧代码必然降级的条件），`configActive: true` 依然成立。

另有**对抗测试**：真隔离应用自带副本后，vendor 缺失 / schemastery 损坏 / cosmokit 损坏三种异常均优雅降级、不崩溃——确认新增依赖没有引入新崩溃面。

**实机验收（2026-10-13）**：用户在其故障设备上重装 0.2.4、完全重启 DSH Desktop 后确认「可以正常使用了」——设置区不再出现「Config 未激活」提示、开关可用。因果链端到端闭合。

## 残余风险（明说）

vendored 版本锁定在 schemastery 3.18.4 / cosmokit 1.8.5。若其他设备上 DSH 自带的 schemastery 与本版本存在**序列化格式**差异，`new z(toJSON())` 可能不兼容。缓解：`toJSON()` 格式稳定且官方库向后兼容；版本号记录在 vendor 文件头，可追溯、可重新 vendoring。这是可观测、易修的残余风险——远优于修复前「静默失去功能」。

## 后续发现（同期落盘）

排障中确认「装完≠生效」这一坑：覆盖安装必返 `restart-required`，运行中 host 仍是旧 JS。对本插件尤其致命——host 半区在**模块加载时**（顶层 `await loadSchemastery()`）就决定了 `export const Config`，因此"装了什么版本"与"跑的哪份代码"不一致时表现为旧行为继续，极易误判为"修复无效"。已记入 CONSTRAINTS.md。
