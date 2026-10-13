# 当前规格：Token Plan Dashboard V1

> 生效日期：2026-10-13。本文件是行为契约的事实源；PLAN.md 为历史方案。

## 范围

V1 做且只做：三家订阅（火山方舟 Agent Plan 个人版 / Kimi Code / 小米 MiMo Token Plan）的额度只读展示、侧边栏入口 + 主区仪表盘页、打开自动刷新一次 + 手动刷新、页内凭证表单、失效状态一等公民展示。

明确不做（V1）：自动轮询、多账号、阈值提醒、消耗预测、对话页 dock 迷你摘要、MiMo 受控登录窗抓 cookie（V1.1）、Windows Credential Manager（V2 候选）。

## 形态

- DSH client plugin，bundle 制：npm 包（`plugin/`）+ `cordis.patch.yml`，包名 `@local/dsh-token-plan-dashboard`。
- 挂载：`sidebar.panellist` 注册图标入口（id `token-plan-dashboard`），同 id 在 `main` keyed slot 注册仪表盘页面。
- 样式只用 `--dsw-alias-*` 主题 token；可见文案走 Client locale 服务（zh/en 字典内联在 client.js）。

## 架构

```
Host 半区（Node，ESM，零外部依赖，不 import @deepseek-ai/*）
  plugin/index.js            apply(ctx)：注册 3 条 webServer 路由
  plugin/providers/volcano.js  火山 OpenAPI V4 签名 + GetAgentPlanAFPUsage
  plugin/providers/kimi.js     GET api.kimi.com/coding/v1/usages
  plugin/providers/mimo.js     GET platform.xiaomimimo.com/api/v1/{balance,tokenPlan/detail,tokenPlan/usage}
Client 半区（浏览器，ModuleLoader 工厂，React 来自共享模块表）
  plugin/client.js             locale 字典 + panellist 入口 + main 页面（卡片墙 + 凭证表单）
```

Host↔Client 传输：Host 注册 `webServer` HTTP 路由，Client 同源 `fetch`。凭证存取走 `ctx.credentials` 服务，浏览器只能读写，永远看不到已存值。

## Host 路由

| 路由 | 方法 | 请求体 | 响应 |
|---|---|---|---|
| `/dsh-token-plan-dashboard/state` | GET | — | `{ providers: [{ provider, label, fields: [{ key, label, configured, source }] }] }` |
| `/dsh-token-plan-dashboard/snapshot` | POST | `{}` 或 `{ provider }` | `{ accounts: [Account], fetchedAt }` |
| `/dsh-token-plan-dashboard/credentials` | POST | `{ provider, values: { key: value } }` | `{ ok: true }`；value 为空串 = 清除该项 |

路由一律返回 JSON；异常以 HTTP 200 + 数据模型内的 error 状态表达（卡片级错误）；参数非法返回 400；凭证写入被只读来源（如环境变量遮蔽）拒绝时返回 502 `credential-rejected`。

## 数据模型

```jsonc
{
  "accounts": [
    {
      "provider": "volcano",        // volcano | kimi | mimo
      "label": "火山方舟 Agent Plan",
      "planName": "Pro",            // 可选：套餐名（MiMo 来自 planCode），无则 null
      "configured": true,           // 凭证是否齐备
      "status": "ok",               // ok | unconfigured | expired | error
      "message": "",                // status 非 ok 时的用户可读说明
      "plans": [
        {
          "window": "5h",           // 5h | weekly | monthly；展示名由 Client 按 window 走 locale
          "used": 120, "total": 200,  // 计数制窗口；比率制窗口为 null
          "percent": 60,            // 0-100，两种窗口都有
          "resetAt": "2026-10-13T20:00:00.000Z",  // ISO8601；无则 null
          "status": "ok"            // ok | error（单窗口取数失败）
        }
      ],
      "extras": [{ "key": "balance", "value": "12.30 CNY" }]  // 附加信息；展示名由 Client 按 key 走 locale
    }
  ]
}
```

## 各 provider 取数契约

