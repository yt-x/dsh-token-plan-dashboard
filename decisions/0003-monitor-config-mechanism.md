# 0003：监测开关走官方 Config 机制，窄口径豁免 @deepseek-ai/schemastery

日期：2026-10-13

## Problem

V1.1 要给每个 provider 加「启用/关闭监测」开关，需要：运行时用户可改、改完即时生效、重启与升级后保留。DSH 的官方机制是插件声明 `export const Config`（schemastery schema），用户修改经 dsh-settings/dsh-config-editor 写回 profile patch。但 Config 的事实绑定库是 vendored 的 `@deepseek-ai/schemastery`，而项目硬约束是「host 半区不 import 任何 @deepseek-ai/*」，且 bundle 在 pnpm 隔离布局下无法解析未声明的依赖——零依赖状态下该库不可达。

## Decision

1. 窄口径放宽硬约束：host 半区唯一允许 import 的 `@deepseek-ai/*` 包是 `@deepseek-ai/schemastery`，仅用于声明 Config（AGENTS.md 已同步）。
2. Config 形状：`monitors: z.dict(z.boolean()).volatile()`，显式 `false` = 关闭，缺省/`true` = 启用。新增 provider 缺省即启用；已删除 provider 的残留键无害。
3. 开关字段必须标 `.volatile()`：dsh-settings 只暴露 volatile 字段（否则不进 describe、写入报错）；volatile 修改就地更新运行中 fiber，不重启应用、不重挂插件。
4. 「保存凭证自动启用」放在 Client 侧做（保存成功后 `configForms` 写 `monitors[provider]=true`），Host 不 inject settings 服务，保持 host 半区最小面。

## Alternatives considered

- 不破约束、自造持久化（手写 JSON 到 $DSH_HOME 等）：官方存储路 storageDomain 同样需要 zod 类库（同被零依赖堵死），只剩野路子；要自己处理原子写/并发，且完全脱离官方设置体系（无自动表单、无 configForms、无 patch 层升级保留）。维护成本高于约束纯粹性的收益。
- 手写最小 Standard Schema 对象模拟 schemastery 节点：零依赖，但需逐项对齐 dsh-settings 的 `new z(toJSON())` 反序列化与 loader 的 volatile diff 内部结构，DSH 升级即可能静默失效，脆弱。
- 官方 Config + 声明依赖（选中）：DSH 官方 host 插件的标准做法（dsh-shell-env 等同款），换来 patch 持久化、volatile 热更新、configForms 客户端 API、自动表单兜底。代价：bundle 多一个依赖，版本由 package.json 锁定（`~3.18.4`）。

证据来源：同版本（0.1.7-rc.2 / cordis 4.0.4 / cordis-plugin-loader 1.0.5 / schemastery 3.18.4）官方包编译产物与 d.ts（unpkg），见 verification/2026-10-13-v1.1.md。

## 补充（2026-10-13 实机排障后）

DSH Desktop 0.1.7-rc.2 的 bundle 安装器**不落实 dependencies**（lock 有记录、文件不落盘，见 CONSTRAINTS.md），「声明依赖 → 裸 import 可解析」的前提在实机不成立。因此 index.js 改为解析链：裸 import → 应用自带副本（resources/app.asar.unpacked/node_modules，与官方插件同源同版本 3.18.4）→ 降级无 Config。结构检查（vendor 字符串 / toJSON / meta.volatile / Symbol.for 跨副本 volatile 识别）均为结构式，应用自带副本与 bundle 自供副本等价。client 侧 configForms 同步改为运行时探测 + 降级（硬 inject 未满足会让整个 client 插件不激活，见 CONSTRAINTS.md）。

## 后续修订（2026-10-13，见 decisions/0004）

上述「应用自带副本」兜底**只在 host 进程由 DSH 自带 node.exe 启动的本机形态成立**，换设备即落空 → Config 降级 → `settings.describe()` 静默丢弃 entry → 开关不可用。已由 decisions/0004 取代：把 schemastery + cosmokit 的真实闭包 vendoring 进 bundle，解析链改为**自带副本优先**。本决策的 Config 形状与 volatile 选择仍然有效，仅「来源」部分被 0004 修订。
