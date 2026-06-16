/**
 * py-ai adapter. Talks over HTTP to the Python AI microservice
 * (services/py-ai), which wraps Crawl4AI (markdown), ScrapeGraphAI (structured)
 * and browser-use (agentic). Configure PYAI_URL to enable.
 *
 * The service is expected to return PageData-shaped JSON so no remapping is
 * needed here beyond defaults.
 */
import {
  type ScrapeEngine,
  type EngineCapabilities,
  type ScrapeJob,
  type PageData,
  EngineUnavailableError,
} from '@aio/core';

export interface PyAiOptions {
  url?: string;
}

export class PyAiAdapter implements ScrapeEngine {
  readonly name = 'pyai';
  readonly capabilities: EngineCapabilities = {
    scrape: true,
    crawl: false,
    javascript: true,
    markdown: true,
    structured: true,
    agent: true,
  };

  private readonly url?: string;

  constructor(opts: PyAiOptions = {}) {
    this.url = opts.url?.replace(/\/+$/, '');
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
        'Set PYAI_URL and start services/py-ai (see its README).',
      );
    }
    const res = await fetch(`${this.url}/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: job.url,
        formats: job.formats ?? ['markdown', 'text'],
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
        error: `py-ai HTTP ${res.status}`,
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
