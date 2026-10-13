// 火山方舟 Agent Plan（个人版）：官方 OpenAPI GetAgentPlanAFPUsage。
// 签名实现参考 ZnonEn/dsh-volcark-quota（火山 V4 HMAC-SHA256，service=ark）。
import { createHash, createHmac } from 'node:crypto';
import { expired, failure } from './provider-error.js';

const VOLC_HOST = 'open.volcengineapi.com';
const VOLC_REGION = 'cn-beijing';
const VOLC_SERVICE = 'ark';
const VOLC_VERSION = '2024-01-01';
const ACTION = 'GetAgentPlanAFPUsage';

const WINDOW_DEFS = [
  ['AFPFiveHour', '5h'],
  ['AFPWeekly', 'weekly'],
  ['AFPMonthly', 'monthly'],
];

function formatXDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function normalizeQuery(query) {
  return Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');
}

function sign(ak, sk, method, path, query, body) {
  const xDate = formatXDate(new Date());
  const xDateShort = xDate.slice(0, 8);
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const rawHeaders = {
    Host: VOLC_HOST,
    'X-Date': xDate,
    'X-Content-Sha256': bodyHash,
    'Content-Type': 'application/json',
  };
  const signed = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lk = k.toLowerCase();
    if (lk === 'content-type' || lk === 'host' || lk.startsWith('x-')) signed[lk] = v;
  }
  const shKeys = Object.keys(signed).sort();
  const signedStr = shKeys.map((k) => `${k}:${signed[k]}\n`).join('');
  const signedHeaders = shKeys.join(';');
  const canonicalRequest = [method, path, normalizeQuery(query), signedStr, signedHeaders, bodyHash].join('\n');
  const credentialScope = `${xDateShort}/${VOLC_REGION}/${VOLC_SERVICE}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    xDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');
  const hmac = (key, data) => createHmac('sha256', key).update(data, 'utf8').digest();
  const kDate = hmac(sk, xDateShort);
  const kRegion = hmac(kDate, VOLC_REGION);
  const kService = hmac(kRegion, VOLC_SERVICE);
  const kSigning = hmac(kService, 'request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  return {
    ...rawHeaders,
    Authorization:
      `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export async function fetchVolcano(creds) {
  const ak = creds.VOLC_ARK_ACCESS_KEY_ID;
  const sk = creds.VOLC_ARK_ACCESS_KEY_SECRET;
  const query = { Action: ACTION, Version: VOLC_VERSION };
  const body = '{}';
  const headers = sign(ak, sk, 'POST', '/', query, body);

  let res;
  try {
    res = await fetch(`https://${VOLC_HOST}/?${normalizeQuery(query)}`, {
      method: 'POST',
      headers,
      body,
    });
  } catch (err) {
    throw failure(`网络错误：${err && err.message ? err.message : err}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw expired('AK/SK 无效或已过期，请检查火山引擎访问密钥');
  }
  if (!res.ok) throw failure(`HTTP ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw failure('响应不是合法 JSON');
  }
  const metaError = data && data.ResponseMetadata && data.ResponseMetadata.Error;
  if (metaError) {
    const code = metaError.Code || 'unknown';
    const message = metaError.Message || 'unknown error';
    if (/auth|credential|signature|denied|forbidden/i.test(String(code))) {
      throw expired(`火山引擎拒绝访问：${code} ${message}`);
    }
    throw failure(`${code}: ${message}`);
  }
  const result = data && data.Result;
  if (!result || typeof result !== 'object') throw failure('响应缺少 Result 字段');

  const plans = [];
  for (const [key, window] of WINDOW_DEFS) {
    const w = result[key];
    if (!w || typeof w !== 'object') continue;
    const total = Number(w.Quota);
    const used = Number(w.Used);
    if (!Number.isFinite(total) || !Number.isFinite(used)) continue;
    const resetMs = Number(w.ResetTime);
    plans.push({
      window,
      used,
      total,
      percent: total > 0 ? (used / total) * 100 : null,
      resetAt: Number.isFinite(resetMs) && resetMs > 0 ? new Date(resetMs).toISOString() : null,
      status: 'ok',
    });
  }
  if (plans.length === 0) throw failure('响应中没有任何 AFP 窗口数据');
  return { plans, extras: [] };
}
