import crypto from 'crypto';

export function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export interface DiscoveredLinks {
  careersUrl: string | null;
  loginUrl: string | null;
}

const CAREER_PATTERNS = [
  /\/careers\b/i,
  /\/jobs\b/i,
  /jobs\./i,
  /careers\./i,
  /\/hiring\b/i,
];

const LOGIN_PATTERNS = [
  /\/login\b/i,
  /\/signin\b/i,
  /\/sign-in\b/i,
  /\/signup\b/i,
  /\/sign-up\b/i,
  /\/app\b/i,
  /\/dashboard\b/i,
];

export function discoverLinks(
  baseUrl: string,
  hrefs: string[],
): DiscoveredLinks {
  let careersUrl: string | null = null;
  let loginUrl: string | null = null;

  const base = new URL(baseUrl);

  for (const href of hrefs) {
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      continue;
    }

    const isSameDomain =
      resolved.hostname === base.hostname ||
      resolved.hostname.endsWith(`.${base.hostname}`);
    if (!isSameDomain) continue;

    const fullUrl = resolved.href;

    if (!careersUrl) {
      for (const pattern of CAREER_PATTERNS) {
        if (pattern.test(fullUrl)) {
          careersUrl = fullUrl;
          break;
        }
      }
    }

    if (!loginUrl) {
      for (const pattern of LOGIN_PATTERNS) {
        if (pattern.test(fullUrl)) {
          loginUrl = fullUrl;
          break;
        }
      }
    }

    if (careersUrl && loginUrl) break;
  }

  return { careersUrl, loginUrl };
}

export function cleanText(text: string): string {
  return text
    .replace(/\n\s*\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

export function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}
