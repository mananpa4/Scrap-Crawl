/**
 * Centralized configuration. Reads `.env` (via dotenv) and validates with zod,
 * producing one typed config object the whole AIO shares.
 */
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import type { LogLevel } from './logger';

const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : /^(1|true|yes|on)$/i.test(v)));

const intish = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? def : Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    });

const Schema = z.object({
  defaultEngine: z.string().default('fetch'),
  logLevel: z
    .enum(['debug', 'info', 'warn', 'error', 'silent'])
    .default('info') as z.ZodType<LogLevel>,
  logJson: boolish(false),
  outputDir: z.string().default('./output'),
  userAgent: z.string().default('aio-scrap-crawl/0.1'),

  maxPages: intish(50),
  maxDepth: intish(2),
  concurrency: intish(5),
  delayMs: intish(0),
  respectRobots: boolish(true),

  firecrawlApiUrl: z.string().optional(),
  firecrawlApiKey: z.string().optional(),
  katanaBin: z.string().optional(),
  pyaiUrl: z.string().optional(),

  securitySanitize: boolish(true),
  wipedownUrl: z.string().optional(),
});

export type AioConfig = z.infer<typeof Schema>;

let cached: AioConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AioConfig {
  if (cached) return cached;
  loadDotenv();
  cached = Schema.parse({
    defaultEngine: pick(env, 'AIO_DEFAULT_ENGINE'),
    logLevel: pick(env, 'AIO_LOG_LEVEL'),
    logJson: pick(env, 'AIO_LOG_JSON'),
    outputDir: pick(env, 'AIO_OUTPUT_DIR'),
    userAgent: pick(env, 'AIO_USER_AGENT'),
    maxPages: pick(env, 'AIO_MAX_PAGES'),
    maxDepth: pick(env, 'AIO_MAX_DEPTH'),
    concurrency: pick(env, 'AIO_CONCURRENCY'),
    delayMs: pick(env, 'AIO_DELAY_MS'),
    respectRobots: pick(env, 'AIO_RESPECT_ROBOTS'),
    firecrawlApiUrl: pick(env, 'FIRECRAWL_API_URL'),
    firecrawlApiKey: pick(env, 'FIRECRAWL_API_KEY'),
    katanaBin: pick(env, 'KATANA_BIN'),
    pyaiUrl: pick(env, 'PYAI_URL'),
    securitySanitize: pick(env, 'AIO_SECURITY_SANITIZE'),
    wipedownUrl: pick(env, 'WIPEDOWN_URL'),
  });
  return cached;
}

/** Reset the memoized config (useful in tests). */
export function resetConfig(): void {
  cached = undefined;
}

function pick(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const v = env[key];
  return v === undefined || v === '' ? undefined : v;
}
