/**
 * Minimal, dependency-free HTML extraction.
 *
 * This powers the built-in FetchEngine so the AIO works out of the box without
 * installing a browser stack. For heavy/JS-rendered pages use the Crawlee or
 * pyai engines, which use real parsers/browsers.
 */
import { normalizeUrl } from './url';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? safeFromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]!).trim() : undefined;
}

/** Extract all <meta> tags into a flat map keyed by name/property. */
export function extractMetadata(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const tagRe = /<meta\b[^>]*>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(html))) {
    const raw = tag[0];
    const key =
      attr(raw, 'name') ?? attr(raw, 'property') ?? attr(raw, 'itemprop') ?? attr(raw, 'http-equiv');
    const content = attr(raw, 'content');
    if (key && content !== undefined) meta[key.toLowerCase()] = decodeEntities(content).trim();
  }
  return meta;
}

export function metaDescription(meta: Record<string, string>): string | undefined {
  return meta['description'] ?? meta['og:description'] ?? meta['twitter:description'];
}

export function extractLinks(html: string, baseUrl: string): string[] {
  return collectAttr(html, /<a\b[^>]*>/gi, 'href', baseUrl);
}

export function extractImages(html: string, baseUrl: string): string[] {
  return collectAttr(html, /<img\b[^>]*>/gi, 'src', baseUrl);
}

function collectAttr(
  html: string,
  tagRe: RegExp,
  name: string,
  baseUrl: string,
): string[] {
  const out = new Set<string>();
  let tag: RegExpExecArray | null;
  while ((tag = tagRe.exec(html))) {
    const value = attr(tag[0], name);
    if (!value) continue;
    const abs = normalizeUrl(decodeEntities(value), baseUrl);
    if (abs) out.add(abs);
  }
  return [...out];
}

/** Strip scripts/styles and tags to produce readable plain text. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withBreaks = withoutBlocks
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const text = withBreaks.replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Read a single HTML attribute value from a tag string. */
function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const m = re.exec(tag);
  if (!m) return undefined;
  return m[2] ?? m[3] ?? m[4] ?? '';
}
