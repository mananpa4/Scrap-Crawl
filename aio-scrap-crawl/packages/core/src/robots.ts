/**
 * Minimal robots.txt support: fetch + cache per origin and check Disallow rules
 * for the `*` user-agent (plus an exact UA match if present).
 *
 * Intentionally small. For full RFC 9309 semantics, the Crawlee and Scrapy
 * engines bring their own robots handling.
 */

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

export class RobotsCache {
  private readonly cache = new Map<string, RobotsRules>();

  constructor(
    private readonly userAgent = '*',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async isAllowed(url: string): Promise<boolean> {
    let origin: string;
    let path: string;
    try {
      const u = new URL(url);
      origin = u.origin;
      path = u.pathname + u.search;
    } catch {
      return true;
    }

    const rules = await this.rulesFor(origin);
    if (!rules) return true;

    // Longest-match wins between allow and disallow.
    const allow = longestMatch(path, rules.allow);
    const disallow = longestMatch(path, rules.disallow);
    if (disallow === -1) return true;
    return allow >= disallow;
  }

  private async rulesFor(origin: string): Promise<RobotsRules | undefined> {
    const cached = this.cache.get(origin);
    if (cached) return cached;
    let rules: RobotsRules = { disallow: [], allow: [] };
    try {
      const res = await this.fetchImpl(`${origin}/robots.txt`, {
        headers: { 'user-agent': this.userAgent },
      });
      if (res.ok) rules = parseRobots(await res.text(), this.userAgent);
    } catch {
      // network error → treat as allow-all
    }
    this.cache.set(origin, rules);
    return rules;
  }
}

function parseRobots(text: string, userAgent: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { disallow: [], allow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && (field === 'disallow' || field === 'allow')) {
      lastWasAgent = false;
      if (field === 'disallow') current.rules.disallow.push(value);
      else current.rules.allow.push(value);
    }
  }

  const ua = userAgent.toLowerCase();
  const exact = groups.find((g) => g.agents.some((a) => a !== '*' && ua.includes(a)));
  const star = groups.find((g) => g.agents.includes('*'));
  const chosen = exact ?? star;
  return chosen
    ? {
        disallow: chosen.rules.disallow.filter(Boolean),
        allow: chosen.rules.allow.filter(Boolean),
      }
    : { disallow: [], allow: [] };
}

function longestMatch(path: string, rules: string[]): number {
  let best = -1;
  for (const rule of rules) {
    if (path.startsWith(rule) && rule.length > best) best = rule.length;
  }
  return best;
}
