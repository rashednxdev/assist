/** Helpers so admin PDF links open as a preview first, then download on demand. */

function extractGoogleDriveId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^/]+)/i,
    /drive\.google\.com\/open\?[^#]*\bid=([^&]+)/i,
    /drive\.google\.com\/uc\?[^#]*\bid=([^&]+)/i,
    /docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([^/]+)/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** URL that prefers an in-app preview (view) instead of a forced download. */
export function toViewablePdfUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return url;

  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }

  if (/dropbox\.com/i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set('dl', '0');
      return u.toString();
    } catch {
      return url.includes('dl=') ? url.replace(/dl=\d/, 'dl=0') : `${url}${url.includes('?') ? '&' : '?'}dl=0`;
    }
  }

  // Direct PDF links: Google Docs embedded viewer so the file is previewed first.
  if (/\.pdf(\?|#|$)/i.test(url)) {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }

  return url;
}

/** URL best suited for saving/sharing the file (download). */
export function toDownloadablePdfUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) return url;

  const driveId = extractGoogleDriveId(url);
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }

  if (/dropbox\.com/i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set('dl', '1');
      return u.toString();
    } catch {
      return url.includes('dl=') ? url.replace(/dl=\d/, 'dl=1') : `${url}${url.includes('?') ? '&' : '?'}dl=1`;
    }
  }

  return url;
}

export function safePdfFilename(title?: string, fallback = 'book'): string {
  const base = (title?.trim() || fallback).replace(/[^\w.\-]+/g, '_').slice(0, 48) || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
