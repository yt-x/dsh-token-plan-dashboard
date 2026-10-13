// 小米 MiMo Token Plan：platform.xiaomimimo.com 控制台内部接口（无官方 API）。
// 端点与失效判定参考 CodexBar Sources/CodexBarCore/Providers/MiMo 与 docs/mimo.md：
//   GET /api/v1/balance           硬依赖，失败即账号失败
//   GET /api/v1/tokenPlan/detail  best-effort（planCode / currentPeriodEnd / expired）
//   GET /api/v1/tokenPlan/usage   best-effort（monthUsage.items[0] 的 used/limit，Credits）
// 认证仅靠 Cookie：api-platform_serviceToken + userId；无 CSRF token。
import { expired, failure } from './provider-error.js';

const BASE = 'https://platform.xiaomimimo.com/api/v1';

const EXPIRED_MESSAGE = '登录态已失效：请重新登录 platform.xiaomimimo.com 并粘贴新的 cookie';

function cookieHeader(creds) {
  // CodexBar 只保留已知 cookie 名并按字母序排列；我们只有两个必需值。
  return `api-platform_serviceToken=${creds.MIMO_SERVICE_TOKEN}; userId=${creds.MIMO_USER_ID}`;
}

async function get(creds, path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      redirect: 'manual', // 过期会话会被重定向进登录流程，必须拦下 3xx
      headers: {
        accept: 'application/json, text/plain, */*',
        cookie: cookieHeader(creds),
      },
    });
  } catch (err) {
    throw failure(`网络错误：${err && err.message ? err.message : err}`);
  }
  if (res.status >= 300 && res.status < 400) throw expired(EXPIRED_MESSAGE);
  if (res.status === 401 || res.status === 403) throw expired(EXPIRED_MESSAGE);
  if (!res.ok) throw failure(`HTTP ${res.status}`);
  let body;
  try {
    body = await res.json();
  } catch {
    throw failure('响应不是合法 JSON');
  }
  if (!body || typeof body !== 'object') throw failure('响应结构不符');
  if (body.code === 401 || body.code === 403) throw expired(EXPIRED_MESSAGE);
  if (body.code !== 0) throw failure(typeof body.message === 'string' && body.message ? body.message : `接口返回 code ${body.code}`);
  return body.data ?? null;
}

/** 'yyyy-MM-dd HH:mm:ss' → ISO。跟随 CodexBar 按 UTC 解析（时区存疑见 CONTEXT.md）。 */
function parsePeriodEnd(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const time = new Date(`${value.replace(' ', 'T')}Z`).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export async function fetchMimo(creds) {
  const [balance, detail, usage] = await Promise.all([
    get(creds, '/balance'),
    get(creds, '/tokenPlan/detail').catch(() => null),
    get(creds, '/tokenPlan/usage').catch(() => null),
  ]);

  if (detail && detail.expired === true) {
    throw expired('Token Plan 套餐已过期，请续订');
  }

  const plans = [];
  const monthUsage = usage && typeof usage === 'object' ? usage.monthUsage : null;
  const item =
    monthUsage && Array.isArray(monthUsage.items) && monthUsage.items.length > 0
      ? monthUsage.items[0]
      : null;
  if (item && Number.isFinite(Number(item.used)) && Number.isFinite(Number(item.limit))) {
    const used = Number(item.used);
    const total = Number(item.limit);
    // percent 语义存疑（0..1 或 0..100），防御式处理：>1 视为已是百分数。
    let percent = null;
    if (Number.isFinite(Number(item.percent))) {
      const raw = Number(item.percent);
      percent = raw > 1 ? raw : raw * 100;
    } else if (total > 0) {
      percent = (used / total) * 100;
    }
    plans.push({
      window: 'monthly',
      used,
      total,
      percent,
      resetAt: parsePeriodEnd(detail && detail.currentPeriodEnd),
      status: 'ok',
    });
  }

  const extras = [];
  if (balance && typeof balance === 'object' && typeof balance.balance === 'string' && balance.balance) {
    const currency = typeof balance.currency === 'string' && balance.currency ? balance.currency : '';
    extras.push({ key: 'balance', value: `${balance.balance} ${currency}`.trim() });
  }

  if (plans.length === 0 && extras.length === 0) {
    throw failure('接口可用但未返回套餐或余额数据');
  }

  const planCode = detail && typeof detail.planCode === 'string' && detail.planCode ? detail.planCode : null;
  const planName = planCode ? planCode.charAt(0).toUpperCase() + planCode.slice(1) : null;
  return { plans, extras, planName };
}
