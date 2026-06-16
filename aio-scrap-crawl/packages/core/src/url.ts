/** URL normalization and de-duplication helpers shared by every crawl engine. */

/**
 * Normalize a URL for de-duplication and crawling:
 * - resolves against an optional base
 * - keeps only http/https
 * - lowercases the host, drops the fragment and default ports
 * - removes a trailing slash (except on root) and sorts query params
 *
 * Returns `null` for non-web or unparseable URLs.
 */
export function normalizeUrl(input: string, base?: string): string | null {
  let u: URL;
  try {
    u = new URL(input, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.hash = '';
  u.hostname = u.hostname.toLowerCase();

  if (
    (u.protocol === 'http:' && u.port === '80') ||
    (u.protocol === 'https:' && u.port === '443')
  ) {
    u.port = '';
  }

  if (u.searchParams.toString()) {
    const sorted = [...u.searchParams.entries()].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    u.search = new URLSearchParams(sorted).toString();
  }

  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }

  return u.toString();
}

export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Tracks seen (normalized) URLs so a crawl never visits the same page twice. */
export class UrlDeduper {
  private readonly seen = new Set<string>();

  /** Returns true if the URL is new (and records it), false if already seen. */
  add(url: string): boolean {
    const key = normalizeUrl(url) ?? url;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  has(url: string): boolean {
    return this.seen.has(normalizeUrl(url) ?? url);
  }

  get size(): number {
    return this.seen.size;
  }
}

/** Compile pattern strings into RegExp, skipping invalid ones. */
export function compilePatterns(patterns?: string[]): RegExp[] {
  if (!patterns?.length) return [];
  const out: RegExp[] = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(p));
    } catch {
      // ignore invalid pattern
    }
  }
  return out;
}

export function matchesAny(url: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(url));
}
