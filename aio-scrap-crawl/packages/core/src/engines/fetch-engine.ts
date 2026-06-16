/**
 * Built-in engine using the global `fetch` (Node >=18) plus the dependency-free
 * HTML extractors. It implements both ScrapeEngine and CrawlEngine and needs no
 * external dependency, so the AIO can scrape/crawl out of the box.
 *
 * Limitations (by design): no JavaScript execution. For JS-heavy sites use the
 * Crawlee (`@aio/crawler`) or pyai engines.
 */
import type {
  ScrapeEngine,
  CrawlEngine,
  EngineCapabilities,
} from '../engine';
import type {
  ScrapeJob,
  CrawlJob,
  PageData,
  CrawlResult,
  PageSink,
  PageFormat,
} from '../types';
import {
  extractTitle,
  extractMetadata,
  metaDescription,
  extractLinks,
  extractImages,
  htmlToText,
} from '../html';
import {
  normalizeUrl,
  sameOrigin,
  UrlDeduper,
  compilePatterns,
  matchesAny,
} from '../url';
import { RobotsCache } from '../robots';

const DEFAULT_FORMATS: PageFormat[] = ['text', 'links', 'metadata'];

export interface FetchEngineOptions {
  userAgent?: string;
  defaultTimeoutMs?: number;
}

export class FetchEngine implements ScrapeEngine, CrawlEngine {
  readonly name = 'fetch';
  readonly capabilities: EngineCapabilities = {
    scrape: true,
    crawl: true,
    javascript: false,
    markdown: false,
    structured: false,
    agent: false,
  };

  private readonly userAgent: string;
  private readonly defaultTimeoutMs: number;

  constructor(opts: FetchEngineOptions = {}) {
    this.userAgent = opts.userAgent ?? 'aio-scrap-crawl/0.1';
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 15000;
  }

  async isAvailable(): Promise<boolean> {
    return typeof fetch === 'function';
  }

  async scrape(job: ScrapeJob): Promise<PageData> {
    return this.fetchPage(job.url, job.formats ?? DEFAULT_FORMATS, {
      timeoutMs: job.timeoutMs,
      userAgent: job.userAgent,
      headers: job.headers,
    });
  }

  async crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult> {
    const start = normalizeUrl(job.startUrl);
    if (!start) throw new Error(`Invalid start URL: ${job.startUrl}`);

    const maxPages = job.maxPages ?? 50;
    const maxDepth = job.maxDepth ?? 2;
    const sameOriginOnly = job.sameOriginOnly ?? true;
    const concurrency = Math.max(1, job.concurrency ?? 5);
    const delayMs = job.delayMs ?? 0;
    const formats = job.formats ?? DEFAULT_FORMATS;
    const include = compilePatterns(job.includePatterns);
    const exclude = compilePatterns(job.excludePatterns);
    const robots = job.respectRobots ? new RobotsCache(job.userAgent ?? this.userAgent) : null;

    const dedupe = new UrlDeduper();
    dedupe.add(start);
    const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
    const pages: PageData[] = [];
    const startedAt = Date.now();

    while (queue.length > 0 && pages.length < maxPages) {
      const batch = queue.splice(0, concurrency);
      const results = await Promise.all(
        batch.map(async ({ url, depth }) => {
          if (robots && !(await robots.isAllowed(url))) return null;
          const page = await this.fetchPage(url, formats, {
            userAgent: job.userAgent,
          });
          if (delayMs > 0) await sleep(delayMs);
          return { page, depth };
        }),
      );

      for (const r of results) {
        if (!r) continue;
        if (pages.length >= maxPages) break;
        pages.push(r.page);
        onPage?.(r.page);

        if (r.depth >= maxDepth || !r.page.ok) continue;
        for (const link of r.page.links) {
          if (sameOriginOnly && !sameOrigin(link, start)) continue;
          if (include.length && !matchesAny(link, include)) continue;
          if (exclude.length && matchesAny(link, exclude)) continue;
          if (dedupe.add(link)) queue.push({ url: link, depth: r.depth + 1 });
        }
      }
    }

    return {
      startUrl: start,
      pages,
      count: pages.length,
      durationMs: Date.now() - startedAt,
      engine: this.name,
    };
  }

  private async fetchPage(
    url: string,
    formats: PageFormat[],
    opts: { timeoutMs?: number; userAgent?: string; headers?: Record<string, string> },
  ): Promise<PageData> {
    const base: PageData = {
      url,
      ok: false,
      links: [],
      images: [],
      metadata: {},
      fetchedAt: new Date().toISOString(),
      engine: this.name,
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? this.defaultTimeoutMs,
    );

    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': opts.userAgent ?? this.userAgent,
          accept: 'text/html,application/xhtml+xml',
          ...opts.headers,
        },
      });

      base.statusCode = res.status;
      base.finalUrl = res.url && res.url !== url ? res.url : undefined;

      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        base.error = `HTTP ${res.status}`;
        return base;
      }
      if (!/html|xml|text/.test(contentType)) {
        base.ok = true;
        base.metadata['content-type'] = contentType;
        return base;
      }

      const html = await res.text();
      const baseUrl = base.finalUrl ?? url;
      const want = new Set(formats);

      base.metadata = extractMetadata(html);
      base.title = extractTitle(html);
      base.description = metaDescription(base.metadata);
      base.links = extractLinks(html, baseUrl);

      if (want.has('images')) base.images = extractImages(html, baseUrl);
      if (want.has('html')) base.html = html;
      if (want.has('text') || want.has('markdown')) base.text = htmlToText(html);
      base.ok = true;
      return base;
    } catch (err) {
      base.error = err instanceof Error ? err.message : String(err);
      return base;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
