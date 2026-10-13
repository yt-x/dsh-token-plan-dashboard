/**
 * Token Plan Dashboard — Host 半区。
 * 注册三条 webServer 路由供 Client 同源 fetch 调用：
 *   GET  /dsh-token-plan-dashboard/state       各 provider 凭证配置状态（绝不回值）
 *   POST /dsh-token-plan-dashboard/snapshot    拉取额度（body 可带 { provider } 只刷一家）
 *   POST /dsh-token-plan-dashboard/credentials 写入/清除凭证（空串 = 清除）
 * 凭证全部走 ctx.credentials 服务；本半区只用 Node 内置模块，不 import 任何 @deepseek-ai/* 包。
 */
import { fetchVolcano } from './providers/volcano.js';
import { fetchKimi } from './providers/kimi.js';
import { fetchMimo } from './providers/mimo.js';

export const name = 'token-plan-dashboard';
export const inject = ['webServer', 'credentials'];

const PREFIX = '/dsh-token-plan-dashboard';

const PROVIDERS = [
  {
    id: 'volcano',
    label: '火山方舟 Agent Plan',
    fetch: fetchVolcano,
    fields: [
      { key: 'VOLC_ARK_ACCESS_KEY_ID', label: 'Access Key ID' },
      { key: 'VOLC_ARK_ACCESS_KEY_SECRET', label: 'Access Key Secret' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi Code',
    fetch: fetchKimi,
    fields: [{ key: 'KIMI_CODE_API_KEY', label: 'API Key' }],
  },
  {
    id: 'mimo',
    label: 'MiMo Token Plan',
    fetch: fetchMimo,
    fields: [
      { key: 'MIMO_SERVICE_TOKEN', label: 'cookie: api-platform_serviceToken' },
      { key: 'MIMO_USER_ID', label: 'cookie: userId' },
    ],
  },
];

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const text = await readBody(req);
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body must be a JSON object');
  return parsed;
}

async function buildAccount(ctx, provider) {
  const base = {
    provider: provider.id,
    label: provider.label,
    configured: false,
    status: 'unconfigured',
    message: '',
    plans: [],
    extras: [],
  };
  const creds = {};
  for (const field of provider.fields) {
    let hit;
    try {
      hit = await ctx.credentials.resolve(field.key);
    } catch {
      hit = undefined;
    }
    if (!hit || !hit.value) return base;
    creds[field.key] = hit.value;
  }
  base.configured = true;
  try {
    const result = await provider.fetch(creds);
    return {
      ...base,
      status: 'ok',
      plans: Array.isArray(result.plans) ? result.plans : [],
      extras: Array.isArray(result.extras) ? result.extras : [],
      planName: result.planName ?? null,
    };
  } catch (err) {
    const kind = err && err.kind === 'expired' ? 'expired' : 'error';
    return { ...base, status: kind, message: String((err && err.message) || err) };
  }
}

async function handleState(ctx, req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { code: 'method-not-allowed' });
  const providers = [];
  for (const p of PROVIDERS) {
    const fields = [];
    for (const f of p.fields) {
      let info;
      try {
        info = await ctx.credentials.describe(f.key);
      } catch {
        info = undefined;
      }
      fields.push({
        key: f.key,
        label: f.label,
        configured: Boolean(info && info.configured),
        source: info && typeof info.source === 'string' ? info.source : null,
        writable: info ? info.writable !== false : true,
      });
    }
    providers.push({ provider: p.id, label: p.label, fields });
  }
  sendJson(res, 200, { providers });
}

async function handleSnapshot(ctx, req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { code: 'method-not-allowed' });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { code: 'bad-request', message: 'request body must be a JSON object' });
  }
  let targets = PROVIDERS;
  if (body.provider !== undefined) {
    targets = PROVIDERS.filter((p) => p.id === body.provider);
    if (targets.length === 0) {
      return sendJson(res, 400, { code: 'bad-request', message: `unknown provider: ${String(body.provider)}` });
    }
  }
  const accounts = await Promise.all(targets.map((p) => buildAccount(ctx, p)));
  sendJson(res, 200, { accounts, fetchedAt: new Date().toISOString() });
}

async function handleCredentials(ctx, req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { code: 'method-not-allowed' });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { code: 'bad-request', message: 'request body must be a JSON object' });
  }
  const provider = PROVIDERS.find((p) => p.id === body.provider);
  if (!provider) {
    return sendJson(res, 400, { code: 'bad-request', message: `unknown provider: ${String(body.provider)}` });
  }
  const values = body.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return sendJson(res, 400, { code: 'bad-request', message: 'values must be an object' });
  }
  const entries = Object.entries(values);
  for (const [key, value] of entries) {
    if (!provider.fields.some((f) => f.key === key)) {
      return sendJson(res, 400, { code: 'bad-request', message: `unknown credential field: ${key}` });
    }
    if (typeof value !== 'string') {
      return sendJson(res, 400, { code: 'bad-request', message: `credential ${key} must be a string` });
    }
  }
  try {
    for (const [key, value] of entries) {
      const trimmed = value.trim();
      if (trimmed === '') await ctx.credentials.unset(key);
      else await ctx.credentials.set(key, trimmed);
    }
  } catch (err) {
    // 环境变量遮蔽等只读来源会拒绝写入；把原因带回页面而不是让请求悬挂。
    return sendJson(res, 502, {
      code: 'credential-rejected',
      message: String((err && err.message) || err),
    });
  }
  sendJson(res, 200, { ok: true });
}

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${PREFIX}/state`,
        handler: (req, res) => handleState(ctx, req, res),
      }),
    'token-plan-dashboard: state route',
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${PREFIX}/snapshot`,
        handler: (req, res) => handleSnapshot(ctx, req, res),
      }),
    'token-plan-dashboard: snapshot route',
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${PREFIX}/credentials`,
        handler: (req, res) => handleCredentials(ctx, req, res),
      }),
    'token-plan-dashboard: credentials route',
  );
}
