/**
 * Normalized job and result model shared by every engine.
 *
 * The whole point of the AIO is that any engine (built-in, Crawlee, Firecrawl,
 * Katana, the Python AI service…) speaks this exact vocabulary, so the CLI, API
 * and exporters never need to know which engine produced the data.
 */

/** Content representations a caller may request for a page. */
export type PageFormat =
  | 'html'
  | 'text'
  | 'markdown'
  | 'links'
  | 'images'
  | 'metadata'
  | 'structured';

/** Supported export formats. */
export type OutputFormat = 'json' | 'jsonl' | 'csv';

/** A single fetched/parsed page — the universal output unit. */
export interface PageData {
  /** Requested URL. */
  url: string;
  /** URL after redirects, if different. */
  finalUrl?: string;
  /** HTTP status code, when known. */
  statusCode?: number;
  /** True when the page was retrieved and parsed successfully. */
  ok: boolean;
  title?: string;
  description?: string;
  /** Raw HTML (only when 'html' format requested). */
  html?: string;
  /** Plain text extracted from the page. */
  text?: string;
  /** Markdown rendering (engines that support it). */
  markdown?: string;
  /** Absolute, de-duplicated outbound links. */
  links: string[];
  /** Absolute image URLs. */
  images: string[];
  /** Flat metadata map (meta tags, og:*, etc.). */
  metadata: Record<string, string>;
  /** Structured data extracted via schema/LLM (engine dependent). */
  structuredData?: unknown;
  /** ISO timestamp of retrieval. */
  fetchedAt: string;
  /** Name of the engine that produced this record. */
  engine: string;
  /** Set when ok === false. */
  error?: string;
}

/** Request to scrape a single URL. */
export interface ScrapeJob {
  url: string;
  formats?: PageFormat[];
  timeoutMs?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  /** Extraction schema/prompt for structured engines (pyai/firecrawl). */
  extract?: { schema?: unknown; prompt?: string };
}

/** Request to crawl a site starting from one URL. */
export interface CrawlJob {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  /** Restrict to the same origin as startUrl. */
  sameOriginOnly?: boolean;
  /** Only follow links whose URL matches one of these regexes (source strings). */
  includePatterns?: string[];
  /** Skip links whose URL matches any of these regexes (source strings). */
  excludePatterns?: string[];
  respectRobots?: boolean;
  concurrency?: number;
  /** Politeness delay between requests, per worker. */
  delayMs?: number;
  userAgent?: string;
  formats?: PageFormat[];
}

/** Aggregated result of a crawl. */
export interface CrawlResult {
  startUrl: string;
  pages: PageData[];
  count: number;
  durationMs: number;
  engine: string;
}

/** Callback invoked for each page as a crawl streams results. */
export type PageSink = (page: PageData) => void;
