/**
 * Citation validator. A lead or signal is kept only if it cites a URL that search actually returned.
 * URLs are compared after normalisation (scheme, www, trailing slash, hash, tracking params).
 */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (k.startsWith("utm_")) url.searchParams.delete(k);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    const qs = url.searchParams.toString();
    return `${host}${path}${qs ? "?" + qs : ""}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

export interface Cited { sourceUrls: string[] }

export function validateCitations<T extends Cited>(items: T[], returnedUrls: Iterable<string>) {
  const allowed = new Map<string, string>();
  for (const u of returnedUrls) allowed.set(normalizeUrl(u), u);
  const kept: (T & { sourceUrls: string[] })[] = [];
  const dropped: { item: T; reason: string }[] = [];
  for (const item of items) {
    const valid = item.sourceUrls.map((u) => allowed.get(normalizeUrl(u))).filter((u): u is string => Boolean(u));
    if (valid.length === 0) dropped.push({ item, reason: "No source URL matches a search result" });
    else kept.push({ ...item, sourceUrls: [...new Set(valid)] });
  }
  return { kept, dropped };
}

export function isReturned(url: string, returnedUrls: Iterable<string>): string | null {
  const n = normalizeUrl(url);
  for (const u of returnedUrls) if (normalizeUrl(u) === n) return u;
  return null;
}

export function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
