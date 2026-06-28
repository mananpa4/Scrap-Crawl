/**
 * Advanced multi-site APK resolver: apkpure / uptodown / apkmirror.
 *
 * Given an Android package id, resolves a **direct, validated** APK download URL
 * from one of the mirror sites — chosen at random with fallback, so a single
 * site being down, rate-limiting, or changing markup doesn't break the flow.
 * Needs no Google auth, which makes it the "live download" source when no Play
 * dispenser is configured.
 *
 * Each site resolver does a small multi-step crawl (search → detail → download
 * page) with browser-like headers, then `probeUrl` follows redirects (without
 * downloading the body) to confirm the final URL yields a real file. The HTML
 * parsing steps are pure functions exported for unit testing.
 *
 * Reality check: mirrors change markup and add anti-bot (Cloudflare on
 * apkmirror) frequently. apkpure is the most reliable; uptodown/apkmirror are
 * best-effort and gracefully fall through to the next site on failure.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function browserHeaders(referer?: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) h.Referer = referer;
  return h;
}

export type ApkSite = 'apkpure' | 'uptodown' | 'apkmirror';
export const ALL_SITES: ApkSite[] = ['apkpure', 'uptodown', 'apkmirror'];

export interface ApkSourceResult {
  site: ApkSite;
  url: string;
  package: string;
  version: string;
  ext: string; // apk | xapk
  filename: string;
  headers: Record<string, string>;
}

export interface ResolveOptions {
  site?: ApkSite | 'random';
  order?: ApkSite[];
  fetchImpl?: typeof fetch;
}

interface Probe {
  finalUrl: string;
  contentLength?: number;
}

// --- low-level helpers ------------------------------------------------------

async function fetchText(
  url: string,
  fetchImpl: typeof fetch,
  referer?: string,
): Promise<string | null> {
  try {
    const res = await fetchImpl(url, { headers: browserHeaders(referer), redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Follow up to `maxHops` manual redirects without consuming the body. */
export async function probeUrl(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  maxHops = 6,
): Promise<Probe | null> {
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(current, { method: 'GET', redirect: 'manual', headers });
    } catch {
      return null;
    }
    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get('location');
      void res.body?.cancel();
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    if (status === 200) {
      const type = (res.headers.get('content-type') ?? '').toLowerCase();
      const len = Number(res.headers.get('content-length') ?? '0');
      void res.body?.cancel(); // don't download here; the caller streams it
      if (type.includes('text/html')) return null; // a page, not a file
      return { finalUrl: current, contentLength: len || undefined };
    }
    void res.body?.cancel();
    return null;
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i]!;
    a[i] = a[j]!;
    a[j] = ai;
  }
  return a;
}

function done(
  site: ApkSite,
  pkg: string,
  url: string,
  extra: Partial<ApkSourceResult> = {},
): ApkSourceResult {
  const ext = extra.ext ?? (url.toLowerCase().includes('.xapk') ? 'xapk' : 'apk');
  return {
    site,
    url,
    package: pkg,
    version: extra.version ?? '',
    ext,
    filename: extra.filename ?? `${pkg}.${ext}`,
    headers: { 'User-Agent': UA },
  };
}

// --- pure HTML parsers (exported for tests) ---------------------------------

export function parseApkpureDetailUrl(html: string, pkg: string): string | null {
  // Prefer a detail link that ends with the exact package id.
  const exact = html.match(
    new RegExp(`href="(https://apkpure\\.[a-z]+/[^"]+/${pkg.replace(/\./g, '\\.')})"`),
  )?.[1];
  if (exact) return exact;
  const rel = html.match(new RegExp(`href="(/[^"]+/${pkg.replace(/\./g, '\\.')})"`))?.[1];
  return rel ? new URL(rel, 'https://apkpure.com').toString() : null;
}

export function parseApkpureDownloadUrl(html: string): string | null {
  return (
    html.match(/id="download_link"[^>]*href="([^"]+)"/)?.[1] ??
    html.match(/href="(https:\/\/(?:download|d)\.apkpure\.[a-z]+\/[^"]+)"/)?.[1] ??
    html.match(/"(https:\/\/(?:download|d)\.apkpure\.[a-z]+\/[^"]+\.x?apk[^"]*)"/)?.[1] ??
    null
  );
}

export function parseUptodownAppUrl(html: string): string | null {
  return html.match(/https:\/\/[\w-]+\.en\.uptodown\.com\/android/)?.[0] ?? null;
}

export function parseUptodownDownloadUrl(html: string): string | null {
  const direct =
    html.match(/data-url="([^"]+)"/)?.[1] ??
    html.match(/https:\/\/dw\.uptodown\.com\/dwn\/[^"'<> ]+/)?.[0] ??
    null;
  if (!direct) return null;
  if (direct.startsWith('http')) return direct;
  return `https://dw.uptodown.com/dwn/${direct}`;
}

export function parseApkmirrorReleasePath(html: string): string | null {
  // Download pages end with "...-apk-download/" (sometimes a "/download/" segment).
  return html.match(/href="(\/apk\/[^"]+download\/)"/)?.[1] ?? null;
}

