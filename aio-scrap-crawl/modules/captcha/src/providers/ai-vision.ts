/**
 * AI-vision provider — self-hosted alternative to a paid solving service.
 *
 * Uses a large multimodal model (GPT-4o / Gemini) via the py-ai service to read
 * and solve image/puzzle/text/audio captchas, driven by the same browser-use +
 * @aio/ai stack the AIO already ships. No per-solve fee — you pay your own LLM
 * provider. Inspired by the `ai-captcha-bypass` repo.
 *
 * The py-ai endpoint is currently a documented stub (`/captcha/solve` with
 * `provider: "ai"` returns `not-implemented`), so this reports
 * `isAvailable(): false` until wired. Lower success rate than the commercial
 * service; meant as a no-cost fallback.
 */
import type { CaptchaSolver } from '../solver';
import type { CaptchaChallenge, CaptchaSolution } from '../types';
import { normalizeBase, providerReady, solveVia } from './pyai-client';

export interface AiVisionOptions {
  /** Base URL of the py-ai service that hosts the vision solver (PYAI_URL). */
  url?: string;
}

export class AiVisionProvider implements CaptchaSolver {
  readonly name = 'ai-vision';
  private readonly url?: string;

  constructor(opts: AiVisionOptions = {}) {
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
      'Set PYAI_URL and configure an LLM key (OPENAI_API_KEY/GEMINI_API_KEY) for the AI-vision solver.',
    );
  }
}
