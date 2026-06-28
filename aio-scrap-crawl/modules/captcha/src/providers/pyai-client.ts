/**
 * Shared HTTP client for the captcha providers. The actual solving libraries
 * (the `twocaptcha` client, and the LMM vision code) live in the py-ai service;
 * the TypeScript providers are thin and reach it over HTTP, keeping API keys
 * server-side. Both providers share this client and differ only by their
 * `provider` name.
 */
import { type CaptchaChallenge, type CaptchaSolution, captchaError } from '../types';

interface HealthResponse {
  providers?: Record<string, { ready?: boolean; reason?: string }>;
}

/** Probe `/captcha/health` and report whether the named provider is ready. */
export async function providerReady(
  baseUrl: string | undefined,
  provider: string,
): Promise<boolean> {
  if (!baseUrl) return false;
  try {
    const res = await fetch(`${baseUrl}/captcha/health`);
    if (!res.ok) return false;
    const json = (await res.json()) as HealthResponse;
    return Boolean(json.providers?.[provider]?.ready);
  } catch {
    return false;
  }
}

/** POST a challenge to `/captcha/solve` and normalize the response. */
export async function solveVia(
  baseUrl: string | undefined,
  provider: string,
  challenge: CaptchaChallenge,
  setupHint: string,
): Promise<CaptchaSolution> {
  if (!baseUrl) {
    return captchaError(challenge.type, provider, setupHint);
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/captcha/solve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...challenge, provider }),
    });
  } catch (err) {
    return captchaError(
      challenge.type,
      provider,
      `py-ai unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    return captchaError(challenge.type, provider, `py-ai HTTP ${res.status}`);
  }
  const data = (await res.json()) as Partial<CaptchaSolution>;
  return {
    ok: data.ok ?? false,
    type: challenge.type,
    provider,
    token: data.token,
    text: data.text,
    id: data.id,
    cost: data.cost,
    error: data.error,
  };
}

/** Strip a trailing slash from a base URL (so `${url}/path` is clean). */
export function normalizeBase(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, '');
}
