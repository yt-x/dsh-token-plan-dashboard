/**
 * Token Plan Dashboard — Client 半区。
 * 注册 sidebar.panellist 图标入口（id 与 main keyed 页面的 key 配对）和仪表盘页面。
 * React 来自浏览器共享模块表；样式只用 --dsw-alias-* 主题 token；文案走 Client locale 服务。
 * 数据通过同源 fetch 调用 Host 半区的 /dsh-token-plan-dashboard/* 路由。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-token-plan-dashboard',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    const NS = 'tokenPlanDashboard';
    const PANEL_ID = 'token-plan-dashboard';
    const API = '/dsh-token-plan-dashboard';

    const zh = {
      'panel.title': '额度',
      'dashboard.title': '订阅额度',
      'dashboard.refresh': '刷新',
      'dashboard.refreshing': '刷新中…',
      'dashboard.lastFetched': '更新于',
      'dashboard.empty': '尚未配置任何订阅凭证。在下方「凭证配置」中填写后，刷新即可看到额度。',
      'dashboard.loadFailed': '数据加载失败',
      'status.ok': '正常',
      'status.unconfigured': '未配置',
      'status.expired': '凭证失效',
      'status.error': '错误',
      'status.unconfiguredHint': '在下方凭证配置中填写该订阅的凭证。',
      'mimo.expiredGuide':
        '重新登录 platform.xiaomimimo.com，按 F12 打开开发者工具 → Application → Cookies，复制 api-platform_serviceToken 与 userId 的值，粘贴到下方凭证配置。',
      'window.5h': '5 小时窗口',
      'window.weekly': '周窗口',
      'window.monthly': '月度窗口',
      'plan.noReset': '无重置时间',
      'countdown.resetting': '等待重置',
      'unit.day': '天',
      'unit.hour': '时',
      'unit.minute': '分',
      'unit.second': '秒',
      'extra.balance': '余额',
      'creds.title': '凭证配置',
      'creds.save': '保存',
      'creds.saving': '保存中…',
      'creds.saved': '已保存',
      'creds.clear': '清除',
      'creds.configured': '已配置',
      'creds.notConfigured': '未配置',
      'creds.sourceEnv': '来自环境变量，只读',
      'creds.failed': '保存失败',
      'creds.mimoGuide':
        '登录 platform.xiaomimimo.com → F12 开发者工具 → Application → Cookies → 复制 api-platform_serviceToken 与 userId 的值。',
    };

    const en = {
      'panel.title': 'Quotas',
      'dashboard.title': 'Subscription quotas',
      'dashboard.refresh': 'Refresh',
      'dashboard.refreshing': 'Refreshing…',
      'dashboard.lastFetched': 'Updated at',
      'dashboard.empty': 'No credentials configured yet. Fill in the Credentials section below, then refresh.',
      'dashboard.loadFailed': 'Failed to load data',
      'status.ok': 'OK',
      'status.unconfigured': 'Not configured',
      'status.expired': 'Credential expired',
      'status.error': 'Error',
      'status.unconfiguredHint': 'Fill in this subscription’s credentials in the section below.',
      'mimo.expiredGuide':
        'Sign in to platform.xiaomimimo.com again, open DevTools (F12) → Application → Cookies, copy the values of api-platform_serviceToken and userId, and paste them below.',
      'window.5h': '5-hour window',
      'window.weekly': 'Weekly window',
      'window.monthly': 'Monthly window',
      'plan.noReset': 'No reset time',
      'countdown.resetting': 'Resetting…',
      'unit.day': 'd',
      'unit.hour': 'h',
      'unit.minute': 'm',
      'unit.second': 's',
      'extra.balance': 'Balance',
      'creds.title': 'Credentials',
      'creds.save': 'Save',
      'creds.saving': 'Saving…',
      'creds.saved': 'Saved',
      'creds.clear': 'Clear',
      'creds.configured': 'Configured',
      'creds.notConfigured': 'Not configured',
      'creds.sourceEnv': 'From environment, read-only',
      'creds.failed': 'Save failed',
      'creds.mimoGuide':
        'Sign in to platform.xiaomimimo.com → DevTools (F12) → Application → Cookies → copy the values of api-platform_serviceToken and userId.',
    };

    const CSS = `
.tpd-page {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-base, transparent);
}
.tpd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.tpd-title { font-size: 18px; font-weight: 600; }
.tpd-fetched {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  flex: 1;
}
.tpd-refresh {
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #1f2329);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}
.tpd-refresh:hover { background: var(--dsw-alias-bg-layer-2, #f5f6f7); }
.tpd-refresh:disabled { opacity: 0.6; cursor: default; }
.tpd-empty {
  padding: 24px;
  border: 1px dashed var(--dsw-alias-border-l1, #dee0e3);
  border-radius: 12px;
  color: var(--dsw-alias-label-secondary, #5f6368);
  font-size: 13px;
  margin-bottom: 16px;
}
.tpd-error-banner {
  padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d83931) 12%, transparent);
  color: var(--dsw-alias-state-error-primary, #d83931);
  font-size: 13px;
  margin-bottom: 16px;
  word-break: break-all;
}
.tpd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.tpd-card {
  background: var(--dsw-alias-bg-layer-1, #fff);
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tpd-card-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.tpd-card-name { font-size: 14px; font-weight: 600; flex: 1; }
.tpd-card-plan {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
}
.tpd-badge {
  font-size: 11px;
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
}
.tpd-badge-ok {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #34a853) 14%, transparent);
  color: var(--dsw-alias-state-success-primary, #34a853);
}
.tpd-badge-warn {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f2994a) 16%, transparent);
  color: var(--dsw-alias-state-warn-primary, #f2994a);
}
.tpd-badge-error {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d83931) 12%, transparent);
  color: var(--dsw-alias-state-error-primary, #d83931);
}
.tpd-badge-muted {
  background: var(--dsw-alias-bg-layer-3, #eff0f1);
  color: var(--dsw-alias-label-tertiary, #8a8f98);
}
.tpd-message {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #5f6368);
  line-height: 1.6;
  word-break: break-all;
}
.tpd-plan { display: flex; flex-direction: column; gap: 6px; }
.tpd-plan-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}
.tpd-plan-label { color: var(--dsw-alias-label-secondary, #5f6368); flex: 1; }
.tpd-plan-count { color: var(--dsw-alias-label-primary, #1f2329); font-variant-numeric: tabular-nums; }
.tpd-plan-pct { color: var(--dsw-alias-label-tertiary, #8a8f98); font-variant-numeric: tabular-nums; }
.tpd-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-3, #eff0f1);
  overflow: hidden;
}
.tpd-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.tpd-plan-foot {
  display: flex;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
}
.tpd-extras {
  border-top: 1px solid var(--dsw-alias-border-l2, #eff0f1);
  padding-top: 8px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #5f6368);
  display: flex;
  gap: 6px;
}
.tpd-creds {
  background: var(--dsw-alias-bg-layer-1, #fff);
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  border-radius: 12px;
  padding: 16px;
}
.tpd-creds-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.tpd-creds-provider { margin-bottom: 16px; }
.tpd-creds-provider:last-child { margin-bottom: 0; }
.tpd-creds-provider-name { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.tpd-creds-guide {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  line-height: 1.6;
  margin-bottom: 6px;
}
.tpd-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.tpd-field-label {
  width: 260px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #5f6368);
  font-family: var(--dsw-alias-font-family-mono, monospace);
  word-break: break-all;
}
.tpd-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #1f2329);
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
}
.tpd-field-state { font-size: 11px; white-space: nowrap; }
.tpd-field-state-ok { color: var(--dsw-alias-state-success-primary, #34a853); }
.tpd-field-state-muted { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.tpd-creds-actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.tpd-btn {
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  background: var(--dsw-alias-bg-layer-2, #f5f6f7);
  color: var(--dsw-alias-label-primary, #1f2329);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}
.tpd-btn:disabled { opacity: 0.6; cursor: default; }
.tpd-btn-primary {
  background: var(--dsw-alias-brand-primary, #247bbf);
  border-color: var(--dsw-alias-brand-primary, #247bbf);
  color: #fff;
}
.tpd-creds-note { font-size: 12px; }
.tpd-creds-note-ok { color: var(--dsw-alias-state-success-primary, #34a853); }
.tpd-creds-note-err { color: var(--dsw-alias-state-error-primary, #d83931); }
`;

    function formatNumber(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '';
      return n.toLocaleString('en-US');
    }

    function formatPercent(p) {
      if (typeof p !== 'number' || !Number.isFinite(p)) return null;
      const rounded = Math.round(p * 10) / 10;
      return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
    }

    function formatCountdown(resetAt, now, t) {
      if (!resetAt) return null;
      const target = new Date(resetAt).getTime();
      if (Number.isNaN(target)) return null;
      const ms = target - now;
      if (ms <= 0) return t('countdown.resetting');
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const hh = Math.floor((s % 86400) / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      if (d > 0) return `${d}${t('unit.day')} ${hh}${t('unit.hour')}`;
      if (hh > 0) return `${hh}${t('unit.hour')} ${mm}${t('unit.minute')}`;
      return `${mm}${t('unit.minute')} ${ss}${t('unit.second')}`;
    }

    function barColor(percent) {
      if (typeof percent !== 'number') return 'var(--dsw-alias-brand-primary, #247bbf)';
      if (percent >= 90) return 'var(--dsw-alias-state-error-primary, #d83931)';
      if (percent >= 70) return 'var(--dsw-alias-state-warn-primary, #f2994a)';
      return 'var(--dsw-alias-brand-primary, #247bbf)';
    }

    function statusBadgeClass(status) {
      if (status === 'ok') return 'tpd-badge tpd-badge-ok';
      if (status === 'unconfigured') return 'tpd-badge tpd-badge-muted';
      return 'tpd-badge tpd-badge-error';
    }

    function PanelIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 64 64',
          width: 18,
          height: 18,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('circle', {
          cx: 32, cy: 32, r: 26, fill: 'none', stroke: 'currentColor', strokeWidth: 8, opacity: 0.3,
        }),
        h('circle', {
          cx: 32, cy: 32, r: 26, fill: 'none', stroke: 'currentColor', strokeWidth: 8,
          strokeLinecap: 'round', strokeDasharray: '114.4 163.4', transform: 'rotate(-90 32 32)',
        }),
      );
    }

    function PlanRow(props) {
      const { plan, t, now } = props;
      const percent = typeof plan.percent === 'number' ? plan.percent : null;
      const width = percent === null ? 0 : Math.max(0, Math.min(100, percent));
      const pctText = formatPercent(percent);
      const hasCounts = typeof plan.used === 'number' && typeof plan.total === 'number';
      const countdown = formatCountdown(plan.resetAt, now, t);
      return h(
        'div',
        { className: 'tpd-plan' },
        h(
          'div',
          { className: 'tpd-plan-head' },
          h('span', { className: 'tpd-plan-label' }, t(`window.${plan.window}`)),
          hasCounts
            ? h('span', { className: 'tpd-plan-count' }, `${formatNumber(plan.used)} / ${formatNumber(plan.total)}`)
            : null,
          pctText ? h('span', { className: 'tpd-plan-pct' }, pctText) : null,
        ),
        h(
          'div',
          { className: 'tpd-bar' },
          h('div', { className: 'tpd-bar-fill', style: { width: `${width}%`, background: barColor(percent) } }),
        ),
        h(
          'div',
          { className: 'tpd-plan-foot' },
          h('span', null, countdown ?? t('plan.noReset')),
        ),
      );
    }

    function AccountCard(props) {
      const { account, t, now } = props;
      const statusText = t(`status.${account.status}`);
      return h(
        'div',
        { className: 'tpd-card' },
        h(
          'div',
          { className: 'tpd-card-head' },
          h('span', { className: 'tpd-card-name' }, account.label),
          account.planName ? h('span', { className: 'tpd-card-plan' }, account.planName) : null,
          h('span', { className: statusBadgeClass(account.status) }, statusText),
        ),
        account.status === 'ok'
          ? account.plans.map((plan, i) =>
              h(PlanRow, { key: `${plan.window}-${i}`, plan, t, now }),
            )
          : null,
        account.status === 'unconfigured'
          ? h('div', { className: 'tpd-message' }, t('status.unconfiguredHint'))
          : null,
        account.status === 'expired' || account.status === 'error'
          ? h('div', { className: 'tpd-message' }, account.message || statusText)
          : null,
        account.status === 'expired' && account.provider === 'mimo'
          ? h('div', { className: 'tpd-message' }, t('mimo.expiredGuide'))
          : null,
        Array.isArray(account.extras) && account.extras.length > 0
          ? h(
              'div',
              { className: 'tpd-extras' },
              account.extras.map((extra, i) =>
                h('span', { key: i }, `${t(`extra.${extra.key}`)} ${extra.value}`),
              ),
            )
          : null,
      );
    }

    function ProviderCredentialForm(props) {
      const { providerState, t, onSaved } = props;
      const [values, setValues] = useState({});
      const [busy, setBusy] = useState(false);
      const [note, setNote] = useState(null); // { kind: 'ok' | 'err', text }

      const post = async (bodyValues) => {
        setBusy(true);
        setNote(null);
        try {
          const res = await fetch(`${API}/credentials`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: providerState.provider, values: bodyValues }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json || json.ok !== true) {
            setNote({ kind: 'err', text: (json && json.message) || `${t('creds.failed')} (HTTP ${res.status})` });
            return;
          }
          setValues({});
          setNote({ kind: 'ok', text: t('creds.saved') });
          onSaved();
        } catch (err) {
          setNote({ kind: 'err', text: `${t('creds.failed')}: ${String((err && err.message) || err)}` });
        } finally {
          setBusy(false);
        }
      };

      const onSave = () => {
        const filled = {};
        for (const field of providerState.fields) {
          const v = values[field.key];
          if (typeof v === 'string' && v.trim() !== '') filled[field.key] = v;
        }
        if (Object.keys(filled).length === 0) return;
        post(filled);
      };
      const onClear = () => {
        const cleared = {};
        for (const field of providerState.fields) cleared[field.key] = '';
        post(cleared);
      };

      return h(
        'div',
        { className: 'tpd-creds-provider' },
        h('div', { className: 'tpd-creds-provider-name' }, providerState.label),
        providerState.provider === 'mimo'
          ? h('div', { className: 'tpd-creds-guide' }, t('creds.mimoGuide'))
          : null,
        providerState.fields.map((field) => {
          const stateText = field.configured
            ? field.writable === false
              ? `${t('creds.configured')} · ${t('creds.sourceEnv')}`
              : t('creds.configured')
            : t('creds.notConfigured');
          return h(
            'div',
            { className: 'tpd-field', key: field.key },
            h('span', { className: 'tpd-field-label' }, field.label),
            h('input', {
              className: 'tpd-input',
              type: 'password',
              autoComplete: 'off',
              disabled: busy || field.writable === false,
              value: values[field.key] ?? '',
              placeholder: field.configured ? '••••••' : '',
              onChange: (e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value })),
            }),
            h(
              'span',
              { className: `tpd-field-state ${field.configured ? 'tpd-field-state-ok' : 'tpd-field-state-muted'}` },
              stateText,
            ),
          );
        }),
        h(
          'div',
          { className: 'tpd-creds-actions' },
          h(
            'button',
            { className: 'tpd-btn tpd-btn-primary', disabled: busy, onClick: onSave },
            busy ? t('creds.saving') : t('creds.save'),
          ),
          h('button', { className: 'tpd-btn', disabled: busy, onClick: onClear }, t('creds.clear')),
          note
            ? h('span', { className: `tpd-creds-note ${note.kind === 'ok' ? 'tpd-creds-note-ok' : 'tpd-creds-note-err'}` }, note.text)
            : null,
        ),
      );
    }

    function DashboardPage(props) {
      const { t } = props;
      const [credState, setCredState] = useState(null);
      const [accounts, setAccounts] = useState([]);
      const [fetchedAt, setFetchedAt] = useState(null);
      const [loading, setLoading] = useState(false);
      const [loadError, setLoadError] = useState(null);
      const [now, setNow] = useState(Date.now());

      const loadState = useCallback(async () => {
        const res = await fetch(`${API}/state`);
        const json = await res.json();
        setCredState(Array.isArray(json.providers) ? json.providers : []);
      }, []);

      const loadSnapshot = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const res = await fetch(`${API}/snapshot`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          });
          const json = await res.json();
          setAccounts(Array.isArray(json.accounts) ? json.accounts : []);
          setFetchedAt(json.fetchedAt ?? null);
        } catch (err) {
          setLoadError(String((err && err.message) || err));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        loadState().catch((err) => setLoadError(String((err && err.message) || err)));
        loadSnapshot();
      }, [loadState, loadSnapshot]);

      useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
      }, []);

      const onSaved = useCallback(() => {
        loadState().catch(() => {});
        loadSnapshot();
      }, [loadState, loadSnapshot]);

      const anyConfigured = accounts.some((a) => a.configured);

      return h(
        'div',
        { className: 'tpd-page' },
        h(
          'div',
          { className: 'tpd-header' },
          h('span', { className: 'tpd-title' }, t('dashboard.title')),
          h(
            'span',
            { className: 'tpd-fetched' },
            fetchedAt ? `${t('dashboard.lastFetched')} ${new Date(fetchedAt).toLocaleTimeString()}` : '',
          ),
          h(
            'button',
            { className: 'tpd-refresh', disabled: loading, onClick: loadSnapshot },
            loading ? t('dashboard.refreshing') : t('dashboard.refresh'),
          ),
        ),
        loadError ? h('div', { className: 'tpd-error-banner' }, `${t('dashboard.loadFailed')}: ${loadError}`) : null,
        !anyConfigured && !loading
          ? h('div', { className: 'tpd-empty' }, t('dashboard.empty'))
          : null,
        h(
          'div',
          { className: 'tpd-grid' },
          accounts.map((account) => h(AccountCard, { key: account.provider, account, t, now })),
        ),
        credState
          ? h(
              'div',
              { className: 'tpd-creds' },
              h('div', { className: 'tpd-creds-title' }, t('creds.title')),
              credState.map((p) =>
                h(ProviderCredentialForm, { key: p.provider, providerState: p, t, onSaved }),
              ),
            )
          : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-plan-dashboard: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.pluginCss = 'dsh-token-plan-dashboard';
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => style.remove();
        }, 'token-plan-dashboard: styles');
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                { name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: () => t('panel.title'), locale: NS },
                PanelIcon,
              ),
            ),
          'token-plan-dashboard: sidebar entry',
        );
        ctx.effect(
          () =>
            ctx.slots.inject('main', () =>
              ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, () => h(DashboardPage, { t })),
            ),
          'token-plan-dashboard: main page',
        );
      },
    };
  },
});
