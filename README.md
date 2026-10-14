# Token Plan Dashboard

DeepSeek Harness（DSH）客户端插件：在侧边栏提供一个只读仪表盘页，集中展示火山方舟 Agent Plan、Kimi Code、小米 MiMo Token Plan 三家 AI coding 订阅的额度状态。

## 怎么跑

1. 安装 bundle：`dsh plugin add <本仓库 plugin/ 目录的绝对路径>`，或在 Web 插件页安装该目录。
2. 打开侧边栏「额度」入口，在页面底部的凭证区填入各家的 AK/SK、API Key 或 cookie。
3. 页面打开时自动拉取一次额度；之后用页面上的刷新按钮手动更新。

## 怎么验证

仓库零依赖，克隆后即可直接跑，无需 `npm install`：

```bash
node verification/smoke.mjs     # 冒烟：Config 声明、开关过滤、路由契约、三家失效分支
```

预期输出末行为 `SMOKE OK`。这是**一次性探针，不是测试套件**；它只覆盖到凭证失效路径，**签名成功路径需要真实凭证才能走通**（见 CONSTRAINTS.md 第一条）。

实机验收按 [spec/current.md](spec/current.md) 的「验收判定」1-10 逐项过。

## 文档导航

| 主题 | 覆盖什么 | 链接 |
|---|---|---|
| 方案来源 | 已确认的产品方案与分期 | [PLAN.md](PLAN.md) |
| 当前规格 | V1.1 的行为契约与验收判定 | [spec/current.md](spec/current.md) |
| 进度与下一步 | 功能进度、当前状态、阻塞 | [TODO.md](TODO.md) |
| 术语 | AFP、Credits、窗口等 | [CONTEXT.md](CONTEXT.md) |
| 上游接口 | 三家服务的端点、签名、字段与错误语义 | [docs/reference/upstream-apis.md](docs/reference/upstream-apis.md) |
| 决策因果 | 传输方式、凭证存储等取舍 | [decisions/](decisions/) |
| 坑与规避 | 已知陷阱与规避手法 | [CONSTRAINTS.md](CONSTRAINTS.md) |
