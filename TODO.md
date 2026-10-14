# TODO

## 功能进度

| 功能 | 状态 | 证据 |
|---|---|---|
| 火山方舟 Agent Plan 适配器（GetAgentPlanAFPUsage，AK/SK 签名） | 完成 | verification/2026-10-13-v1.md |
| Kimi Code 适配器（coding/v1/usages，API Key） | 完成 | verification/2026-10-13-v1.md |
| MiMo Token Plan 适配器（内部接口，cookie 凭证） | 完成 | verification/2026-10-13-v1.md |
| Host 半区：HTTP 路由（snapshot / state / credentials） | 完成 | verification/2026-10-13-v1.md |
| 仪表盘页：侧边栏入口 + 卡片墙 + 倒计时 | 完成 | verification/2026-10-13-v1.md |
| 页内凭证表单（MiMo cookie 粘贴引导与失效展示） | 完成 | verification/2026-10-13-v1.md |
| 刷新行为：打开自动刷新一次 + 手动刷新 | 完成 | verification/2026-10-13-v1.md |
| 安装与实机验证（页面可见、真实数据、深浅主题） | 完成 | verification/2026-10-13-v1.md |
| 每 provider 监测开关（Config volatile + 设置区 + 自动启用） | 完成 | verification/2026-10-13-v1.1.md |
| 跨设备开关失效修复（vendored schemastery 闭包，0.2.4） | 完成 | verification/2026-10-13-v1.2.md |

## 当前状态

V1.2（0.2.4）跨设备修复已**实机验收通过**：故障设备重装并重启后，用户确认「可以正常使用了」，设置区无「Config 未激活」提示、开关可用（详见 verification/2026-10-13-v1.2.md 实机验收节）。开关可用性由自带 vendored schemastery 闭包保证（`plugin/vendor/`，解析链自带副本优先），所有设备走同一路径。根因与规避见 CONSTRAINTS.md「Config 依赖解析链」一条与 decisions/0004。

## 下一步

1. **火山签名路径首次真机验证**（CONSTRAINTS.md 第一条）—— 用真实 AK/SK 打通一次；若报签名类错误，先把 SignedHeaders 改成固定序再怀疑 AK/SK。
2. **修火山签名错误分类**（CONSTRAINTS.md 第三条）—— 4xx 也读响应体信封，按 `Code` 判鉴权类错误走 expired，让 AK/SK 填错时给凭证引导而非「HTTP 400」。
3. 核对 MiMo 卡片重置倒计时与控制台对时 —— 一致则关闭 CONTEXT.md 待确认区的时区条目。
4. 规划 V1.1 候选：MiMo 受控登录窗自动抓 cookie（见 PLAN.md 分期）；plugins.bundle.config 官方配置页（开关的第二入口，本轮延后）—— 进入开发前先走需求收敛。

## 阻塞

- 无。
