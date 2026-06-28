/**
 * Shared contract for the captcha-solving layer. Mirrors the engine pattern of
 * `@aio/core`: one challenge type in, one normalized solution out, regardless of
 * which provider (2Captcha, AI vision, …) actually solves it.
 */

/** Captcha families the solver layer understands. */
export type CaptchaType =
  | 'recaptcha-v2'
  | 'recaptcha-v3'
  | 'hcaptcha'
  | 'turnstile'
  | 'funcaptcha'
  | 'geetest'
  | 'image'
  | 'text';

/** A captcha to solve. Token captchas need `sitekey` + `url`; `image`/`text` use their fields. */
export interface CaptchaChallenge {
  type: CaptchaType;
  /** Page URL where the captcha is shown (token captchas). */
  url?: string;
  /** Site key found on the page (token captchas). */
  sitekey?: string;
  /** Base64 image or file path (image captcha). */
  image?: string;
  /** Question text (text captcha). */
  text?: string;
  /** reCAPTCHA v3 action. */
  action?: string;
  /** reCAPTCHA v3 minimum score. */
  minScore?: number;
  /** reCAPTCHA enterprise flag. */
  enterprise?: boolean;
  /** Provider-specific extras (e.g. GeeTest `gt`/`challenge`). */
  extra?: Record<string, unknown>;
}

/** The normalized result every provider returns. */
export interface CaptchaSolution {
  ok: boolean;
  type: CaptchaType;
  provider: string;
  /** Token to inject for token captchas (recaptcha/hcaptcha/turnstile/…). */
  token?: string;
  /** Text answer for image/text captchas. */
  text?: string;
  /** Provider-side id of the solved captcha. */
  id?: string;
  /** Reported cost, when the provider returns it. */
  cost?: number;
  error?: string;
}

/** Build a failed `CaptchaSolution` with a clear error. */
export function captchaError(
  type: CaptchaType,
  provider: string,
  error: string,
): CaptchaSolution {
  return { ok: false, type, provider, error };
}
