# Token Plan Dashboard — DSH 插件方案（已确认）

> 状态：方案已确认，未实施。
> 来源：2025 年 grilling 讨论收敛，含两份调查报告（DSH 插件机制 + 三家额度接口）。

## 目标

在 DeepSeek Harness Web/Desktop GUI（同一 GUI，插件天然双端可见）内提供一个只读仪表盘，
集中展示多个 AI coding 订阅的额度状态，消灭"每次都要打开官网查额度"的痛点。

## 监控对象

| Provider | 产品 | 窗口 | 数据源 | 凭证 | 稳定性 |
|---|---|---|---|---|---|
| 火山引擎 | 火山方舟 Agent Plan（个人版） | 5h / 周 / 月（AFP 计量） | 官方 OpenAPI `GetAFPUsage` | AK/SK | ★★★ |
| 月之暗面 | Kimi Code | 5h / 月（老套餐另有 7 天周额度） | `GET https://api.kimi.com/coding/v1/usages` | API Key（https://www.kimi.com/code/console 创建） | ★★☆ |
| 小米 | MiMo Token Plan | 纯月度 Credits | 内部接口 `https://platform.xiaomimimo.com/api/v1` | cookie（`api-platform_serviceToken` + `userId`） | ★☆☆ cookie 会过期 |

## 形态与挂载

- DSH client plugin（bundle 制：npm 包 + `cordis.patch.yml`）
- 挂载点：`sidebar.panellist` 图标入口 + `main` keyed slot 独立仪表盘页面
- 页面：**卡片墙**，每个 plan 窗口一张卡（进度条 + 已用/总量 + 百分比 + 重置倒计时）
- 安装：走 `plugin_manager` install_bundle / Web 插件页 / `dsh plugin add`，禁止手写 profile 配置

## 架构（双半区）

```
Host 半区 (Node)
  providers/{volcano,kimi,mimo}.js   ← 各家适配器
  config.json                        ← 凭证，明文本机，不进 git，Host 侧不暴露给前端
  Typert RPC: listPlans() / refresh(provider?)
       │
Client 半区 (React)
  sidebar.panellist 入口 → main keyed 仪表盘页 → 卡片墙
  倒计时前端基于 resetAt 本地跑，不轮询
```

约束：React 从浏览器共享模块表 require；样式只用 `--dsw-alias-*` 主题 token；
禁止 import 宿主 Client 包；文案走 Client locale 服务。
参考模板：`node_modules\@deepseek-ai\dsh-agent-preset\skills\cordis-plugin-development\templates\decoration\`

## 数据模型

```jsonc
{
  "accounts": [                      // 每家当前 1 个，未来支持多账号
    {
      "provider": "volcano",         // volcano | kimi | mimo
      "label": "主账号",
      "credential": { ... },
      "plans": [
        {
          "label": "5 小时限额",
          "window": "5h",            // 5h | weekly | monthly
          "used": 0, "total": 0,
          "resetAt": "...",          // 倒计时依据
          "status": "ok"             // ok | expired | error
        }
      ]
    }
  ]
}
```

## 行为

- 打开页面自动刷新一次 + 手动刷新按钮（不自动轮询，避免触发网页接口风控）
- MiMo cookie 过期：卡片显示"凭证已过期"，引导重新登录并粘贴新 cookie
- 错误/失效状态在卡片上一等公民展示

## 分期

- **V1**：三家全接、卡片墙、手动刷新、MiMo 手动粘贴 cookie + 失效引导
- **V1.1**：MiMo 受控登录窗自动抓 cookie（Host 侧 Playwright/CDP 起受控浏览器，用户登录后自动读 cookie）
  - 备选方案"读本机浏览器 cookie 库"（CodexBar 做法）已否决：Windows Chrome ≥127 App-Bound 加密难解
- **V2 候选**：对话页 dock 迷你摘要（`conversation.composer.dock`）、阈值提醒、消耗预测、Windows Credential Manager 存凭证

## 关键参考资源

- DSH 插件开发权威文档：`<DSH安装目录>\resources\app.asar.unpacked\node_modules\@deepseek-ai\dsh-agent-preset\skills\cordis-plugin-development\`
- 火山：ark-cli（`arkcli usage plan --format json`）、现成 DSH 插件 github.com/ZnonEn/dsh-volcark-quota（参考签名实现）
- Kimi：官方文档 server-api（本地 CLI 服务为备选路径）；CodexBar docs/kimi.md
- MiMo：CodexBar docs/mimo.md 及其源码 MiMo provider
