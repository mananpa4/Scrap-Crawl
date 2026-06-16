import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FetchEngine,
  normalizeUrl,
  UrlDeduper,
  serialize,
  htmlToText,
  extractLinks,
  extractMetadata,
  type PageData,
} from '../src/index';

describe('url normalization', () => {
  it('drops fragments, default ports and trailing slash; sorts query', () => {
    expect(normalizeUrl('http://Example.com:80/a/?b=2&a=1#frag')).toBe(
      'http://example.com/a?a=1&b=2',
    );
  });
  it('rejects non-http schemes', () => {
    expect(normalizeUrl('mailto:x@y.com')).toBeNull();
    expect(normalizeUrl('javascript:void(0)')).toBeNull();
  });
  it('resolves relative URLs against a base', () => {
    expect(normalizeUrl('/about', 'https://site.test/blog/')).toBe(
      'https://site.test/about',
    );
  });
});

describe('UrlDeduper', () => {
  it('treats normalized-equivalent URLs as duplicates', () => {
    const d = new UrlDeduper();
    expect(d.add('http://x.test/a/')).toBe(true);
    expect(d.add('http://x.test/a')).toBe(false);
    expect(d.size).toBe(1);
  });
});

describe('html extraction', () => {
  const html = `<html><head><title>Hi &amp; Bye</title>
    <meta name="description" content="A page"></head>
    <body><p>Hello <b>world</b></p><a href="/next">n</a></body></html>`;
  it('extracts text, metadata and links', () => {
    expect(htmlToText(html)).toContain('Hello world');
    expect(extractMetadata(html).description).toBe('A page');
    expect(extractLinks(html, 'http://x.test/')).toContain('http://x.test/next');
  });
});

describe('exporters', () => {
  const pages: PageData[] = [
    {
      url: 'http://x.test/',
      ok: true,
      links: ['http://x.test/a'],
      images: [],
      metadata: {},
      fetchedAt: '2026-01-01T00:00:00.000Z',
      engine: 'fetch',
      title: 'Home, sweet "home"',
    },
  ];
  it('serializes JSON, JSONL and CSV', () => {
    expect(JSON.parse(serialize(pages, 'json'))).toHaveLength(1);
    expect(serialize(pages, 'jsonl').split('\n')).toHaveLength(1);
    const csv = serialize(pages, 'csv').split('\n');
    expect(csv[0]).toContain('url,finalUrl');
    expect(csv[1]).toContain('"Home, sweet ""home"""');
  });
});

describe('FetchEngine crawl (offline E2E)', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? '/';
      const pages: Record<string, string> = {
        '/': `<title>Home</title><a href="/a">A</a><a href="/b">B</a><a href="/a">dup</a>`,
        '/a': `<title>A</title><a href="/">home</a><a href="https://external.test/x">ext</a>`,
        '/b': `<title>B</title><a href="/a">A again</a>`,
      };
      const body = pages[path];
      if (body === undefined) {
        res.statusCode = 404;
        res.end('not found');
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

  it('crawls same-origin pages, dedupes and respects maxPages', async () => {
    const engine = new FetchEngine();
    const seen: string[] = [];
    const result = await engine.crawl(
      { startUrl: base, maxPages: 10, maxDepth: 3, sameOriginOnly: true, respectRobots: false },
      (p) => seen.push(p.url),
    );

    expect(result.pages.length).toBe(3);
    expect(result.engine).toBe('fetch');
    expect(seen.length).toBe(3);
    // external link must not have been followed
    expect(result.pages.every((p) => p.url.startsWith(base))).toBe(true);
    // titles extracted
    expect(result.pages.map((p) => p.title).sort()).toEqual(['A', 'B', 'Home']);
  });

  it('caps results at maxPages', async () => {
    const engine = new FetchEngine();
    const result = await engine.crawl({
      startUrl: base,
      maxPages: 1,
      maxDepth: 3,
      respectRobots: false,
    });
    expect(result.pages.length).toBe(1);
  });
});
