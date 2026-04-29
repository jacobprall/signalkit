export function parseDomain(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl);
    const hostname = url.hostname;
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}
