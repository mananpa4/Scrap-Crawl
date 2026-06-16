/**
 * Firecrawl adapter (LICENSE: Firecrawl is AGPL-3.0).
 *
 * We DO NOT vendor Firecrawl's source — that would force AGPL on the whole AIO.
 * Instead we talk to a self-hosted or hosted Firecrawl API over HTTP, keeping it
 * behind a clean process boundary. Configure FIRECRAWL_API_URL to enable.
 *
 * Endpoint reference: POST {base}/v1/scrape  and  POST {base}/v1/crawl
 */
import {
  type ScrapeEngine,
  type CrawlEngine,
  type EngineCapabilities,
  type ScrapeJob,
  type CrawlJob,
  type PageData,
  type CrawlResult,
  type PageSink,
  EngineUnavailableError,
  normalizeUrl,
} from '@aio/core';

export interface FirecrawlOptions {
  apiUrl?: string;
  apiKey?: string;
}

export class FirecrawlAdapter implements ScrapeEngine, CrawlEngine {
  readonly name = 'firecrawl';
  readonly capabilities: EngineCapabilities = {
    scrape: true,
    crawl: true,
    javascript: true,
    markdown: true,
    structured: true,
    agent: false,
  };

  private readonly apiUrl?: string;
  private readonly apiKey?: string;

  constructor(opts: FirecrawlOptions = {}) {
    this.apiUrl = opts.apiUrl?.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiUrl) return false;
    try {
      const res = await fetch(`${this.apiUrl}/v1/scrape`, { method: 'OPTIONS' });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  async scrape(job: ScrapeJob): Promise<PageData> {
    const base = this.requireBase();
    const res = await fetch(`${base}/v1/scrape`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url: job.url,
        formats: ['markdown', 'html', 'links'],
      }),
    });
    const json = (await res.json()) as FirecrawlScrapeResponse;
    return this.toPageData(job.url, json);
  }

  async crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult> {
    const base = this.requireBase();
    const startedAt = Date.now();
    // NOTE: Firecrawl's crawl is async (job id + polling). This minimal sync
    // path requests a bounded crawl; see TODO.md to wire the polling/webhook.
    const res = await fetch(`${base}/v1/crawl`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        url: job.startUrl,
        limit: job.maxPages ?? 50,
        maxDepth: job.maxDepth ?? 2,
        scrapeOptions: { formats: ['markdown', 'links'] },
      }),
    });
    const json = (await res.json()) as FirecrawlCrawlResponse;
    const pages = (json.data ?? []).map((d) =>
      this.toPageData(d.metadata?.sourceURL ?? job.startUrl, { data: d }),
    );
    for (const p of pages) onPage?.(p);
    return {
      startUrl: job.startUrl,
      pages,
      count: pages.length,
      durationMs: Date.now() - startedAt,
      engine: this.name,
    };
  }

  private requireBase(): string {
    if (!this.apiUrl) {
      throw new EngineUnavailableError(
        this.name,
        'Set FIRECRAWL_API_URL to a running Firecrawl instance (see docker-compose.yml).',
      );
    }
    return this.apiUrl;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  private toPageData(url: string, res: FirecrawlScrapeResponse): PageData {
    const d = res.data ?? {};
    const meta = d.metadata ?? {};
    return {
      url,
      finalUrl: meta.sourceURL && meta.sourceURL !== url ? meta.sourceURL : undefined,
      statusCode: meta.statusCode,
      ok: Boolean(d.markdown || d.html),
      title: meta.title,
      description: meta.description,
      html: d.html,
      markdown: d.markdown,
      links: (d.links ?? [])
        .map((l) => normalizeUrl(l))
        .filter((u): u is string => Boolean(u)),
      images: [],
      metadata: flatten(meta),
      fetchedAt: new Date().toISOString(),
      engine: this.name,
    };
  }
}

interface FirecrawlDoc {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
    [k: string]: unknown;
  };
}
interface FirecrawlScrapeResponse {
  data?: FirecrawlDoc;
}
interface FirecrawlCrawlResponse {
  data?: FirecrawlDoc[];
}

function flatten(meta: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v == null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(' ') : String(v);
  }
  return out;
}
