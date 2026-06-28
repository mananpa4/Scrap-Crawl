/**
 * 2Captcha provider (LICENSE: 2captcha-python client is MIT — permissive).
 *
 * 2Captcha is a commercial solving service. The official Python client lives in
 * the py-ai service (it's a thin HTTP client to 2captcha.com); this provider
 * reaches it over `/captcha/solve`, so the `TWOCAPTCHA_API_KEY` stays
 * server-side. Primary provider — broadest coverage (recaptcha v2/v3, hcaptcha,
 * turnstile, funcaptcha, geetest, image, text, …).
 *
 * Requires a paid 2Captcha account; reports `isAvailable(): false` until the lib
 * is installed and the key is configured.
 */
import type { CaptchaSolver } from '../solver';
import type { CaptchaChallenge, CaptchaSolution } from '../types';
import { normalizeBase, providerReady, solveVia } from './pyai-client';

export interface TwoCaptchaOptions {
  /** Base URL of the py-ai service that hosts the 2captcha client (PYAI_URL). */
  url?: string;
}

export class TwoCaptchaProvider implements CaptchaSolver {
  readonly name = '2captcha';
  private readonly url?: string;

  constructor(opts: TwoCaptchaOptions = {}) {
    this.url = normalizeBase(opts.url);
  }

  isAvailable(): Promise<boolean> {
    return providerReady(this.url, this.name);
  }

  solve(challenge: CaptchaChallenge): Promise<CaptchaSolution> {
    return solveVia(
      this.url,
      this.name,
      challenge,
      'Set PYAI_URL, install 2captcha-python in services/py-ai and set TWOCAPTCHA_API_KEY.',
    );
  }
}
