/**
 * Katana adapter (LICENSE: MIT). Katana is a Go binary, so we shell out to it
 * and parse its JSONL output. Great for fast URL discovery / site mapping.
 *
 * Requires the `katana` binary on PATH or via KATANA_BIN. Install:
 *   go install github.com/projectdiscovery/katana/cmd/katana@latest
 */
import { spawn } from 'node:child_process';
import {
  type CrawlEngine,
  type EngineCapabilities,
  type CrawlJob,
  type PageData,
  type CrawlResult,
  type PageSink,
  EngineUnavailableError,
  normalizeUrl,
} from '@aio/core';

export interface KatanaOptions {
  bin?: string;
}

export class KatanaAdapter implements CrawlEngine {
  readonly name = 'katana';
  readonly capabilities: EngineCapabilities = {
    scrape: false,
    crawl: true,
    javascript: true, // -headless mode supported
    markdown: false,
    structured: false,
    agent: false,
  };

  private readonly bin: string;

  constructor(opts: KatanaOptions = {}) {
    this.bin = opts.bin || 'katana';
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(this.bin, ['-version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0 || code === null));
    });
  }

  async crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult> {
    if (!(await this.isAvailable())) {
      throw new EngineUnavailableError(
        this.name,
        `Katana binary '${this.bin}' not found. Set KATANA_BIN or install it.`,
      );
    }

    const args = [
      '-u', job.startUrl,
      '-jsonl',
      '-silent',
      '-depth', String(job.maxDepth ?? 2),
    ];
    if (job.concurrency) args.push('-concurrency', String(job.concurrency));
    if (job.sameOriginOnly === false) args.push('-field-scope', 'rdn');

    const startedAt = Date.now();
    const pages: PageData[] = [];
    const maxPages = job.maxPages ?? 50;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.bin, args);
      let buffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line || pages.length >= maxPages) continue;
          const page = parseKatanaLine(line, this.name);
          if (page) {
            pages.push(page);
            onPage?.(page);
            if (pages.length >= maxPages) child.kill();
          }
        }
      });
      child.on('error', reject);
      child.on('close', () => resolve());
    });

    return {
      startUrl: job.startUrl,
      pages,
      count: pages.length,
      durationMs: Date.now() - startedAt,
      engine: this.name,
    };
  }
}

function parseKatanaLine(line: string, engine: string): PageData | null {
  try {
    const obj = JSON.parse(line) as {
      request?: { endpoint?: string; url?: string };
      response?: { status_code?: number };
      timestamp?: string;
    };
    const url = obj.request?.endpoint ?? obj.request?.url;
    if (!url) return null;
    return {
      url: normalizeUrl(url) ?? url,
      ok: true,
      statusCode: obj.response?.status_code,
      links: [],
      images: [],
      metadata: {},
      fetchedAt: obj.timestamp ?? new Date().toISOString(),
      engine,
    };
  } catch {
    return null;
  }
}
