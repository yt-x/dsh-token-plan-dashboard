# 0001：Host↔Client 传输用 webServer HTTP 路由，不用 Typert RPC

日期：2026-10-13

## Problem

PLAN.md 架构写的是「Typert RPC: listPlans() / refresh(provider?)」。第三方纯 JS 插件能否编写 Typert 端点没有官方路径：内置包的 Typert 产物由 `@deepseek-ai/dsh-typert-generator` 从 FaceModel 生成，工具链不对外。

## Decision

Host 半区注册 `webServer` HTTP 路由（state / snapshot / credentials），Client 同源 `fetch` 调用。RPC 语义（列计划、按 provider 刷新）不变，只换传输。

## Alternatives considered

- Typert RPC（PLAN 原案）：第三方插件无生成工具链，落地不了。
- webServer 路由（选中）：已发布的同类插件 ZnonEn/dsh-volcark-quota 用该模式跑通了完全相同的场景，证明被当前 DSH 版本支持；我们的调用是无状态请求-响应，用不到 Typert 的流/上行能力。代价是失去类型安全的生成代码，路由与数据模型改由 spec/current.md 书面固定；若官方以后开放插件 Typert 编写方式可平移，Client 只有一个 fetch 封装点。