export function parseApkmirrorDownloadKeyUrl(html: string): string | null {
  const rel =
    html.match(/href="([^"]*\/wp-content\/themes\/[^"]*download\.php\?[^"]+)"/)?.[1] ??
    html.match(/href="([^"]+\?[^"]*forcebaseapk=[^"]+)"/)?.[1] ??
    html.match(/<a[^>]+class="[^"]*downloadButton[^"]*"[^>]+href="([^"]+)"/)?.[1] ??
    null;
  return rel ? new URL(rel, 'https://www.apkmirror.com').toString() : null;
}

// --- per-site resolvers -----------------------------------------------------

async function resolveApkpure(
  pkg: string,
  fetchImpl: typeof fetch,
): Promise<ApkSourceResult | null> {
  // 1) Fast path: the canonical direct endpoint (302 → CDN).
  const legacy = await probeUrl(
    `https://d.apkpure.com/b/APK/${pkg}?version=latest`,
    browserHeaders(),
    fetchImpl,
  );
  if (legacy) return done('apkpure', pkg, legacy.finalUrl);

  // 2) Robust path: search → detail → download page → direct link.
  const search = await fetchText(
    `https://apkpure.com/search?q=${encodeURIComponent(pkg)}`,
    fetchImpl,
  );
  if (!search) return null;
  const detail = parseApkpureDetailUrl(search, pkg);
  if (!detail) return null;
  const dl = await fetchText(`${detail.replace(/\/$/, '')}/download`, fetchImpl, detail);
  if (!dl) return null;
  const direct = parseApkpureDownloadUrl(dl);
  if (!direct) return null;
  const probe = await probeUrl(direct, browserHeaders(detail), fetchImpl);
  if (!probe) return null;
  return done('apkpure', pkg, probe.finalUrl);
}

async function resolveUptodown(
  pkg: string,
  fetchImpl: typeof fetch,
): Promise<ApkSourceResult | null> {
  const search = await fetchText(
    `https://en.uptodown.com/android/search?q=${encodeURIComponent(pkg)}`,
    fetchImpl,
  );
  if (!search) return null;
  const appUrl = parseUptodownAppUrl(search);
  if (!appUrl) return null;
  const dl = await fetchText(`${appUrl}/download`, fetchImpl, appUrl);
  if (!dl) return null;
  const direct = parseUptodownDownloadUrl(dl);
  if (!direct) return null;
  const probe = await probeUrl(direct, browserHeaders(appUrl), fetchImpl);
  if (!probe) return null;
  return done('uptodown', pkg, probe.finalUrl);
}

async function resolveApkmirror(
  pkg: string,
  fetchImpl: typeof fetch,
): Promise<ApkSourceResult | null> {
  const search = await fetchText(
    `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(pkg)}`,
    fetchImpl,
  );
  if (!search) return null;
  const releasePath = parseApkmirrorReleasePath(search);
  if (!releasePath) return null;
  const releaseUrl = new URL(releasePath, 'https://www.apkmirror.com').toString();
  const dlPage = await fetchText(releaseUrl, fetchImpl, 'https://www.apkmirror.com/');
  if (!dlPage) return null;
  const keyUrl = parseApkmirrorDownloadKeyUrl(dlPage);
  if (!keyUrl) return null;
  // The key page either redirects to the file or embeds the final link.
  const probe = await probeUrl(keyUrl, browserHeaders(releaseUrl), fetchImpl);
  if (probe) return done('apkmirror', pkg, probe.finalUrl);
  const keyHtml = await fetchText(keyUrl, fetchImpl, releaseUrl);
  if (!keyHtml) return null;
  const finalLink = parseApkmirrorDownloadKeyUrl(keyHtml);
  if (!finalLink) return null;
  const probe2 = await probeUrl(finalLink, browserHeaders(keyUrl), fetchImpl);
  return probe2 ? done('apkmirror', pkg, probe2.finalUrl) : null;
}

const RESOLVERS: Record<ApkSite, (p: string, f: typeof fetch) => Promise<ApkSourceResult | null>> = {
  apkpure: resolveApkpure,
  uptodown: resolveUptodown,
  apkmirror: resolveApkmirror,
};

/**
 * Resolve a direct APK URL. With `site:'random'` (default), tries the sites in a
 * random order and returns the first that yields a validated download.
 */
export async function resolveApk(
  pkg: string,
  opts: ResolveOptions = {},
): Promise<ApkSourceResult> {
  const { site = 'random', fetchImpl = fetch } = opts;
  const order: ApkSite[] =
    site && site !== 'random' ? [site] : opts.order ?? shuffle(ALL_SITES);

  let lastErr = '';
  for (const s of order) {
    try {
      const result = await RESOLVERS[s](pkg, fetchImpl);
      if (result) return result;
      lastErr = `${s}: no download found`;
    } catch (e) {
      lastErr = `${s}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  throw new Error(`no APK source resolved for ${pkg} (${lastErr})`);
}
