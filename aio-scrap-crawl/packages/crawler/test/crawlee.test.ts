import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CrawleeEngine } from '../src/index';

describe('CrawleeEngine (offline E2E)', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const pages: Record<string, string> = {
        '/': '<title>Home</title><a href="/a">A</a><a href="/b">B</a>',
        '/a': '<title>A</title><a href="/">home</a>',
        '/b': '<title>B</title><a href="/a">A</a>',
      };
      const body = pages[req.url ?? '/'];
      if (body === undefined) {
        res.statusCode = 404;
        res.end('nope');
        return;
      }
      res.setHeader('content-type', 'text/html');
      res.end(`<html><body>${body}</body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (addr && typeof addr === 'object') base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('scrapes a single page into the common PageData shape', async () => {
    const engine = new CrawleeEngine();
    const page = await engine.scrape({ url: base });
    expect(page.engine).toBe('crawlee');
    expect(page.ok).toBe(true);
    expect(page.title).toBe('Home');
    expect(page.links.length).toBeGreaterThanOrEqual(2);
  });

  it('crawls same-origin pages and dedupes', async () => {
    const engine = new CrawleeEngine();
    const result = await engine.crawl({
      startUrl: base,
      maxPages: 10,
      maxDepth: 3,
      sameOriginOnly: true,
    });
    expect(result.engine).toBe('crawlee');
    expect(result.pages.length).toBe(3);
    expect(result.pages.map((p) => p.title).sort()).toEqual(['A', 'B', 'Home']);
  });
});
