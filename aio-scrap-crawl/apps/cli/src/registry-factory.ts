import { EngineRegistry, FetchEngine, type AioConfig } from '@aio/core';
import {
  FirecrawlAdapter,
  KatanaAdapter,
  PyAiAdapter,
  ScraplingAdapter,
} from '@aio/adapters';

export interface BuildRegistryOptions {
  /** Lazily load the heavy Crawlee engine (only when requested). */
  withCrawlee?: boolean;
}

/**
 * Assemble the engine registry from configuration. Light adapters are always
 * registered (they self-report availability); the Crawlee engine is imported
 * dynamically so the CLI starts fast and works even if it isn't installed.
 */
export async function buildRegistry(
  config: AioConfig,
  opts: BuildRegistryOptions = {},
): Promise<EngineRegistry> {
  const registry = new EngineRegistry();

  registry.register(new FetchEngine({ userAgent: config.userAgent }));
  registry.register(
    new FirecrawlAdapter({
      apiUrl: config.firecrawlApiUrl,
      apiKey: config.firecrawlApiKey,
    }),
  );
  registry.register(new KatanaAdapter({ bin: config.katanaBin }));
  registry.register(new PyAiAdapter({ url: config.pyaiUrl }));
  registry.register(new ScraplingAdapter({ url: config.pyaiUrl }));

  if (opts.withCrawlee) {
    try {
      const { CrawleeEngine } = await import('@aio/crawler');
      registry.register(new CrawleeEngine());
    } catch {
      // @aio/crawler not installed — fine, FetchEngine covers basic crawling.
    }
  }

  return registry;
}
