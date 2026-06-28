import { describe, expect, it } from 'vitest';
import { resolveApk } from '../src/index';
import {
  parseApkpureDetailUrl,
  parseApkpureDownloadUrl,
  parseUptodownAppUrl,
  parseUptodownDownloadUrl,
  parseApkmirrorReleasePath,
  parseApkmirrorDownloadKeyUrl,
} from '../src/apksource';

function mk(status: number, headers: Record<string, string>, body = ''): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    text: async () => body,
    body: { cancel: async () => {} },
  } as unknown as Response;
}

describe('apksource resolver', () => {
  it('apkpure: follows the 302 to the CDN and returns the final url', async () => {
    const fetchImpl = (async (url: string) => {
      if (url === 'https://d.apkpure.com/b/APK/com.whatsapp?version=latest')
        return mk(302, { location: 'https://download.apkpure.com/x/com.whatsapp.apk' });
      if (url === 'https://download.apkpure.com/x/com.whatsapp.apk')
        return mk(200, {
          'content-type': 'application/vnd.android.package-archive',
          'content-length': '1048576',
        });
      return mk(404, {});
    }) as unknown as typeof fetch;

    const r = await resolveApk('com.whatsapp', { site: 'apkpure', fetchImpl });
    expect(r.site).toBe('apkpure');
    expect(r.url).toBe('https://download.apkpure.com/x/com.whatsapp.apk');
    expect(r.ext).toBe('apk');
  });

  it('random/fallback: skips a failing site and resolves the next', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.startsWith('https://www.apkmirror.com')) return mk(404, {});
      if (url === 'https://d.apkpure.com/b/APK/com.foo?version=latest')
        return mk(200, { 'content-type': 'application/octet-stream', 'content-length': '500000' });
      return mk(404, {});
    }) as unknown as typeof fetch;

    const r = await resolveApk('com.foo', { order: ['apkmirror', 'apkpure'], fetchImpl });
    expect(r.site).toBe('apkpure');
  });

  it('rejects an HTML page as a download and throws when nothing resolves', async () => {
    const fetchImpl = (async () =>
      mk(200, { 'content-type': 'text/html', 'content-length': '200' })) as unknown as typeof fetch;
    await expect(resolveApk('com.bar', { site: 'apkpure', fetchImpl })).rejects.toThrow();
  });
});

describe('apksource HTML parsers', () => {
  it('apkpure detail + download extraction', () => {
    const search =
      '<a href="https://apkpure.com/whatsapp-messenger/com.whatsapp">WhatsApp</a>';
    expect(parseApkpureDetailUrl(search, 'com.whatsapp')).toBe(
      'https://apkpure.com/whatsapp-messenger/com.whatsapp',
    );
    const dl =
      '<a id="download_link" href="https://download.apkpure.com/b/APK/com.whatsapp.apk?k=1">Get</a>';
    expect(parseApkpureDownloadUrl(dl)).toBe(
      'https://download.apkpure.com/b/APK/com.whatsapp.apk?k=1',
    );
  });

  it('uptodown app + download extraction', () => {
    const search =
      'rel="noopener" href="https://whatsapp.en.uptodown.com/android" class="name">';
    expect(parseUptodownAppUrl(search)).toBe('https://whatsapp.en.uptodown.com/android');
    const dl = '<button class="button" data-url="https://dw.uptodown.com/dwn/abc123">';
    expect(parseUptodownDownloadUrl(dl)).toBe('https://dw.uptodown.com/dwn/abc123');
  });

  it('apkmirror release + key extraction', () => {
    const search =
      '<a class="fontBlack" href="/apk/whatsapp-inc/whatsapp/whatsapp-2-24-1-release/whatsapp-2-24-1-android-apk-download/">';
    expect(parseApkmirrorReleasePath(search)).toBe(
      '/apk/whatsapp-inc/whatsapp/whatsapp-2-24-1-release/whatsapp-2-24-1-android-apk-download/',
    );
    const dlPage =
      '<a rel="nofollow" class="downloadButton" href="/wp-content/themes/APKMirror/download.php?id=12345&key=abcdef">';
    expect(parseApkmirrorDownloadKeyUrl(dlPage)).toBe(
      'https://www.apkmirror.com/wp-content/themes/APKMirror/download.php?id=12345&key=abcdef',
    );
  });
});
