// Kimi Code：GET https://api.kimi.com/coding/v1/usages（Bearer API Key）。
// 响应字段结构参考 CodexBar Sources/CodexBarCore/Providers/Kimi 与 docs/kimi.md：
//   usage   —— 旧版计数池（7 天周配额，limit/used/remaining 为字符串整数，resetTime RFC3339 可带纳秒）
//   usages  —— 新版比率池（limit_5h / limit_7d / limit_month_total，used_ratio 0..1 + reset_time）
//   limits  —— 滚动限流（limits[0] 为 5 小时窗口，detail 同 usage 结构）
import { expired, failure } from './provider-error.js';

const USAGES_URL = 'https://api.kimi.com/coding/v1/usages';

/** RFC3339（可带 9 位纳秒）→ ISO 毫秒字符串；非法输入返回 null。 */
function toISO(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1');
  const time = new Date(trimmed).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** 计数制窗口条目；字段缺失返回 null。limit/used 容忍字符串整数。 */
function countPlan(window, detail) {
  if (!detail || typeof detail !== 'object') return null;
  const total = Number(detail.limit);
  const used = Number(detail.used);
  if (!Number.isFinite(total) || !Number.isFinite(used) || total <= 0) return null;
  return {
    window,
    used,
    total,
    percent: (used / total) * 100,
    resetAt: toISO(detail.resetTime ?? detail.reset_time ?? detail.resetAt),
    status: 'ok',
  };
}

/** 比率制窗口条目（used_ratio 0..1）。 */
function ratioPlan(window, pool) {
  if (!pool || typeof pool !== 'object') return null;
  const ratio = Number(pool.used_ratio);
  if (!Number.isFinite(ratio)) return null;
  return {
    window,
    used: null,
    total: null,
    percent: ratio * 100,
    resetAt: toISO(pool.reset_time ?? pool.resetTime),
    status: 'ok',
  };
}

/** 同一窗口存在计数与比率两个来源时，取更耗尽（percent 更大）的一个。 */
function moreExhausted(a, b) {
  if (!a) return b;
  if (!b) return a;
  const pa = a.percent ?? -1;
  const pb = b.percent ?? -1;
  return pb > pa ? b : a;
}

export async function fetchKimi(creds) {
  let res;
  try {
    res = await fetch(USAGES_URL, {
      headers: {
        authorization: `Bearer ${creds.KIMI_CODE_API_KEY}`,
        accept: 'application/json',
      },
    });
  } catch (err) {
    throw failure(`网络错误：${err && err.message ? err.message : err}`);
  }

  if (res.status === 401) throw expired('API Key 无效或已过期，请到 kimi.com/code/console 重新创建');
  if (res.status === 403) throw failure('HTTP 403：权限或配额被拒绝');
  if (!res.ok) throw failure(`HTTP ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw failure('响应不是合法 JSON');
  }
  if (!data || typeof data !== 'object') throw failure('响应结构不符');

  const usages = data.usages && typeof data.usages === 'object' ? data.usages : {};
  const limits = Array.isArray(data.limits) ? data.limits : [];
  const firstLimitDetail = limits.length > 0 ? limits[0] && limits[0].detail : null;

  const plans = [
    moreExhausted(countPlan('5h', firstLimitDetail), ratioPlan('5h', usages.limit_5h)),
    moreExhausted(countPlan('weekly', data.usage), ratioPlan('weekly', usages.limit_7d)),
    ratioPlan('monthly', usages.limit_month_total),
  ].filter(Boolean);

  if (plans.length === 0) throw failure('响应中没有任何额度窗口数据');
  return { plans, extras: [] };
}
