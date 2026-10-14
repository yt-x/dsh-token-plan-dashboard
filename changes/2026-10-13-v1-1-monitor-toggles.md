# 变更：V1.1 每 provider 监测开关（2026-10-13）

## 目标

按 spec/current.md（V1.1）落地监测开关：设置模块内启用/关闭各订阅；卡片墙只展示「已启用 ∧ 已配置凭证」；关闭不删凭证；保存凭证自动启用；开关经官方 Config 机制持久化并热更新。

已收敛决策（grilling，用户逐条确认）：

1. 卡片墙展示规则：只展示「启用 ∧ 已配置」；未配置/已关闭不上墙，管理动作收进设置区。
2. 关闭语义：卡片 + 凭证表单都隐藏；凭证保留，重开即恢复。
3. 保存凭证（非清除）→ 自动启用该 provider；清除不动开关。
4. 新增 provider 默认启用（缺省即启用）；已删除 provider 的残留键无害。
5. 设置入口：仪表盘页内设置区为主；plugins.bundle.config 官方配置页延后（进 TODO 下一步）。
6. Config 机制需引入 `@deepseek-ai/schemastery`，窄口径放宽 host 硬约束（decisions/0003）。

## 任务

1. plugin/package.json：version 0.1.0 → 0.2.0；dependencies 加 `@deepseek-ai/schemastery ~3.18.4`；dsh.client.inject 加 `@deepseek-ai/dsh-client-ui-settings`。
2. plugin/index.js：`export const Config`（`monitors: z.dict(z.boolean()).volatile()`，schemastery 不可解析时降级为 undefined + console.warn，保证冒烟与异常环境可加载）；`apply(ctx, config)`；state 响应加 `enabled`；snapshot 只含启用的 provider（指定已关闭 provider → 200 空 accounts）。
3. plugin/client.js：inject 加 `configForms`；页底「凭证配置」扩展为「设置」区（每 provider = 开关 + 启用时的凭证表单）；卡片墙过滤 `configured && enabled`；空态文案改指设置区；保存凭证成功后自动 `monitors[provider]=true`；新增 locale 文案与开关样式。
4. verification/smoke.mjs：mock config（含 Volatile 引用形状与 plain object 两种）覆盖：Config 导出形状（存在或降级路径）、state enabled 标记、snapshot 过滤关闭项、指定关闭 provider 返回空 accounts。
5. 文档：spec/current.md（先改）、AGENTS.md 约束豁免、decisions/0003、本变更记录、TODO.md。

## 验证

见 verification/2026-10-13-v1.1.md（实现完成后填写真实命令输出）。实机部分（开关 UI、patch 持久化、热更新）需在 DSH 中重装 bundle 后验证。

## 实机排障修订（2026-10-13，版本 0.2.0 → 0.2.1）

首次重装 0.2.0 后整页消失。根因（证据见 verification/2026-10-13-v1.1.md 排障节）：

1. client 半区硬 inject `configForms`（及 package.json 声明 ui-settings 包）——服务/包未满足时整个 client 插件不激活，页面全灭。修为运行时探测 + 降级。
2. DSH Desktop bundle 安装器不落实 dependencies（lock 有记录、文件不落盘），schemastery 裸 import 必失败。修为解析链：裸 import → 应用自带副本（resources/app.asar.unpacked）→ 降级无 Config。
3. 运行中宿主仍是旧代码（重装不触发 host 重载）——需重启应用生效。

新增约束记录：CONSTRAINTS.md（首两条坑）。decisions/0003 补充实机发现。

## 二次排障修订（2026-10-13，版本 0.2.1 → 0.2.2）

0.2.1 实机：页面恢复，但设置区提示「设置服务不可用」。根因：host 进程是应用自带 plain node.exe（无 `process.resourcesPath`），0.2.1 解析链的 `dirname(execPath)/resources` 候选拼错层级，Config 降级 → entry 不进 settings 镜像。修复：解析链改为 execPath 祖先目录逐级枚举 + 双前缀探测；/state 增加 `configActive` 诊断字段；client 警告区分服务缺失（missing）与 entry 未激活（unavailable）。复检：本机 PATH 的 node 即 DSH 自带 node.exe，冒烟走与真实 host 同一解析路径，Config present、SMOKE OK（verification/2026-10-13-v1.1.md 二次排障节）。

## 三次排障修订（2026-10-13，版本 0.2.2 → 0.2.3）

0.2.2 实机：`/state` 探测 `configActive: true`（host 侧 Config 已激活），但设置区提示「configForms 服务未注入」。根因：0.2.1 把 configForms 从服务级 inject 撤掉后，cordis 对未声明服务不可见（ctx 探测只得 null）；而 0.2.0 整页死亡的真正原因是**包级** `dsh.client.inject` 写了不在 profile 依赖树里的包（已核实 `ui-settings` 在 dsh-web-app patch 中、服务存在于组合）。修复：服务级 inject 恢复 `configForms`，包级 inject 不加该包。CONSTRAINTS.md 第二条坑按两级 inject 的真实故障面改写。
