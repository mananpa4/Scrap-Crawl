/** Public API of @aio/core — the shared contract for the whole AIO. */

export * from './types';
export * from './engine';
export { EngineRegistry } from './registry';
export { createLogger, type Logger, type LogLevel, type LoggerOptions } from './logger';
export { loadConfig, resetConfig, type AioConfig } from './config';
export {
  normalizeUrl,
  sameOrigin,
  UrlDeduper,
  compilePatterns,
  matchesAny,
} from './url';
export { RobotsCache } from './robots';
export {
  serialize,
  exportToFile,
  defaultOutputPath,
} from './exporters';
export {
  decodeEntities,
  extractTitle,
  extractMetadata,
  metaDescription,
  extractLinks,
  extractImages,
  htmlToText,
} from './html';
export { FetchEngine, type FetchEngineOptions } from './engines/fetch-engine';
export {
  fetchPlaystoreApp,
  parsePlaystoreHtml,
  sizeImageUrl,
  type PlaystoreApp,
  type PlaystoreOptions,
} from './playstore';
export {
  resolveApk,
  ALL_SITES,
  type ApkSite,
  type ApkSourceResult,
  type ResolveOptions,
} from './apksource';

export const CORE_VERSION = '0.1.0';
