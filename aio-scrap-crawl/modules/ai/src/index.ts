/**
 * AI facade. The heavy LLM work (Crawl4AI markdown, ScrapeGraphAI structured
 * extraction, browser-use agents) lives in the Python service `services/py-ai`,
 * because that is where those libraries are native. This module provides a thin,
 * provider-agnostic TypeScript surface over that service plus shared config.
 *
 * Security note: content should be passed through `@aio/security` (WipeDown)
 * BEFORE being sent to any provider. The CLI/orchestrator enforces this.
 */
import type { PageData } from '@aio/core';

export type LlmProvider = 'openai' | 'anthropic' | 'ollama' | 'mistral' | 'groq';

export interface AiConfig {
  provider: LlmProvider;
  model: string;
  /** Base URL of the py-ai service. */
  serviceUrl?: string;
}

export interface ExtractRequest {
  url: string;
  /** JSON schema or example object describing the desired output. */
  schema?: unknown;
  /** Natural-language extraction instruction. */
  prompt?: string;
}

export interface ExtractResult {
  url: string;
  structuredData: unknown;
  /** The page the data was extracted from, when returned by the service. */
  page?: PageData;
}

/** Thin client over the py-ai service's /extract endpoint. */
export class AiClient {
  private readonly serviceUrl?: string;

  constructor(private readonly config: AiConfig) {
    this.serviceUrl = config.serviceUrl?.replace(/\/+$/, '');
  }

  async isAvailable(): Promise<boolean> {
    if (!this.serviceUrl) return false;
    try {
      const res = await fetch(`${this.serviceUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async extract(req: ExtractRequest): Promise<ExtractResult> {
    if (!this.serviceUrl) {
      throw new Error(
        'AI service not configured. Set PYAI_URL and start services/py-ai.',
      );
    }
    const res = await fetch(`${this.serviceUrl}/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: req.url,
        schema: req.schema,
        prompt: req.prompt,
        provider: this.config.provider,
        model: this.config.model,
      }),
    });
    if (!res.ok) throw new Error(`py-ai /extract failed: HTTP ${res.status}`);
    return (await res.json()) as ExtractResult;
  }
}
