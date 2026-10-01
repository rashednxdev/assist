import { Linking } from 'react-native';
import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

const WEB_BASE = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ibas-web.onrender.com').trim().replace(/\/+$/, '');

export function webUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return `${WEB_BASE}${href.startsWith('/') ? href : `/${href}`}`;
}

/**
 * Maps a web app path (as returned by the API, e.g. "/toolkit/123") to the matching mobile screen.
 * Returns null when the mobile app has no equivalent screen.
 */
export function mobileHref(href: string): Href | null {
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  const p = (path ?? '').replace(/\/+$/, '');
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/books\/([^/]+)\/read\/rule\/([^/]+)$/))) return `/(app)/books/${m[1]}/rule/${m[2]}` as Href;
  if ((m = p.match(/^\/books\/([^/]+)(?:\/read)?$/)) && m[1] !== 'regulations') return `/(app)/books/${m[1]}` as Href;
  if ((m = p.match(/^\/toolkit\/([^/]+)$/))) return `/(app)/toolkit/${m[1]}` as Href;
  if ((m = p.match(/^\/circulars\/([^/]+)$/))) return `/(app)/circulars/${m[1]}` as Href;
  if ((m = p.match(/^\/guided-tasks\/([^/]+)$/)) && m[1] !== 'my-runs') return `/(app)/guided-tasks/${m[1]}` as Href;
  if ((m = p.match(/^\/community\/([^/]+)$/)) && m[1] !== 'blood-bank') return `/(app)/community/${m[1]}` as Href;
  if (p === '/schedule' && params.get('event')) return `/(app)/schedule/${params.get('event')}` as Href;
  if (p === '/ibas' && params.get('area')) return `/(app)/ibas/${params.get('area')}` as Href;

  const direct: Record<string, string> = {
    '/schedule': '/(app)/schedule',
    '/policy': '/(app)/policy',
    '/circulars': '/(app)/circulars',
    '/ibas': '/(app)/ibas',
    '/toolkit': '/(app)/toolkit',
    '/guided-tasks': '/(app)/guided-tasks',
    '/guided-tasks/my-runs': '/(app)/guided-tasks/my-runs',
    '/workflow/inbox': '/(app)/workflow/inbox',
    '/workflow/guide': '/(app)/workflow/guide',
    '/search': '/(app)/search',
    '/packages': '/(app)/pricing',
    '/salary': '/(app)/salary',
    '/community': '/(app)/community',
    '/community/blood-bank': '/(app)/blood-bank',
    '/contacts': '/(app)/contacts',
    '/settings/profile': '/(app)/account/work',
    '/books': '/(app)/books',
    '/static-ref/jsi-2016-p': '/(app)/static-ref',
    '/pension': '/(app)/pension',
    '/joining-period': '/(app)/joining-period',
  };
  if (direct[p]) return (query ? `${direct[p]}?${query}` : direct[p]) as Href;
  return null;
}

/** Opens a web-style path in the app when there is a matching screen, otherwise on the website. */
export function openHref(router: Router, href: string): void {
  const target = mobileHref(href);
  if (target) router.push(target);
  else void Linking.openURL(webUrl(href));
}
