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
| 每 provider 监测开关（Config volatile + 设置区 + 自动启用） | 进行中 | verification/2026-10-13-v1.1.md |

## 当前状态

V1.1（监测开关）已实现，静态/冒烟/Config 探测通过；三轮实机排障修复至 0.2.3（安装器不落 dependencies、包级 client inject 整页不激活、host 是 plain node.exe 无 resourcesPath、服务级 inject 才可注 configForms，见 CONSTRAINTS.md）。host 侧 Config 已实机确认激活（configActive: true），待重装 0.2.3 后确认开关端到端可用。环境备注：pwsh 沙箱 workspace-write 模式初始化故障（SetNamedSecurityInfoW），命令需提升权限运行。

## 下一步

1. 实机验证 V1.1 —— 重装 0.2.3 bundle 后**完全重启 DSH Desktop**，按 spec/current.md 验收判定 1-10 逐项过；若设置区仍提示不可用，看警告文案是 missing 还是 unavailable 并回报。
2. **火山签名路径首次真机验证**（CONSTRAINTS.md 第一条）—— 用真实 AK/SK 打通一次；若报签名类错误，先把 SignedHeaders 改成固定序再怀疑 AK/SK。
3. **修火山签名错误分类**（CONSTRAINTS.md 第三条）—— 4xx 也读响应体信封，按 `Code` 判鉴权类错误走 expired，让 AK/SK 填错时给凭证引导而非「HTTP 400」。
4. 核对 MiMo 卡片重置倒计时与控制台对时 —— 一致则关闭 CONTEXT.md 待确认区的时区条目。
5. 规划 V1.1 候选：MiMo 受控登录窗自动抓 cookie（见 PLAN.md 分期）；plugins.bundle.config 官方配置页（开关的第二入口，本轮延后）—— 进入开发前先走需求收敛。

## 阻塞

- 无。
