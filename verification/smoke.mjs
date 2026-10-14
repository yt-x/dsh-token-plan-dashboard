// 冒烟脚本（一次性探针，非测试套件）：
// 1) 用 mock ctx + 不同 config 形状挂载 plugin/index.js，验证 state/snapshot/credentials
//    三条路由的形状、参数校验，以及 V1.1 监测开关（monitors）的过滤行为。
// 2) 用假凭证真实调三家接口，验证失效判定路径能走到 expired/error（不验证真实额度数据）。
// 注：工作区裸 import 不可解析 @deepseek-ai/schemastery；本机 PATH 的 node 恰为 DSH 自带
// node.exe，解析链经 execPath 祖先目录命中应用自带副本（与真实 host 进程同机制），所以本机
// 跑出来 Config = present；无候选路径命中的环境会走降级（console.warn + Config === undefined）。
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

function mockCtx() {
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
  return { ctx, routes };
}

const host = await import(pathToFileURL(path.join(pluginDir, 'index.js')).href);

// Config 导出：本机 PATH 里 node 恰为 DSH 自带 node.exe → 解析链经 execPath 祖先目录命中应用
// 自带副本，Config = present（与真实 host 进程同机制）；无候选路径命中的环境则降级为 undefined。
console.log('Config export:', host.Config ? 'present (schemastery resolved)' : 'degraded (schemastery unavailable)');

function mount(config) {
  const { ctx, routes } = mockCtx();
  host.apply(ctx, config);
  const paths = Object.keys(routes).sort();
  if (paths.length !== 3) throw new Error(`expected 3 routes, got ${paths.join(',')}`);
  return routes;
}

async function getState(routes) {
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/state'](mockReq('GET'), res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

async function postSnapshot(routes, body) {
  const res = mockRes();
  await routes['/dsh-token-plan-dashboard/snapshot'](mockReq('POST', body), res);
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

// 场景 A：无 config（等价于 monitors 缺省）→ 三家全部 enabled
{
  const routes = mount(undefined);
  const state = await getState(routes);
  console.log('A state:', state.status, 'configActive:', state.json.configActive, state.json.providers.map((p) => `${p.provider}:${p.enabled}`).join(' '));
  if (typeof state.json.configActive !== 'boolean') throw new Error('state must carry configActive');
  if (state.status !== 200 || state.json.providers.length !== 3) throw new Error('state shape wrong');
  if (!state.json.providers.every((p) => p.enabled === true)) throw new Error('expected all enabled by default');
  if (JSON.stringify(state.json).includes('"value"')) throw new Error('state must not leak values');

  const snap = await postSnapshot(routes, '{}');
  console.log('A snapshot:', snap.status, snap.json.accounts.map((a) => `${a.provider}:${a.status}`).join(' '));
  if (snap.json.accounts.length !== 3) throw new Error('expected 3 accounts');
  if (!snap.json.accounts.every((a) => a.status === 'unconfigured')) throw new Error('expected all unconfigured');
}

// 场景 B：Volatile 引用形状（生产环境 config.monitors.get()），kimi 关闭
{
  const routes = mount({ monitors: { get: () => ({ kimi: false }) } });
  const state = await getState(routes);
  console.log('B state:', state.json.providers.map((p) => `${p.provider}:${p.enabled}`).join(' '));
  const kimi = state.json.providers.find((p) => p.provider === 'kimi');
  if (!kimi || kimi.enabled !== false) throw new Error('expected kimi disabled in state');
  if (state.json.providers.filter((p) => p.enabled).length !== 2) throw new Error('expected 2 enabled');

  const snap = await postSnapshot(routes, '{}');
  console.log('B snapshot:', snap.json.accounts.map((a) => a.provider).join(' '));
  if (snap.json.accounts.length !== 2) throw new Error('expected 2 accounts (kimi filtered)');
  if (snap.json.accounts.some((a) => a.provider === 'kimi')) throw new Error('disabled provider must not be fetched');

  // 指定已关闭的 provider → 200 空 accounts
  const off = await postSnapshot(routes, '{"provider":"kimi"}');
  console.log('B snapshot disabled provider:', off.status, JSON.stringify(off.json.accounts));
  if (off.status !== 200 || off.json.accounts.length !== 0) throw new Error('expected 200 with empty accounts');

  // 未知 provider → 400
  const bad = await postSnapshot(routes, '{"provider":"nope"}');
  console.log('B snapshot unknown provider:', bad.status, JSON.stringify(bad.json));
  if (bad.status !== 400) throw new Error('expected 400');
}

// 场景 C：plain object config（防御路径），mimo 关闭
{
  const routes = mount({ monitors: { mimo: false } });
  const snap = await postSnapshot(routes, '{}');
  console.log('C snapshot:', snap.json.accounts.map((a) => a.provider).join(' '));
  if (snap.json.accounts.some((a) => a.provider === 'mimo')) throw new Error('plain-object config must also filter');
  if (snap.json.accounts.length !== 2) throw new Error('expected 2 accounts');
}

// credentials 参数校验（未知字段拒绝）
{
  const routes = mount(undefined);
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
