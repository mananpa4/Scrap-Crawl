import {
  type Engine,
  type ScrapeEngine,
  type CrawlEngine,
  isScrapeEngine,
  isCrawlEngine,
} from './engine';

/** In-memory registry of available engines, keyed by name. */
export class EngineRegistry {
  private readonly engines = new Map<string, Engine>();

  register(engine: Engine): this {
    this.engines.set(engine.name, engine);
    return this;
  }

  has(name: string): boolean {
    return this.engines.has(name);
  }

  get(name: string): Engine | undefined {
    return this.engines.get(name);
  }

  list(): Engine[] {
    return [...this.engines.values()];
  }

  /** Resolve a scrape-capable engine or throw a clear error. */
  scrapeEngine(name: string): ScrapeEngine {
    const e = this.require(name);
    if (!isScrapeEngine(e)) throw new Error(`Engine '${name}' cannot scrape.`);
    return e;
  }

  /** Resolve a crawl-capable engine or throw a clear error. */
  crawlEngine(name: string): CrawlEngine {
    const e = this.require(name);
    if (!isCrawlEngine(e)) throw new Error(`Engine '${name}' cannot crawl.`);
    return e;
  }

  private require(name: string): Engine {
    const e = this.engines.get(name);
    if (!e) {
      const known = this.list()
        .map((x) => x.name)
        .join(', ');
      throw new Error(`Unknown engine '${name}'. Registered: ${known || '(none)'}`);
    }
    return e;
  }
}
