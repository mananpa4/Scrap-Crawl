/**
 * Crawlee-based engine. This is the recommended default for real workloads:
 * Crawlee (Apache-2.0) brings request queue, autoscaled concurrency, session
 * pool, proxy rotation and fingerprinting. Here we wire its CheerioCrawler to
 * the AIO's common ScrapeEngine/CrawlEngine contract.
 *
 * For JavaScript-heavy sites, swap CheerioCrawler for PlaywrightCrawler — the
 * mapping to PageData is identical.
 */
import { CheerioCrawler, Configuration, type CheerioCrawlingContext } from 'crawlee';
import {
  type ScrapeEngine,
  type CrawlEngine,
  type EngineCapabilities,
  type ScrapeJob,
  type CrawlJob,
  type PageData,
  type CrawlResult,
  type PageSink,
  normalizeUrl,
  sameOrigin,
  compilePatterns,
  matchesAny,
  htmlToText,
} from '@aio/core';

export class CrawleeEngine implements ScrapeEngine, CrawlEngine {
  readonly name = 'crawlee';
  readonly capabilities: EngineCapabilities = {
    scrape: true,
    crawl: true,
    javascript: false, // CheerioCrawler; use PlaywrightCrawler for JS
    markdown: false,
    structured: false,
    agent: false,
  };

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async scrape(job: ScrapeJob): Promise<PageData> {
    const start = normalizeUrl(job.url);
    if (!start) throw new Error(`Invalid URL: ${job.url}`);
    let captured: PageData | undefined;

    const crawler = this.buildCrawler({
      maxRequestsPerCrawl: 1,
      maxConcurrency: 1,
      userAgent: job.userAgent,
      onPage: (page) => {
        captured = page;
      },
    });
    await crawler.run([start]);

    return (
      captured ?? {
        url: start,
        ok: false,
        links: [],
        images: [],
        metadata: {},
        fetchedAt: new Date().toISOString(),
        engine: this.name,
        error: 'No response',
      }
    );
  }

  async crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult> {
    const start = normalizeUrl(job.startUrl);
    if (!start) throw new Error(`Invalid start URL: ${job.startUrl}`);

    const maxPages = job.maxPages ?? 50;
    const maxDepth = job.maxDepth ?? 2;
    const sameOriginOnly = job.sameOriginOnly ?? true;
    const include = compilePatterns(job.includePatterns);
    const exclude = compilePatterns(job.excludePatterns);
    const pages: PageData[] = [];
    const startedAt = Date.now();

    const crawler = this.buildCrawler({
      maxRequestsPerCrawl: maxPages,
      maxConcurrency: Math.max(1, job.concurrency ?? 5),
      userAgent: job.userAgent,
      onPage: (page, ctx) => {
        pages.push(page);
        onPage?.(page);

        if (!ctx) return; // failed request: nothing to enqueue
        const depth = (ctx.request.userData?.depth as number | undefined) ?? 0;
        if (depth >= maxDepth) return;
        const next = page.links.filter((link) => {
          if (sameOriginOnly && !sameOrigin(link, start)) return false;
          if (include.length && !matchesAny(link, include)) return false;
          if (exclude.length && matchesAny(link, exclude)) return false;
          return true;
        });
        void ctx.addRequests(
          next.map((url) => ({ url, userData: { depth: depth + 1 } })),
        );
      },
    });

    await crawler.run([{ url: start, userData: { depth: 0 } }]);

    return {
      startUrl: start,
      pages,
      count: pages.length,
      durationMs: Date.now() - startedAt,
      engine: this.name,
    };
  }

  private buildCrawler(opts: {
    maxRequestsPerCrawl: number;
    maxConcurrency: number;
    userAgent?: string;
    onPage: (page: PageData, ctx?: CheerioCrawlingContext) => void;
  }): CheerioCrawler {
    const engineName = this.name;
    return new CheerioCrawler(
      {
        maxRequestsPerCrawl: opts.maxRequestsPerCrawl,
        maxConcurrency: opts.maxConcurrency,
        async requestHandler(ctx) {
          opts.onPage(toPageData(ctx, engineName), ctx);
        },
        failedRequestHandler({ request }, error) {
          opts.onPage({
            url: request.url,
            ok: false,
            links: [],
            images: [],
            metadata: {},
            fetchedAt: new Date().toISOString(),
            engine: engineName,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
      // In-memory storage so the engine leaves no files behind.
      new Configuration({ persistStorage: false }),
    );
  }
}

function toPageData(ctx: CheerioCrawlingContext, engine: string): PageData {
  const { $, request, response } = ctx;
  const finalUrl = request.loadedUrl ?? request.url;

  const metadata: Record<string, string> = {};
  $('meta').each((_, el) => {
    const name =
      $(el).attr('name') ?? $(el).attr('property') ?? $(el).attr('itemprop');
    const content = $(el).attr('content');
    if (name && content !== undefined) metadata[name.toLowerCase()] = content.trim();
  });

  const links = unique(
    $('a[href]')
      .map((_, el) => normalizeUrl($(el).attr('href') ?? '', finalUrl))
      .get()
      .filter((u): u is string => Boolean(u)),
  );
  const images = unique(
    $('img[src]')
      .map((_, el) => normalizeUrl($(el).attr('src') ?? '', finalUrl))
      .get()
      .filter((u): u is string => Boolean(u)),
  );

  return {
    url: request.url,
    finalUrl: finalUrl !== request.url ? finalUrl : undefined,
    statusCode: response?.statusCode,
    ok: true,
    title: $('title').first().text().trim() || undefined,
    description: metadata['description'] ?? metadata['og:description'],
    text: htmlToText($.root().html() ?? ''),
    links,
    images,
    metadata,
    fetchedAt: new Date().toISOString(),
    engine,
  };
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
