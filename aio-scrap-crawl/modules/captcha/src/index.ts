/**
 * @aio/captcha — the AIO's captcha-solving layer.
 *
 * A provider-agnostic `CaptchaSolver` contract with two providers:
 *  - `2captcha`   — commercial solving service (primary, broad coverage)
 *  - `ai-vision`  — self-hosted LMM solver (secondary, no per-solve fee)
 *
 * Browser engines (Scrapling, browser-use, Crawlee/Playwright) can call a solver
 * to obtain a token/answer for a protected page. Both providers reach the py-ai
 * service over HTTP, where the solving libraries live.
 */
export type {
  CaptchaType,
  CaptchaChallenge,
  CaptchaSolution,
} from './types';
export { captchaError } from './types';
export type { CaptchaSolver } from './solver';
export { TwoCaptchaProvider, type TwoCaptchaOptions } from './providers/twocaptcha';
export { AiVisionProvider, type AiVisionOptions } from './providers/ai-vision';

import type { CaptchaSolver } from './solver';
import { TwoCaptchaProvider } from './providers/twocaptcha';
import { AiVisionProvider } from './providers/ai-vision';

export interface CreateSolverOptions {
  /** Base URL of the py-ai service (PYAI_URL). */
  url?: string;
}

/** Build a solver by provider name. Accepts `2captcha`/`twocaptcha` and `ai-vision`/`ai`. */
export function createCaptchaSolver(
  provider: string,
  opts: CreateSolverOptions = {},
): CaptchaSolver {
  switch (provider) {
    case '2captcha':
    case 'twocaptcha':
      return new TwoCaptchaProvider({ url: opts.url });
    case 'ai-vision':
    case 'ai':
      return new AiVisionProvider({ url: opts.url });
    default:
      throw new Error(
        `Unknown captcha provider '${provider}'. Use '2captcha' or 'ai-vision'.`,
      );
  }
}
