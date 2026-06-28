import type { CaptchaChallenge, CaptchaSolution } from './types';

/**
 * Every captcha provider implements this. Same shape as the AIO engine
 * contract: a name, a graceful availability probe, and one `solve()` call.
 */
export interface CaptchaSolver {
  readonly name: string;
  /** False when the provider is not configured/usable, so callers degrade instead of crashing. */
  isAvailable(): Promise<boolean>;
  solve(challenge: CaptchaChallenge): Promise<CaptchaSolution>;
}
