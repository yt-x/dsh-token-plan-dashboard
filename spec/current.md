# 当前规格：Token Plan Dashboard V1.1

> 生效日期：2026-10-13（V1.1：每 provider 监测开关）。本文件是行为契约的事实源；PLAN.md 为历史方案。

## 范围

V1.1 = V1 全部能力 + 每 provider 监测开关：设置模块内启用/关闭各订阅的监测；卡片墙只展示「已启用 ∧ 已配置凭证」的 provider；关闭不删凭证；保存凭证自动启用；开关持久化于 profile patch，重启与升级保留。

明确不做（V1.1）：自动轮询、多账号、阈值提醒、消耗预测、对话页 dock 迷你摘要、MiMo 受控登录窗抓 cookie（V1.1 候选）、Windows Credential Manager（V2 候选）、插件管理页 bundle 配置页（plugins.bundle.config，延后）。

## 形态

- DSH client plugin，bundle 制：npm 包（`plugin/`）+ `cordis.patch.yml`，包名 `@local/dsh-token-plan-dashboard`。
- 挂载：`sidebar.panellist` 注册图标入口（id `token-plan-dashboard`），同 id 在 `main` keyed slot 注册仪表盘页面。
- 样式只用 `--dsw-alias-*` 主题 token；可见文案走 Client locale 服务（zh/en 字典内联在 client.js）。

## 架构

```
Host 半区（Node，ESM；除 Config 声明用的 @deepseek-ai/schemastery 外零外部依赖，不 import 其他 @deepseek-ai/*）
  plugin/index.js            apply(ctx, config)：声明 Config，注册 3 条 webServer 路由
  plugin/providers/volcano.js  火山 OpenAPI V4 签名 + GetAgentPlanAFPUsage
  plugin/providers/kimi.js     GET api.kimi.com/coding/v1/usages
  plugin/providers/mimo.js     GET platform.xiaomimimo.com/api/v1/{balance,tokenPlan/detail,tokenPlan/usage}
Client 半区（浏览器，ModuleLoader 工厂，React 来自共享模块表）
  plugin/client.js             locale 字典 + panellist 入口 + main 页面（卡片墙 + 设置区：开关 + 凭证表单）
```

Host↔Client 传输：Host 注册 `webServer` HTTP 路由，Client 同源 `fetch`。凭证存取走 `ctx.credentials` 服务，浏览器只能读写，永远看不到已存值。开关读写走 `ctx.configForms`（Client）→ dsh-settings/dsh-config-editor（Host 侧由 DSH 完成，插件代码不直接写配置）。

## Config（监测开关）

```jsonc
{ "monitors": { "kimi": false } }  // dict：显式 false = 关闭；缺省 / true = 启用
```

- Host 声明 `export const Config`（`@deepseek-ai/schemastery`，host 半区唯一豁免的 @deepseek-ai import）：`monitors: z.dict(z.boolean()).volatile()`，默认 `{}`。
- schemastery 解析链：裸 import → DSH Desktop 应用自带副本（可用 `DSH_APP_RESOURCES` 覆盖路径）→ 降级 Config = undefined（安装器不落实 bundle dependencies，见 CONSTRAINTS.md）；降级时开关失效、其余功能正常。
- volatile 字段：修改经 dsh-config-editor 原子写回 profile patch，loader 就地更新运行中 fiber（不重启应用、不重挂插件），并持久化（重启、升级保留）。
- 路由处理函数每次请求读 `config.monitors.get()`（Volatile 引用），读到即最新值。
- 新增 provider 缺省即启用；从代码删除的 provider 残留键无害，忽略。
- Client 经 `ctx.configForms.get('token-plan-dashboard')`（entryId = patch 行 id）读写，自带 revision 乐观锁与失败重读。configForms 为运行时探测（不硬 inject）：服务缺失时设置区开关禁用并显示提示，卡片墙按全部启用渲染。

## Host 路由

| 路由 | 方法 | 请求体 | 响应 |
|---|---|---|---|
| `/dsh-token-plan-dashboard/state` | GET | — | `{ providers: [{ provider, label, enabled, fields: [{ key, label, configured, source, writable }] }], configActive }`；`configActive` = Config 是否成功声明（诊断用） |
| `/dsh-token-plan-dashboard/snapshot` | POST | `{}` 或 `{ provider }` | `{ accounts: [Account], fetchedAt }`；只含**已启用**的 provider |
| `/dsh-token-plan-dashboard/credentials` | POST | `{ provider, values: { key: value } }` | `{ ok: true }`；value 为空串 = 清除该项 |

路由一律返回 JSON；异常以 HTTP 200 + 数据模型内的 error 状态表达（卡片级错误）；参数非法返回 400；凭证写入被只读来源（如环境变量遮蔽）拒绝时返回 502 `credential-rejected`。

- `state` 的 `enabled`：该 provider 当前开关状态（`monitors[id] !== false`）。
- `snapshot`：已关闭的 provider 完全不发起请求、不出现在 accounts；`{ provider }` 指定已关闭的 provider → 200 空 `accounts`；指定未知 id → 400。

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

- 打开仪表盘页自动刷新一次；之后不自动轮询，只有手动刷新按钮。
- 刷新范围 = 已启用的 provider；已关闭的完全不发起请求。
- 卡片墙只渲染「启用 ∧ 凭证已配置」的 provider（ok / expired / error 照常展示）；未配置或已关闭的不上墙。
- 无可展示卡片时显示空态，引导去页底「设置」区启用并配置。
- 设置区（页底，原凭证配置区扩展）：列出全部 provider，每家 = 监测开关 + （启用时的）凭证表单；关闭时表单隐藏、凭证保留；重开后已存凭证直接生效。
- 保存凭证成功（非清除操作）→ Client 自动写 `monitors[provider]=true` 启用该家；清除凭证不动开关。
- 开关修改即时生效（volatile 就地更新）：卡片墙立即增删对应卡片，无需刷新页面或重启应用。
- 倒计时：前端基于 `resetAt` 每秒本地重算，不触发请求。
- MiMo 凭证失效：卡片显示「凭证已过期」+ 重新登录 platform.xiaomimimo.com 复制 cookie 的引导文案。
- 单 provider 取数失败不影响其他 provider 展示。

## 验收判定

1. 全新状态打开页面：无卡片，空态文案指向设置区；设置区列出全部 provider，开关均为开、均显示「未配置」。
2. 配置某家凭证保存后：该家自动启用，刷新后上墙显示真实额度数据（进度条/百分比/倒计时）。
3. 关闭某家开关：卡片立即消失、凭证表单收起、刷新不再请求该家；重开：表单回来、已存凭证仍在、刷新即出数据。
4. 为已关闭的 provider 保存凭证 → 该家自动开启，刷新后上墙。
5. 全部关闭 → 空态；MiMo cookie 故意填错 → 卡片显示「凭证已过期」与引导文案，其他家不受影响。
6. 重启应用后开关状态保留（持久化在 profile patch）。
7. 点手动刷新：数据更新；5 分钟内不点不自动发请求（打开页面的那一次除外）。
8. 倒计时每秒走动，到 0 后显示「等待重置」类文案，不崩溃。
9. 深浅色主题下卡片与设置区均可读（只使用主题 token）。
10. 浏览器控制台无 slot entry crash；credential 值不出现在任何响应体里（state 只回 configured/source/writable，Config 只有布尔开关）。
