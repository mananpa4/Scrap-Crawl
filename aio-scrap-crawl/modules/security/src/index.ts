/**
 * Content security, inspired by WipeDown (MIT).
 *
 * Untrusted web/page content is a known prompt-injection vector. Before any
 * scraped content is handed to an LLM, run it through `sanitize()`:
 *   - the local heuristic sanitizer (zero deps) strips common injection markers,
 *     hidden/zero-width characters and imperative override phrases;
 *   - if a WipeDown service is configured, it is used for deeper semantic
 *     neutralization and the local pass is skipped.
 */

export interface SanitizeResult {
  /** Sanitized text. */
  clean: string;
  /** True when fully-malicious input was neutralized to (near) empty. */
  flagged: boolean;
  /** Human-readable list of what was removed/normalized. */
  events: string[];
}

/** Phrases commonly used to hijack an agent reading scraped content. */
const INJECTION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ignore (all |the )?(previous|prior|above) (instructions|prompts?)/gi, label: 'override-instruction' },
  { re: /disregard (all |the )?(previous|prior|above)/gi, label: 'override-instruction' },
  { re: /you are now (a|an|in) .{0,40}(mode|assistant|developer)/gi, label: 'role-reassignment' },
  { re: /system\s*prompt\s*[:>]/gi, label: 'system-prompt-spoof' },
  { re: /<\s*\/?\s*(system|assistant|user)\s*>/gi, label: 'chat-role-tag' },
  { re: /\b(execute|run|eval)\b.{0,30}\b(command|code|shell|os\.system)\b/gi, label: 'exec-directive' },
  { re: /print\s+["']?!{2,}/gi, label: 'marker-injection' },
];

/**
 * Zero-width and bidi control characters used to hide instructions:
 * U+200B-U+200F, U+202A-U+202E, U+2060-U+2064, U+FEFF.
 */
const HIDDEN_CHARS = new RegExp('[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', 'g');

export function sanitizeText(input: string): SanitizeResult {
  const events: string[] = [];
  let text = input;

  if (HIDDEN_CHARS.test(text)) {
    text = text.replace(HIDDEN_CHARS, '');
    events.push('removed-hidden-characters');
  }

  for (const { re, label } of INJECTION_PATTERNS) {
    if (re.test(text)) {
      text = text.replace(re, '[redacted]');
      events.push(label);
    }
  }

  const original = input.replace(/\s+/g, '').length;
  const remaining = text.replace(/\[redacted\]/g, '').replace(/\s+/g, '').length;
  const flagged = original > 0 && remaining / original < 0.2;

  return { clean: flagged ? '' : text, flagged, events };
}

export interface WipeDownClientOptions {
  url?: string;
}

/** Client for the WipeDown service (exposed via services/py-ai or standalone). */
export class WipeDownClient {
  private readonly url?: string;

  constructor(opts: WipeDownClientOptions = {}) {
    this.url = opts.url?.replace(/\/+$/, '');
  }

  async isAvailable(): Promise<boolean> {
    if (!this.url) return false;
    try {
      const res = await fetch(`${this.url}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async sanitize(content: string, source?: string): Promise<SanitizeResult> {
    if (!this.url) return sanitizeText(content);
    try {
      const res = await fetch(`${this.url}/sanitize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, source }),
      });
      if (!res.ok) return sanitizeText(content);
      const json = (await res.json()) as {
        status?: string;
        content?: string;
        metadata?: { sanitization_events?: string[] };
      };
      return {
        clean: json.content ?? '',
        flagged: json.status === 'flagged',
        events: json.metadata?.sanitization_events ?? [],
      };
    } catch {
      return sanitizeText(content);
    }
  }
}

/**
 * High-level entry point: use the remote WipeDown service when configured,
 * otherwise fall back to the local heuristic sanitizer.
 */
export async function sanitize(
  content: string,
  opts: { url?: string; source?: string } = {},
): Promise<SanitizeResult> {
  if (opts.url) return new WipeDownClient({ url: opts.url }).sanitize(content, opts.source);
  return sanitizeText(content);
}
