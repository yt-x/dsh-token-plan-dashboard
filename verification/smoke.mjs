// V1 冒烟脚本（一次性探针，非测试套件）：
// 1) 用 mock ctx 挂载 plugin/index.js，验证 state/snapshot/credentials 三条路由的形状与参数校验。
// 2) 用假凭证真实调三家接口，验证失效判定路径能走到 expired/error（不验证真实额度数据）。
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const pluginDir = path.resolve(import.meta.dirname, '..', 'plugin');

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    end(text) { this.body = text ?? ''; },
  };
}

function mockReq(method, body) {
  return {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    on(event, cb) {
      if (event === 'data' && body !== undefined) setImmediate(() => cb(Buffer.from(body)));
      if (event === 'end') setImmediate(() => cb());
      return this;
    },
    destroy() {},
  };
}

const routes = {};
const ctx = {
  webServer: {
    register(route) {
      routes[route.path] = route.handler;
      return () => {};
    },
  },
  credentials: {
    resolve: async () => undefined,
    describe: async () => ({ configured: false }),
    set: async () => {},
    unset: async () => {},
  },
  effect(fn) { fn(); },
};

const host = await import(pathToFileURL(path.join(pluginDir, 'index.js')).href);
host.apply(ctx);

const paths = Object.keys(routes).sort();
console.log('registered routes:', paths.join(', '));
if (paths.length !== 3) throw new Error('expected 3 routes');

// state：无凭证时三个 provider 全部 configured=false
{
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/state'](mockReq('GET'), res);
  const json = JSON.parse(res.body);
  console.log('state:', res.statusCode, json.providers.map((p) => `${p.provider}:${p.fields.map((f) => f.configured).join('/')}`).join(' '));
  if (res.statusCode !== 200 || json.providers.length !== 3) throw new Error('state shape wrong');
  if (json.providers.some((p) => p.fields.some((f) => f.configured))) throw new Error('expected all unconfigured');
  if (JSON.stringify(json).includes('value')) throw new Error('state must not leak values');
}

// snapshot：无凭证时三个账号全部 unconfigured
{
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/snapshot'](mockReq('POST', '{}'), res);
  const json = JSON.parse(res.body);
  console.log('snapshot:', res.statusCode, json.accounts.map((a) => `${a.provider}:${a.status}`).join(' '));
  if (res.statusCode !== 200 || json.accounts.length !== 3) throw new Error('snapshot shape wrong');
  if (!json.accounts.every((a) => a.status === 'unconfigured')) throw new Error('expected all unconfigured');
}

// snapshot 参数校验
{
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/snapshot'](mockReq('POST', '{"provider":"nope"}'), res);
  console.log('snapshot unknown provider:', res.statusCode, res.body);
  if (res.statusCode !== 400) throw new Error('expected 400');
}

// credentials 参数校验（未知字段拒绝）
{
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/credentials'](
    mockReq('POST', '{"provider":"kimi","values":{"BOGUS":"x"}}'),
    res,
  );
  console.log('credentials unknown field:', res.statusCode, res.body);
  if (res.statusCode !== 400) throw new Error('expected 400');
}

// 假凭证真实调三家：期望走 expired/error 路径而不是崩溃
const probes = [
  ['volcano', { VOLC_ARK_ACCESS_KEY_ID: 'AKfake', VOLC_ARK_ACCESS_KEY_SECRET: 'fake' }],
  ['kimi', { KIMI_CODE_API_KEY: 'sk-fake' }],
  ['mimo', { MIMO_SERVICE_TOKEN: 'fake', MIMO_USER_ID: '12345' }],
];
for (const [id, creds] of probes) {
  const mod = await import(pathToFileURL(path.join(pluginDir, 'providers', `${id}.js`)).href);
  const fn = mod[Object.keys(mod).find((k) => k.startsWith('fetch'))];
  try {
    const result = await fn(creds);
    console.log(`probe ${id}: unexpectedly ok`, JSON.stringify(result).slice(0, 120));
  } catch (err) {
    console.log(`probe ${id}: ${err.name}/${err.kind ?? '-'}: ${String(err.message).slice(0, 100)}`);
    if (err.name !== 'ProviderError') throw new Error(`probe ${id}: non-ProviderError leaked: ${err}`);
  }
}

console.log('SMOKE OK');
