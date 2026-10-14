/**
 * Token Plan Dashboard — Host 半区。
 * 注册三条 webServer 路由供 Client 同源 fetch 调用：
 *   GET  /dsh-token-plan-dashboard/state       各 provider 凭证配置状态与监测开关（绝不回值）
 *   POST /dsh-token-plan-dashboard/snapshot    拉取额度（只含已启用的 provider；body 可带 { provider } 只刷一家）
 *   POST /dsh-token-plan-dashboard/credentials 写入/清除凭证（空串 = 清除）
 * 凭证全部走 ctx.credentials 服务；本半区除 Config 声明用的 @deepseek-ai/schemastery
 * （唯一豁免，见 decisions/0003）外只用 Node 内置模块，不 import 任何 @deepseek-ai/* 包。
 *
 * 监测开关：Config.monitors 是 dict（显式 false = 关闭，缺省/true = 启用），
 * volatile 字段——用户修改经 dsh-config-editor 写回 profile patch 并就地热更新，
 * 路由每次请求读 config.monitors.get()，读到即最新值。
 */
import { fetchVolcano } from './providers/volcano.js';
import { fetchKimi } from './providers/kimi.js';
import { fetchMimo } from './providers/mimo.js';

// schemastery 解析链（DSH Desktop 的 bundle 安装器不会落实 dependencies——lock 有记录、
// 文件不落盘，见 CONSTRAINTS.md，所以包级依赖只是声明，运行时必须兜底）：
//   1) 裸 import：依赖正常安装的环境（以及未来的安装器）走这里；
//   2) 应用自带副本：host 进程是 Electron 主进程时 process.resourcesPath 即 resources 根；
//      实测 DSH Desktop 的 host 跑在应用自带 node.exe（路径形如
//      resources/app.asar.unpacked/node_modules/node/bin/node.exe），此时从 execPath
//      逐级向上枚举祖先目录，按 app.asar.unpacked/node_modules 与 node_modules 两种前缀
//      探测；也可用 DSH_APP_RESOURCES 环境变量直接指定 resources 根；
//   3) 都失败则 Config = undefined 降级：cordis 跳过配置校验、设置通道不含本 entry，
//      开关功能失效但其余功能正常（本地冒烟即此路径）。
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SCHEMATERY_REL = ['node_modules', '@deepseek-ai', 'schemastery', 'lib', 'index.mjs'];

function* resourcesRootCandidates() {
  if (process.env.DSH_APP_RESOURCES) yield process.env.DSH_APP_RESOURCES;
  if (process.resourcesPath) yield process.resourcesPath;
  let dir = process.execPath ? path.dirname(process.execPath) : '';
  while (dir && path.dirname(dir) !== dir) {
    yield dir;
    dir = path.dirname(dir);
  }
}

async function loadSchemastery() {
  try {
    return (await import('@deepseek-ai/schemastery')).default;
  } catch { /* 继续兜底 */ }
  for (const root of resourcesRootCandidates()) {
    for (const base of [path.join(root, 'app.asar.unpacked'), root]) {
      const entry = path.join(base, ...SCHEMATERY_REL);
      if (!existsSync(entry)) continue;
      try {
        return (await import(pathToFileURL(entry).href)).default;
      } catch { /* 试下一个候选路径 */ }
    }
  }
  return null;
}

const z = await loadSchemastery();
if (!z) {
  console.warn('[token-plan-dashboard] @deepseek-ai/schemastery unavailable, monitor toggles disabled');
}

export const Config = z
  ? z.object({
      // 每 provider 监测开关：显式 false = 关闭；缺省 / true = 启用（新增 provider 默认启用）。
      monitors: z.dict(z.boolean()).volatile(),
    })
  : undefined;

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

// config.monitors 生产环境是 Volatile 引用（.get() 读值）；冒烟里是 plain object 或缺省，都做防御。
function readMonitors(config) {
  const field = config && config.monitors;
  const value = field && typeof field.get === 'function' ? field.get() : field;
  return value && typeof value === 'object' ? value : {};
}

function isEnabled(config, id) {
  return readMonitors(config)[id] !== false;
}

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

async function handleState(ctx, config, req, res) {
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
    providers.push({ provider: p.id, label: p.label, enabled: isEnabled(config, p.id), fields });
  }
  // configActive：诊断字段——Config 是否成功声明（schemastery 解析链是否命中）。
  sendJson(res, 200, { providers, configActive: Boolean(Config) });
}

async function handleSnapshot(ctx, config, req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { code: 'method-not-allowed' });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { code: 'bad-request', message: 'request body must be a JSON object' });
  }
  if (body.provider !== undefined && !PROVIDERS.some((p) => p.id === body.provider)) {
    return sendJson(res, 400, { code: 'bad-request', message: `unknown provider: ${String(body.provider)}` });
  }
  // 已关闭的 provider 完全不发起请求、不出现在 accounts（指定已关闭的 provider → 空 accounts）。
  let targets = PROVIDERS.filter((p) => isEnabled(config, p.id));
  if (body.provider !== undefined) {
    targets = targets.filter((p) => p.id === body.provider);
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

export function apply(ctx, config) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${PREFIX}/state`,
        handler: (req, res) => handleState(ctx, config, req, res),
      }),
    'token-plan-dashboard: state route',
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${PREFIX}/snapshot`,
        handler: (req, res) => handleSnapshot(ctx, config, req, res),
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
