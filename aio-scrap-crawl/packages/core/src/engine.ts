import type { ScrapeJob, CrawlJob, PageData, CrawlResult, PageSink } from './types';

/** What an engine can do. The orchestrator uses this to route jobs. */
export interface EngineCapabilities {
  scrape: boolean;
  crawl: boolean;
  /** Executes JavaScript / drives a real browser. */
  javascript: boolean;
  /** Produces clean markdown. */
  markdown: boolean;
  /** Schema/LLM structured extraction. */
  structured: boolean;
  /** Agentic automation (multi-step browser tasks). */
  agent: boolean;
}

/** Base contract every engine implements, native or remote. */
export interface Engine {
  readonly name: string;
  readonly capabilities: EngineCapabilities;
  /**
   * Whether this engine can actually run right now (binary present, service
   * reachable, dependency installed…). Lets the orchestrator degrade gracefully.
   */
  isAvailable(): Promise<boolean>;
}

export interface ScrapeEngine extends Engine {
  scrape(job: ScrapeJob): Promise<PageData>;
}

export interface CrawlEngine extends Engine {
  /** Crawl a site. `onPage` is called for each page as it is produced. */
  crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult>;
}

export function isScrapeEngine(e: Engine): e is ScrapeEngine {
  return typeof (e as Partial<ScrapeEngine>).scrape === 'function';
}

export function isCrawlEngine(e: Engine): e is CrawlEngine {
  return typeof (e as Partial<CrawlEngine>).crawl === 'function';
}

/** Thrown when an engine is selected but its external dependency is missing. */
export class EngineUnavailableError extends Error {
  constructor(engine: string, hint?: string) {
    super(`Engine '${engine}' is not available.${hint ? ' ' + hint : ''}`);
    this.name = 'EngineUnavailableError';
  }
}
