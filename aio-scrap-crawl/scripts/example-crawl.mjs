/**
 * Offline demo: starts a tiny local site and crawls it with the built-in
 * FetchEngine from @aio/core. Run after `pnpm build`:
 *
 *   node scripts/example-crawl.mjs
 */
import { createServer } from 'node:http';
// Import from the built core package (run `pnpm build` first).
import { FetchEngine, serialize } from '../packages/core/dist/index.js';

const SITE = {
  '/': '<title>Demo Home</title><a href="/about">About</a><a href="/products">Products</a>',
  '/about': '<title>About</title><a href="/">Home</a>',
  '/products': '<title>Products</title><a href="/products/1">One</a><a href="/products/2">Two</a>',
  '/products/1': '<title>Product One</title><a href="/products">Back</a>',
  '/products/2': '<title>Product Two</title><a href="/products">Back</a>',
};

const server = createServer((req, res) => {
  const body = SITE[req.url ?? '/'];
  if (body === undefined) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(`<html><body>${body}</body></html>`);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

console.error(`Crawling ${base} ...`);
const engine = new FetchEngine();
const result = await engine.crawl(
  { startUrl: base, maxPages: 20, maxDepth: 3, respectRobots: false },
  (p) => console.error(`  + ${p.title ?? '(no title)'} — ${p.url}`),
);

console.error(`\nDone: ${result.count} pages in ${result.durationMs}ms\n`);
console.log(serialize(result.pages, 'csv'));

await new Promise((resolve) => server.close(resolve));
