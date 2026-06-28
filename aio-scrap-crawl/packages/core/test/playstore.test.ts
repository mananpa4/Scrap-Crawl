import { describe, expect, it } from 'vitest';
import { fetchPlaystoreApp, parsePlaystoreHtml, sizeImageUrl } from '../src/index';

const SAMPLE = `
<html><head><title>WhatsApp Messenger - Apps on Google Play</title></head>
<body>
  <h1 class="Fd93Bb">WhatsApp Messenger</h1>
  <a href="/store/apps/developer?id=WhatsApp+LLC">WhatsApp LLC</a>
  <img src="https://play-lh.googleusercontent.com/icon123=s180-rw" alt="Icon">
  <img src="https://play-lh.googleusercontent.com/shotAAA=w526-h296">
  <img src="https://play-lh.googleusercontent.com/shotBBB=w526-h296">
  <img src="https://play-lh.googleusercontent.com/shotAAA=w526-h296">
  <script>["pkg",[[["2.24.18.79","extra"]]]]</script>
</body></html>
`;

describe('playstore parser', () => {
  it('extracts title, developer, version, icon and screenshots', () => {
    const app = parsePlaystoreHtml('com.whatsapp', SAMPLE);
    expect(app.package).toBe('com.whatsapp');
    expect(app.title).toBe('WhatsApp Messenger');
    expect(app.developer).toBe('WhatsApp LLC');
    expect(app.version).toBe('2.24.18.79');
    expect(app.icon).toBe('https://play-lh.googleusercontent.com/icon123=w512-h512-rw');
    // deduped: shotAAA appears twice -> one entry; icon excluded
    expect(app.screenshots).toEqual([
      'https://play-lh.googleusercontent.com/shotAAA=w1080-h1920',
      'https://play-lh.googleusercontent.com/shotBBB=w1080-h1920',
    ]);
  });

  it('sizeImageUrl rewrites the trailing google sizing attribute', () => {
    const u = 'https://play-lh.googleusercontent.com/abc=s64';
    expect(sizeImageUrl(u, 240, 480, true)).toBe(
      'https://play-lh.googleusercontent.com/abc=w240-h480-rw',
    );
    expect(sizeImageUrl(u, 512, 512, false)).toBe(
      'https://play-lh.googleusercontent.com/abc=w512-h512',
    );
  });

  it('fetchPlaystoreApp uses the injected fetch impl', async () => {
    const fakeFetch = (async () =>
      ({ ok: true, status: 200, text: async () => SAMPLE }) as unknown as Response) as typeof fetch;
    const app = await fetchPlaystoreApp('com.whatsapp', { fetchImpl: fakeFetch });
    expect(app.title).toBe('WhatsApp Messenger');
    expect(app.icon).toContain('play-lh.googleusercontent.com');
  });
});
