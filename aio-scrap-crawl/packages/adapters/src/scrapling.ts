/**
 * Scrapling adapter (LICENSE: Scrapling is BSD-3-Clause — permissive).
 *
 * Scrapling is a Python library, so it runs inside the py-ai microservice
 * (services/py-ai) and is reached over HTTP — same process boundary as the
 * `pyai` adapter, just selected with `engine: "scrapling"`. Configure PYAI_URL
 * to enable it.
 *
 * Why a separate engine rather than reusing `pyai`: Scrapling brings two
 * capabilities the Crawl4AI-backed `pyai` engine does not — stealth fetching
 * that clears anti-bot walls (e.g. Cloudflare Turnstile) out of the box, and
 * self-healing CSS selectors that survive page redesigns. Surfacing it as its
 * own engine lets `aio scrape --engine scrapling` and `aio engines` treat it
 * as a first-class choice.
 */
import {
  type ScrapeEngine,
  type EngineCapabilities,
  type ScrapeJob,
  type PageData,
  EngineUnavailableError,
} from '@aio/core';

export interface ScraplingOptions {
  /** Base URL of the py-ai service that hosts Scrapling (defaults to PYAI_URL). */
  url?: string;
  /** Use the stealth fetcher (anti-bot) by default. */
  stealth?: boolean;
  /** Enable self-healing/adaptive selectors. */
  adaptive?: boolean;
}

export class ScraplingAdapter implements ScrapeEngine {
  readonly name = 'scrapling';
  readonly capabilities: EngineCapabilities = {
    scrape: true,
    crawl: false,
    javascript: true,
    markdown: false,
    structured: true,
    agent: false,
  };

  private readonly url?: string;
  private readonly stealth: boolean;
  private readonly adaptive: boolean;

  constructor(opts: ScraplingOptions = {}) {
    this.url = opts.url?.replace(/\/+$/, '');
    this.stealth = opts.stealth ?? true;
    this.adaptive = opts.adaptive ?? false;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.url) return false;
    try {
      const res = await fetch(`${this.url}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async scrape(job: ScrapeJob): Promise<PageData> {
    if (!this.url) {
      throw new EngineUnavailableError(
        this.name,
        'Set PYAI_URL and start services/py-ai with scrapling installed (see its README).',
      );
    }
    const res = await fetch(`${this.url}/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: job.url,
        engine: 'scrapling',
        formats: job.formats ?? ['text', 'links'],
        stealth: this.stealth,
        adaptive: this.adaptive,
        extract: job.extract,
      }),
    });
    if (!res.ok) {
      return {
        url: job.url,
        ok: false,
        links: [],
        images: [],
        metadata: {},
        fetchedAt: new Date().toISOString(),
        engine: this.name,
        error: `scrapling HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as Partial<PageData>;
    return {
      url: data.url ?? job.url,
      finalUrl: data.finalUrl,
      statusCode: data.statusCode,
      ok: data.ok ?? true,
      title: data.title,
      description: data.description,
      html: data.html,
      text: data.text,
      markdown: data.markdown,
      links: data.links ?? [],
      images: data.images ?? [],
      metadata: data.metadata ?? {},
      structuredData: data.structuredData,
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
      engine: this.name,
      error: data.error,
    };
  }
}
