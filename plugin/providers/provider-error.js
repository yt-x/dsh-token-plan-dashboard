/**
 * Provider 取数失败的统一错误形态。
 * kind: 'expired' —— 凭证失效/登录态过期，卡片引导用户更新凭证。
 * kind: 'error'   —— 其他失败（网络、HTTP 错误、响应结构不符）。
 */
export class ProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}

export const expired = (message) => new ProviderError('expired', message);
export const failure = (message) => new ProviderError('error', message);
