# 上游接口参考

类型：reference。本文只记**上游服务的客观行为**（端点、签名、字段、错误语义），不记本插件怎么实现——实现读代码。
每条事实标证据等级：

- **已核验**：在可读的一手实现或官方响应样本里亲眼确认（写明来源）。
- **未核实**：来自二手转述或推断，尚未独立确认。

本文不含任何第三方项目的文件路径、函数名或设计选择。

---

## 1. 火山方舟（Volcengine Ark）Agent Plan

### 1.1 端点与身份

| 项 | 值 | 证据 |
|---|---|---|
| 网关 | `https://open.volcengineapi.com/`（**控制面**；数据面推理域名是 `ark.cn-beijing.volces.com`，两者不是一回事） | 已核验 |
| 方法 / body | `POST`，空 body 或 `{}` | 已核验 |
| Query | `Action` / `Version=2024-01-01` / `Region`（本插件固定 `cn-beijing`） | 已核验 |
| 签名 service | `ark` | 已核验 |
| Content-Type | `application/json; charset=utf-8` | 已核验 |

Region 在通用实现里由数据面 base_url 的 `cn-*` / `ap-*` 段推导，无法识别时回落 `cn-beijing`。
本插件只服务国内个人版，**硬编码 `cn-beijing` 是有意的简化**，不是遗漏。

### 1.2 签名 V4 与 AWS SigV4 的两处致命差异

这是本接口最容易踩的地方。算法整体是 AWS SigV4 的火山变体，但有两处不同，**照搬标准 SigV4 实现必然签名失败**：

1. **canonical headers 与 SignedHeaders 用固定顺序** `host;x-date;x-content-sha256;content-type`，**不是字母序**。标准 SigV4（如 s3）用的是字母序。
2. **算法串与派生链差异**：algorithm 串为 `HMAC-SHA256`（**无 `AWS4` 前缀**）、credential scope 结尾为 `request`（**非 `aws4_request`**）、`kDate = HMAC(SK, date)`（**SK 不加 `AWS4` 前缀**）。

canonical query 仍按 key 字母序（与标准 SigV4 一致）。

完整派生链：

```
canonical_request = "{method}\n{path}\n{canonical_query}\n{canonical_headers}\n{SIGNED_HEADERS}\n{x_content_sha256}"
credential_scope  = "{YYYYMMDD}/{region}/ark/request"
string_to_sign    = "HMAC-SHA256\n{x_date}\n{credential_scope}\n{sha256hex(canonical_request)}"

kDate    = HMAC(SK, short_date)      // 注意：SK 不加 "AWS4" 前缀
kRegion  = HMAC(kDate, region)
kService = HMAC(kRegion, "ark")
kSigning = HMAC(kService, "request") // 终止串是 "request"，不是 "aws4_request"
signature = hex(HMAC(kSigning, string_to_sign))

Authorization = "HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders=host;x-date;x-content-sha256;content-type, Signature={sig}"
```

> **本插件状态**：派生链与上表一致；但 SignedHeaders 的构造与"固定顺序"要求存在差异，**该路径尚未实机验证**。详见 CONSTRAINTS.md。

### 1.3 `GetAgentPlanAFPUsage` 响应

顶层 `Result` 下三个窗口对象，字段为**绝对额度**（非百分比）：

| 字段路径 | 含义 |
|---|---|
| `Result.AFPFiveHour.Quota` / `.Used` / `.ResetTime` | 5 小时窗口 |
| `Result.AFPWeekly.Quota` / `.Used` / `.ResetTime` | 周窗口 |
| `Result.AFPMonthly.Quota` / `.Used` / `.ResetTime` | 月窗口 |
| `Result.PlanType` | 套餐类型字符串（如 `"Large"`），可用作展示名 |
| `Result.SubscribeTime` | 订阅时间（毫秒） |

- 已用百分比 = `Used / Quota × 100`。
- `Quota <= 0` 表示该窗口未订阅/未启用，**应跳过**。
- `ResetTime` 为**毫秒**时间戳（官方样本形如 `1778806800000`）。

**`AFPDaily` 必须跳过**：它真实存在于响应中，但官方控制台不展示它，其 `Quota` 常高于周上限，属历史默认值而非强制限额。把它当限额展示会低估用户可用余量。

**信封容错**：响应可能**没有 `Result` 外层**（直接是窗口对象），解析时应兼容 `body.Result ?? body`；缺 `Result` 不等于失败。

**Coding Plan 是独立订阅**：`GetCodingPlanUsage` 是另一个 Action，对应 Coding Plan 订阅，**与 Agent Plan 不共享额度**，两者共用同一份 AK/SK。其响应形如 `Result.QuotaUsage[].{Level, Percent, ResetTimestamp}`，**只给百分比**，`ResetTimestamp` 为**秒级**，`session` 无活跃窗口时回 `-1`（表示无重置时间）。本插件不实现该 Action，此处仅记以免与 Agent Plan 混淆。

