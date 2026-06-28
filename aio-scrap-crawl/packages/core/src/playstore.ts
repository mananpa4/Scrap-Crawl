/**
 * Google Play Store metadata + image extractor.
 *
 * Given an Android package id, returns the app's title, developer, version and
 * — the point of this module — the `play-lh.googleusercontent.com` icon and
 * screenshot URLs. Consumers (e.g. dowdes.com) link those remote images instead
 * of storing local copies. Use `sizeImageUrl` to apply the Google sizing suffix
 * (`=w240-h480-rw`).
 *
 * Zero dependencies: native `fetch` + regex, matching the FetchEngine philosophy.
 */

export interface PlaystoreApp {
  package: string;
  title: string;
  developer: string;
  version: string;
  /** Square icon URL (already upsized). */
  icon: string;
  /** Screenshot URLs (deduplicated, full-size). */
  screenshots: string[];
  url: string;
}

export interface PlaystoreOptions {
  hl?: string; // UI language, default 'en'
  gl?: string; // country, default 'US'
  fetchImpl?: typeof fetch;
}

const SIZE_SUFFIX = /=[sw][\dA-Za-z-]+$/;

/** Rewrite the trailing Google image sizing attribute, e.g. `=w240-h480-rw`. */
export function sizeImageUrl(
  url: string,
  width = 240,
  height: number | null = 480,
  crop = true,
): string {
  if (!url) return url;
  const base = url.replace(SIZE_SUFFIX, '');
  let attr = `=w${width}`;
  if (height) attr += `-h${height}`;
  if (crop) attr += '-rw';
  return base + attr;
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=');
}

/** Parse a Play Store details page HTML into a PlaystoreApp. */
export function parsePlaystoreHtml(pkg: string, html: string): PlaystoreApp {
  const app: PlaystoreApp = {
    package: pkg,
    title: pkg,
    developer: '',
    version: '',
    icon: '',
    screenshots: [],
    url: `https://play.google.com/store/apps/details?id=${pkg}`,
  };

  const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];
  if (title) app.title = decode(title.trim());

  const dev = html.match(/href="\/store\/apps\/developer[^"]*"[^>]*>([^<]+)<\/a>/)?.[1];
  if (dev) app.developer = decode(dev.trim());

  for (const re of [/\[\[\["(\d+\.\d+[^"]*)"/, /"softwareVersion"\s*:\s*"([^"]+)"/]) {
    const v = html.match(re)?.[1];
    if (v && /^\d+\./.test(v) && v.length < 50) {
      app.version = v.trim();
      break;
    }
  }

  // Icon: the first play-lh image with an =s<size> or =w<size> suffix.
  const icon = html.match(
    /https:\/\/play-lh\.googleusercontent\.com\/[\w-]+=[sw][\d-]+[\w-]*/,
  )?.[0];
  if (icon) app.icon = sizeImageUrl(icon, 512, 512);

  // Screenshots: play-lh images sized as =w<W>-h<H>.
  const iconBase = app.icon.replace(SIZE_SUFFIX, '');
  const seen = new Set<string>();
  for (const m of html.matchAll(
    /https:\/\/play-lh\.googleusercontent\.com\/[\w-]+=w\d+-h\d+/g,
  )) {
    const full = m[0];
    if (!full) continue;
    const base = full.replace(SIZE_SUFFIX, '');
    if (base !== iconBase && !seen.has(base)) {
      seen.add(base);
      app.screenshots.push(sizeImageUrl(full, 1080, 1920, false));
    }
  }

  return app;
}

export async function fetchPlaystoreApp(
  pkg: string,
  opts: PlaystoreOptions = {},
): Promise<PlaystoreApp> {
  const { hl = 'en', gl = 'US', fetchImpl = fetch } = opts;
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=${hl}&gl=${gl}`;
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; aio-scrap-crawl/0.1; +playstore-module)' },
  });
  if (!res.ok) {
    throw new Error(`Play Store fetch failed for ${pkg}: HTTP ${res.status}`);
  }
  return parsePlaystoreHtml(pkg, await res.text());
}
