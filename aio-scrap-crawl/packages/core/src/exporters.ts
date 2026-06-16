/**
 * Unified exporters. Every engine emits `PageData`, so one set of exporters
 * serves the whole AIO. Inspired by Scrapy's feed exports.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { OutputFormat, PageData } from './types';

/** Columns used for the flat CSV export. */
const CSV_COLUMNS: (keyof PageData)[] = [
  'url',
  'finalUrl',
  'statusCode',
  'ok',
  'title',
  'description',
  'engine',
  'fetchedAt',
  'links',
  'images',
  'error',
];

export function serialize(pages: PageData[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(pages, null, 2);
    case 'jsonl':
      return pages.map((p) => JSON.stringify(p)).join('\n');
    case 'csv':
      return toCsv(pages);
  }
}

export async function exportToFile(
  pages: PageData[],
  filePath: string,
  format: OutputFormat,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serialize(pages, format), 'utf8');
}

function toCsv(pages: PageData[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = pages.map((p) =>
    CSV_COLUMNS.map((col) => csvCell(p[col])).join(','),
  );
  return [header, ...rows].join('\n');
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const str = Array.isArray(value) ? value.join(' ') : String(value);
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

/** Build a default output path like `output/crawl-<host>-<ts>.json`. */
export function defaultOutputPath(
  dir: string,
  kind: string,
  seedUrl: string,
  format: OutputFormat,
): string {
  let host = 'site';
  try {
    host = new URL(seedUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
  } catch {
    /* keep default */
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${dir.replace(/\/+$/, '')}/${kind}-${host}-${ts}.${format}`;
}