> **Action 名注记**：另有第三方实现使用 `GetAFPUsage` 调用本接口。它与本插件使用的 `GetAgentPlanAFPUsage` 是否同一 Action 的不同别名，**未核实**（见 CONSTRAINTS.md）。本插件沿用 `GetAgentPlanAFPUsage`。

---

## 2. Kimi Code（月之暗面）

| 项 | 值 | 证据 |
|---|---|---|
| 端点 | `GET https://api.kimi.com/coding/v1/usages` | 已核验 |
| 认证 | `Authorization: Bearer <API Key>` | 已核验 |
| 其它头 | `Accept: application/json` | 已核验 |

响应里有**三套并存的额度结构**，同一窗口可能同时存在计数制与比率制两个来源：

| 路径 | 形态 | 对应窗口 |
|---|---|---|
| `limits[0].detail` → `limit` / `used` / `remaining` / `resetTime` | 计数制，滚动限流 | 5h |
| `usage` → `limit` / `used` / `remaining` / `resetTime` | 计数制，旧版计数池 | 7 天周配额 |
| `usages.limit_5h` → `used_ratio` / `reset_time` | 比率制（0..1），新版 | 5h |
| `usages.limit_7d` → `used_ratio` / `reset_time` | 比率制，新版 | 7 天 |
| `usages.limit_month_total` → `used_ratio` / `reset_time` | 比率制，新版 | 月 |

- `limit` / `used` / `remaining` 可能是**字符串整数**，需容忍。
- `resetTime` 为 RFC3339 字符串，**可带 9 位纳秒**（如 `...T00:00:00.123456789Z`），标准 `Date` 解析会失败，需截断到毫秒。
- `used` 可直接取 `detail.used`；由 `limit - remaining` 推导是等价但更脆的写法。
- HTTP 401 = 凭证失效；403 = 权限/配额被拒（**语义不同于 401**，不应提示用户去换 Key）。

---

## 3. 小米 MiMo Token Plan

**该产品无公开官方 API**，下列端点取自控制台前端内部接口，会随前端改版而变。

| 端点 | 作用 |
|---|---|
| `GET https://platform.xiaomimimo.com/api/v1/balance` | 账户余额（硬依赖） |
| `GET https://platform.xiaomimimo.com/api/v1/tokenPlan/detail` | 套餐详情：`planCode` / `currentPeriodEnd` / `expired` |
| `GET https://platform.xiaomimimo.com/api/v1/tokenPlan/usage` | 用量：`monthUsage.items[0]` 的 `used` / `limit`（Credits） |

- 认证**仅靠 Cookie**：`api-platform_serviceToken` + `userId`；**无 CSRF token**。
- **必须 `redirect: 'manual'`**：登录态过期时服务端以 3xx 重定向进登录流程，跟随重定向会拿到 HTML 登录页而非错误码，无法判失效。
- 失效判定要覆盖四种：3xx、401、403、**HTTP 200 但信封 `code` 为 401/403**。
- `currentPeriodEnd` 格式为 `yyyy-MM-dd HH:mm:ss`（**无时区标注**），按 UTC 解析是跟随参考实现的假设，**时区归属未核实**（见 CONTEXT.md 待确认区）。
- `percent` 字段语义存疑（0..1 或 0..100 均有实现采用），**未核实**，需防御式处理。

### 域名区分（易混淆）

小米存在多个不同用途的域名，**不可互相替换**：

| 域名 | 用途 |
|---|---|
| `platform.xiaomimimo.com` | 控制台 / 本插件使用的额度接口所在 |
| `token-plan-cn.xiaomimimo.com` | token-plan **推理**专用域名（数据面），**不提供额度查询** |
| `api.xiaomimimo.com` | 推理 API |

---

## 4. 三家对比速查

| | 火山方舟 | Kimi Code | MiMo |
|---|---|---|---|
| 凭证类型 | AK/SK（**与推理 Key 分离**） | API Key | Cookie（会过期） |
| 端点性质 | 控制面 OpenAPI + 签名 V4 | 数据面 REST + Bearer | 控制台内部接口 |
| 额度语义 | 绝对额度（Quota/Used） | 计数制与比率制并存 | Credits（计数制） |
| 窗口 | 5h / 周 / 月 | 5h / 7 天 / 月 | 月 |
| 重置时间 | 毫秒时间戳 | RFC3339（可带纳秒） | `yyyy-MM-dd HH:mm:ss` |
| 官方文档 | 有（控制面 API） | 有 | **无**（内部接口） |

---

## 变更日志

- 2026-10-13：建文件。内容来自对三家上游接口的调研核验；事实按证据等级标注，未核实项已单独标出。