### volcano（火山方舟 Agent Plan 个人版）
- 凭证：`VOLC_ARK_ACCESS_KEY_ID` + `VOLC_ARK_ACCESS_KEY_SECRET`（credentials ref，与同名环境变量自然互通）。
- 请求：`POST https://open.volcengineapi.com/?Action=GetAgentPlanAFPUsage&Version=2024-01-01`，body `{}`，V4 HMAC-SHA256 签名（region cn-beijing，service ark）。
- 解析：`Result.AFPFiveHour / AFPWeekly / AFPMonthly`，各含 `Quota / Used / ResetTime`（毫秒时间戳）→ 三张窗口卡（5h / weekly / monthly）。
- 失效判定：HTTP 401/403 或响应体含 `ResponseMetadata.Error` → expired/error。

### kimi（Kimi Code）
- 凭证：`KIMI_CODE_API_KEY`。
- 请求：`GET https://api.kimi.com/coding/v1/usages`，`Authorization: Bearer <key>`。
- 解析（三选一取更耗尽者，按窗口归并）：
  - 5h：`limits[0].detail`（limit/used/remaining/resetTime，计数制）；缺则 `usages.limit_5h`（used_ratio 0..1 + reset_time，比率制）。
  - weekly：`usage`（limit/used/resetTime，计数制）；缺则 `usages.limit_7d`（比率制）。
  - monthly：`usages.limit_month_total`（比率制）。
  - resetTime 为可带纳秒的 RFC3339 字符串，统一转 ISO 毫秒。
- 失效判定：HTTP 401 → expired；403 → error。

### mimo（小米 MiMo Token Plan）
- 凭证：`MIMO_SERVICE_TOKEN`（cookie `api-platform_serviceToken`）+ `MIMO_USER_ID`（cookie `userId`）。
- 请求（三个并发 GET，Cookie 头认证，无 CSRF）：
  - `GET /api/v1/balance`（硬依赖，失败即账号 error/expired）
  - `GET /api/v1/tokenPlan/detail`（best-effort：planCode、currentPeriodEnd、expired）
  - `GET /api/v1/tokenPlan/usage`（best-effort：monthUsage.items[0] 的 used/limit Credits）
- 解析：月度 Credits 卡 = usage.used / usage.limit，resetAt = detail.currentPeriodEnd（`yyyy-MM-dd HH:mm:ss`，按 UTC 解析，跟随 CodexBar；时区存疑见 CONTEXT.md）；balance → extras 余额行。
- 失效判定：HTTP 3xx（须 redirect:'manual'）或 401 → expired（引导重新登录粘贴 cookie）；403 → expired；HTTP 200 但信封 `code` 为 401/403 同样判 expired；其他非 0 code → error 带 message。

## 行为

- 打开仪表盘页自动刷新一次（仅取已配置凭证的 provider）；之后不自动轮询，只有手动刷新按钮。
- 倒计时：前端基于 `resetAt` 每秒本地重算，不触发请求。
- 未配置凭证的 provider 展示「未配置」卡片 + 展开凭证表单的引导。
- MiMo 凭证失效：卡片显示「凭证已过期」+ 重新登录 platform.xiaomimimo.com 复制 cookie 的引导文案。
- 单 provider 取数失败不影响其他 provider 展示。

## 验收判定

1. 未配置任何凭证时打开页面：三张「未配置」卡，无报错。
2. 配置某家凭证后保存：该家卡片在下次刷新显示真实额度数据（进度条/百分比/倒计时）。
3. MiMo cookie 故意填错：卡片显示「凭证已过期」与引导文案，其他家不受影响。
4. 点手动刷新：数据更新；5 分钟内不点不自动发请求（打开页面的那一次除外）。
5. 倒计时每秒走动，到 0 后显示「等待重置」类文案，不崩溃。
6. 深浅色主题下卡片均可读（只使用主题 token）。
7. 浏览器控制台无 slot entry crash；credential 值不出现在任何响应体里（state 只回 configured/source）。
