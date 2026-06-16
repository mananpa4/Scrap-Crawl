import { Command } from 'commander';
import {
  loadConfig,
  createLogger,
  serialize,
  exportToFile,
  defaultOutputPath,
  type PageData,
  type OutputFormat,
  type PageFormat,
} from '@aio/core';
import { sanitizeText } from '@aio/security';
import { buildRegistry } from './registry-factory';

const config = loadConfig();
const logger = createLogger({ level: config.logLevel, json: config.logJson, scope: 'aio' });

const program = new Command();
program
  .name('aio')
  .description('All-In-One scraping/crawling orchestrator')
  .version('0.1.0');

program
  .command('scrape')
  .argument('<url>', 'URL to scrape')
  .description('Scrape a single URL with the selected engine')
  .option('-e, --engine <name>', 'engine to use', config.defaultEngine)
  .option('-f, --format <fmt>', 'output format: json|jsonl|csv', 'json')
  .option('-o, --out <file>', 'write to file instead of stdout')
  .option('--markdown', 'request markdown output (engine permitting)')
  .option('--html', 'include raw html in output')
  .option('--timeout <ms>', 'request timeout in ms')
  .option('--no-sanitize', 'do not run the security sanitizer on text/markdown')
  .action(async (url: string, opts) => {
    await run(async () => {
      const engineName = opts.engine as string;
      const registry = await buildRegistry(config, {
        withCrawlee: engineName === 'crawlee',
      });
      const engine = registry.scrapeEngine(engineName);
      await assertAvailable(engine.name, await engine.isAvailable());

      const formats: PageFormat[] = ['text', 'links', 'metadata'];
      if (opts.markdown) formats.push('markdown');
      if (opts.html) formats.push('html');

      logger.info(`scrape ${url} via ${engine.name}`);
      const page = await engine.scrape({
        url,
        formats,
        timeoutMs: opts.timeout ? Number(opts.timeout) : undefined,
      });

      const finalPage = opts.sanitize ? sanitizePage(page) : page;
      await output([finalPage], opts.format as OutputFormat, opts.out, 'scrape', url);
      logger.info(page.ok ? 'done' : `failed: ${page.error ?? 'unknown'}`);
    });
  });

program
  .command('crawl')
  .argument('<url>', 'start URL to crawl')
  .description('Crawl a site starting from URL')
  .option('-e, --engine <name>', 'engine to use', config.defaultEngine)
  .option('-f, --format <fmt>', 'output format: json|jsonl|csv', 'json')
  .option('-o, --out <file>', 'write to file instead of stdout')
  .option('--max-pages <n>', 'maximum pages', String(config.maxPages))
  .option('--max-depth <n>', 'maximum depth', String(config.maxDepth))
  .option('--concurrency <n>', 'concurrent requests', String(config.concurrency))
  .option('--delay <ms>', 'politeness delay per worker', String(config.delayMs))
  .option('--all-origins', 'follow links to other origins')
  .option('--no-robots', 'ignore robots.txt')
  .option('--no-sanitize', 'do not run the security sanitizer on text/markdown')
  .action(async (url: string, opts) => {
    await run(async () => {
      const engineName = opts.engine as string;
      const registry = await buildRegistry(config, {
        withCrawlee: engineName === 'crawlee',
      });
      const engine = registry.crawlEngine(engineName);
      await assertAvailable(engine.name, await engine.isAvailable());

      logger.info(`crawl ${url} via ${engine.name}`);
      let n = 0;
      const result = await engine.crawl(
        {
          startUrl: url,
          maxPages: Number(opts.maxPages),
          maxDepth: Number(opts.maxDepth),
          concurrency: Number(opts.concurrency),
          delayMs: Number(opts.delay),
          sameOriginOnly: !opts.allOrigins,
          respectRobots: opts.robots,
        },
        (p) => {
          n += 1;
          logger.debug(`[${n}] ${p.ok ? 'ok ' : 'err'} ${p.url}`);
        },
      );

      const pages = opts.sanitize ? result.pages.map(sanitizePage) : result.pages;
      await output(pages, opts.format as OutputFormat, opts.out, 'crawl', url);
      logger.info(`done: ${result.count} pages in ${result.durationMs}ms`);
    });
  });

program
  .command('engines')
  .description('List registered engines, their capabilities and availability')
  .action(async () => {
    await run(async () => {
      const registry = await buildRegistry(config, { withCrawlee: true });
      const rows = await Promise.all(
        registry.list().map(async (e) => ({
          name: e.name,
          available: await e.isAvailable(),
          ...e.capabilities,
        })),
      );
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    });
  });

program.parseAsync(process.argv);

// ---------------------------------------------------------------------------

async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

async function assertAvailable(name: string, available: boolean): Promise<void> {
  if (!available) {
    throw new Error(
      `Engine '${name}' is not available. Check its configuration in .env (see .env.example).`,
    );
  }
}

function sanitizePage(page: PageData): PageData {
  const events: string[] = [];
  const out = { ...page };
  if (out.text) {
    const r = sanitizeText(out.text);
    out.text = r.clean;
    events.push(...r.events);
  }
  if (out.markdown) {
    const r = sanitizeText(out.markdown);
    out.markdown = r.clean;
    events.push(...r.events);
  }
  if (events.length) {
    out.metadata = { ...out.metadata, 'security.events': [...new Set(events)].join(',') };
  }
  return out;
}

async function output(
  pages: PageData[],
  format: OutputFormat,
  outFile: string | undefined,
  kind: string,
  seedUrl: string,
): Promise<void> {
  if (outFile) {
    await exportToFile(pages, outFile, format);
    logger.info(`wrote ${pages.length} record(s) to ${outFile}`);
    return;
  }
  if (kind === 'crawl' && !outFile) {
    // Auto-name crawl output so large result sets don't flood stdout.
    const path = defaultOutputPath(config.outputDir, kind, seedUrl, format);
    await exportToFile(pages, path, format);
    logger.info(`wrote ${pages.length} record(s) to ${path}`);
    return;
  }
  process.stdout.write(serialize(pages, format) + '\n');
}
