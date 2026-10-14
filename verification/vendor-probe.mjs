// 探针（一次性，非测试套件）：验证 vendored schemastery 闭包可用，
// 且产出的 Config 满足 dsh-settings / cordis-plugin-loader 的真实门禁。
// 重点验证 dsh-settings 的真实用法：new z(schema.toJSON())（用它自己的真库重建我们的 schema）。
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const vendorUrl = pathToFileURL(path.join(root, 'plugin', 'vendor', 'schemastery.mjs')).href;
const z = (await import(vendorUrl)).default;

const Config = z.object({ monitors: z.dict(z.boolean()).volatile() });

// 1) loader 的门禁：鸭子类型检查 schema['~standard'].vendor
const vendor = Config['~standard']?.vendor;
console.log('~standard.vendor:', vendor);
if (vendor !== 'schemastery') throw new Error('loader isSchemastery() would reject this schema');

// 2) dsh-settings 的 schema(entry) 门禁：必须有 toJSON
if (typeof Config.toJSON !== 'function') throw new Error('dsh-settings requires toJSON');
const json = Config.toJSON();
console.log('toJSON ok, has uid/refs:', 'uid' in json, 'refs' in json);

// 3) dsh-settings 的真实用法：plainSchema() 里 new z(schema.toJSON())
const rebuilt = new z(json);
console.log('rebuilt type:', rebuilt.type, 'dict keys:', Object.keys(rebuilt.dict ?? {}).join(','));

// 4) volatileForm(schema) 的门禁：monitors 必须是 volatile，否则 entry 被丢弃
const monitorsNode = rebuilt.dict?.monitors;
console.log('rebuilt monitors meta.volatile:', monitorsNode?.meta?.volatile);
if (monitorsNode?.meta?.volatile !== true) throw new Error('volatile flag lost across toJSON round-trip');

// 5) 值语义：缺省 {} / 显式 false，且 volatile 产出 .get() 引用
const empty = Config({});
console.log('validate({}) -> monitors.get():', JSON.stringify(empty.monitors.get()));
const off = Config({ monitors: { kimi: false } });
console.log('validate({monitors:{kimi:false}}) -> get():', JSON.stringify(off.monitors.get()));
if (off.monitors.get().kimi !== false) throw new Error('explicit false must survive');
if (typeof empty.monitors.get !== 'function') throw new Error('volatile must expose .get()');

// 6) 宿主 loader 的 equalExceptVolatile 依赖 isVolatile 识别（跨副本经 Symbol.for）
const { isVolatile } = await import(pathToFileURL(path.join(root, 'plugin', 'vendor', 'cosmokit.mjs')).href);
console.log('isVolatile(monitors) via cosmokit:', isVolatile(empty.monitors));

console.log('VENDOR PROBE OK');
