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
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'tokenPlanDashboard';
    const PANEL_ID = 'token-plan-dashboard';
    const API = '/dsh-token-plan-dashboard';

    const zh = {
      'panel.title': '额度',
      'dashboard.title': '订阅额度',
      'dashboard.refresh': '刷新',
      'dashboard.refreshing': '刷新中…',
      'dashboard.lastFetched': '更新于',
      'dashboard.empty': '没有在监测的订阅。在下方「设置」中开启监测并配置凭证后，刷新即可看到额度。',
      'dashboard.loadFailed': '数据加载失败',
      'settings.title': '设置',
      'settings.monitor': '监测',
      'settings.disabledHint': '已关闭监测；已保存的凭证保留，重新开启即可恢复。',
      'settings.config_missing': '设置服务不可用（configForms 服务未注入）：开关状态的修改不会保存。',
      'settings.config_unavailable': '设置服务中找不到本插件的配置项（host 侧 Config 未激活）：开关状态的修改不会保存。',
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
      'dashboard.empty': 'No subscriptions are being monitored. Enable one and fill in its credentials in Settings below, then refresh.',
      'dashboard.loadFailed': 'Failed to load data',
      'settings.title': 'Settings',
      'settings.monitor': 'Monitor',
      'settings.disabledHint': 'Monitoring is off; saved credentials are kept and resume when re-enabled.',
      'settings.config_missing': 'Settings service unavailable (configForms not injected): toggle changes will not persist.',
      'settings.config_unavailable': 'This plugin’s config entry is missing from the settings service (host Config inactive): toggle changes will not persist.',
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
.tpd-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.tpd-switch-row .tpd-creds-provider-name { margin-bottom: 0; }
.tpd-switch {
  width: 32px;
  height: 18px;
  flex: none;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1, #dee0e3);
  background: var(--dsw-alias-bg-layer-3, #eff0f1);
  position: relative;
  cursor: pointer;
  padding: 0;
}
.tpd-switch:disabled { opacity: 0.5; cursor: default; }
.tpd-switch-knob {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary, #8a8f98);
  transition: left 0.15s ease, background 0.15s ease;
}
.tpd-switch-on {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 25%, transparent);
  border-color: var(--dsw-alias-brand-primary, #247bbf);
}
.tpd-switch-on .tpd-switch-knob {
  left: 15px;
  background: var(--dsw-alias-brand-primary, #247bbf);
}
.tpd-config-warn {
  font-size: 12px;
  color: var(--dsw-alias-state-warn-primary, #f2994a);
  margin-bottom: 12px;
}
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
      const { providerState, t, onSaved, onAutoEnable } = props;
      const [values, setValues] = useState({});
      const [busy, setBusy] = useState(false);
      const [note, setNote] = useState(null); // { kind: 'ok' | 'err', text }

      const post = async (bodyValues, autoEnable) => {
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
          // 保存（非清除）成功后确保该 provider 处于启用状态（Q3 决策：保存凭证自动开启监测）。
          if (autoEnable && onAutoEnable) onAutoEnable(providerState.provider);
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
        post(filled, true);
      };
      const onClear = () => {
        const cleared = {};
        for (const field of providerState.fields) cleared[field.key] = '';
        post(cleared, false);
      };

      return h(
        'div',
        { className: 'tpd-creds-provider' },
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

    // 设置区的一行：监测开关 + （启用时的）凭证表单。关闭时表单隐藏、凭证保留（Q2 决策）。
    function ProviderSettingsRow(props) {
      const { providerState, enabled, configWritable, t, onSaved, onToggle, onAutoEnable } = props;
      return h(
        'div',
        { className: 'tpd-creds-provider' },
        h(
          'div',
          { className: 'tpd-switch-row' },
          h(
            'button',
            {
              className: `tpd-switch ${enabled ? 'tpd-switch-on' : ''}`,
              role: 'switch',
              'aria-checked': enabled,
              'aria-label': `${t('settings.monitor')} ${providerState.label}`,
              disabled: !configWritable,
              onClick: () => onToggle(providerState.provider, !enabled),
            },
            h('span', { className: 'tpd-switch-knob' }),
          ),
          h('span', { className: 'tpd-creds-provider-name' }, providerState.label),
        ),
        enabled
          ? h(ProviderCredentialForm, { providerState, t, onSaved, onAutoEnable })
          : h('div', { className: 'tpd-creds-guide' }, t('settings.disabledHint')),
      );
    }

    function DashboardPage(props) {
      const { t, configForm } = props;
      const [credState, setCredState] = useState(null);
      const [accounts, setAccounts] = useState([]);
      const [fetchedAt, setFetchedAt] = useState(null);
      const [loading, setLoading] = useState(false);
      const [loadError, setLoadError] = useState(null);
      const [now, setNow] = useState(Date.now());
      // 监测开关：null = 尚未从 configForms 读到（按全部启用渲染）；对象 = 已就绪。
      const [monitors, setMonitors] = useState(null);
      // 设置通道诊断：loading | ready | readonly | unavailable（entry 不在镜像）| missing（服务不存在）
      const [configStatus, setConfigStatus] = useState('loading');
      const monitorsRef = useRef({});

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

      // 订阅监测开关（volatile 配置，写回 profile patch；别处改动经镜像自动回读）
      useEffect(() => {
        if (!configForm) {
          setConfigStatus('missing');
          return;
        }
        const pull = () => {
          const snap = configForm.getSnapshot();
          if (!snap || snap.status === 'unavailable') {
            setConfigStatus('unavailable');
            return;
          }
          if (snap.status !== 'ready') return; // loading：等下次回调
          const value = snap.value;
          const m =
            value && typeof value === 'object' && value.monitors && typeof value.monitors === 'object'
              ? value.monitors
              : {};
          monitorsRef.current = m;
          setMonitors(m);
          setConfigStatus(snap.writable === false ? 'readonly' : 'ready');
        };
        pull();
        return configForm.subscribe(pull);
      }, [configForm]);

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

      const isOn = (id) => (monitors ? monitors[id] !== false : true);

      const toggleProvider = useCallback(
        async (id, next) => {
          // 乐观更新让卡片墙立即增删；写失败时订阅回读会纠正为真实值。
          const optimistic = { ...monitorsRef.current, [id]: next };
          monitorsRef.current = optimistic;
          setMonitors(optimistic);
          if (!configForm) return;
          try {
            await configForm.mutate([{ op: 'set', path: ['monitors', id], value: next }]);
          } catch {
            // 忽略：subscribe 回读真实状态
          }
        },
        [configForm],
      );

      // Q3 决策：保存凭证（非清除）成功后确保该 provider 处于启用状态。
      const enableProvider = useCallback(
        (id) => {
          if (monitorsRef.current[id] === false) toggleProvider(id, true);
        },
        [toggleProvider],
      );

      // 卡片墙只展示「启用 ∧ 已配置凭证」（Q1 决策）；开关拨动即时生效。
      const visibleAccounts = accounts.filter((a) => a.configured && isOn(a.provider));

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
        visibleAccounts.length === 0 && !loading
          ? h('div', { className: 'tpd-empty' }, t('dashboard.empty'))
          : null,
        h(
          'div',
          { className: 'tpd-grid' },
          visibleAccounts.map((account) => h(AccountCard, { key: account.provider, account, t, now })),
        ),
        credState
          ? h(
              'div',
              { className: 'tpd-creds' },
              h('div', { className: 'tpd-creds-title' }, t('settings.title')),
              configStatus === 'missing' || configStatus === 'unavailable'
                ? h('div', { className: 'tpd-config-warn' }, t(`settings.config_${configStatus}`))
                : null,
              credState.map((p) =>
                h(ProviderSettingsRow, {
                  key: p.provider,
                  providerState: p,
                  enabled: isOn(p.provider),
                  configWritable: configStatus === 'ready',
                  t,
                  onSaved,
                  onToggle: toggleProvider,
                  onAutoEnable: enableProvider,
                }),
              ),
            )
          : null,
      );
    }

    return {
      // 服务级 inject：configForms 由组合内 @deepseek-ai/dsh-client-ui-settings 提供（已核实存在）。
      // 注意不要把对应「包」写进 package.json 的 dsh.client.inject——包级注入按 profile 依赖树
      // 解析，profile 里没有这个包，会让整个 client 插件加载失败（见 CONSTRAINTS.md）。
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-plan-dashboard: dictionaries');
        const t = ctx.locale.bind(NS);
        // 监测开关的配置句柄（entryId = cordis.patch.yml 行 id）。try/catch 是兜底：
        // 极端情况下（服务被移出组合）降级为开关禁用 + 提示，不让页面全灭。
        let configForm = null;
        try {
          configForm =
            ctx.configForms && typeof ctx.configForms.get === 'function'
              ? ctx.configForms.get('token-plan-dashboard')
              : null;
        } catch {
          configForm = null;
        }
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
              ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, () => h(DashboardPage, { t, configForm })),
            ),
          'token-plan-dashboard: main page',
        );
      },
    };
  },
});
