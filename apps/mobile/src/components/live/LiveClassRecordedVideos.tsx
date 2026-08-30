import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  recordedContentPlayback,
  recordedContentSource,
  type LiveStreamRecordedContent,
} from '@ibas/shared-types';
import { colors, spacing } from '@/theme';

interface Props {
  items: LiveStreamRecordedContent[];
}

const ANTI_SHARE_JS = `
(function(){
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, true);
  document.addEventListener('dragstart', function(e){ e.preventDefault(); }, true);
  document.addEventListener('copy', function(e){ e.preventDefault(); }, true);
  document.addEventListener('selectstart', function(e){ e.preventDefault(); }, true);
  var style = document.createElement('style');
  style.textContent = '*{ -webkit-user-select:none!important; user-select:none!important; -webkit-touch-callout:none!important; }';
  document.documentElement.appendChild(style);
})();
true;
`;

/**
 * Best-effort hide of Zoom share-page chrome (blue Zoom wordmark + recording title).
 * Zoom does not offer an official setting; DOM may change and some chrome can remain.
 */
const ZOOM_HIDE_CHROME_JS = `
(function(){
  var CSS_ID = 'ibas-hide-zoom-chrome';
  var CSS = [
    'header, nav, [role="banner"] { display:none!important; height:0!important; overflow:hidden!important; }',
    '[class*="Header"]:not(video):not([class*="Player"]):not([class*="player"]),',
    '[class*="header"]:not(video):not([class*="Player"]):not([class*="player"]),',
    '[class*="Logo"], [class*="logo"], [class*="Brand"], [class*="brand"],',
    '[class*="meeting-title"], [class*="MeetingTitle"], [class*="meetingTitle"],',
    '[class*="recording-title"], [class*="RecordingTitle"], [class*="recordingTitle"],',
    '[class*="topic"], [class*="Topic"], [class*="zm-logo"], [class*="ZmLogo"],',
    '[data-testid*="header" i], [data-testid*="logo" i], [data-testid*="title" i],',
    'a[href="https://zoom.us"], a[href="https://www.zoom.us"], a[href*="zoom.us/"][aria-label*="Zoom" i],',
    'img[alt*="Zoom" i], img[src*="zoom" i][src*="logo" i], svg[class*="logo" i]',
    '{ display:none!important; visibility:hidden!important; opacity:0!important; height:0!important; max-height:0!important; overflow:hidden!important; pointer-events:none!important; }',
    'body { margin-top:0!important; padding-top:0!important; }'
  ].join('\\n');

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function isPlayerControl(el) {
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest('video, [class*="player" i], [class*="Player"], [class*="controls" i], [class*="Controls"], [class*="progress" i], [class*="timeline" i], [class*="vjs"]')
    );
  }

  function looksLikeZoomWordmark(el) {
    if (!el || isPlayerControl(el)) return false;
    var t = ((el.innerText || el.textContent || '') + '').replace(/\\s+/g, ' ').trim();
    if (!t) return false;
    if (/^zoom$/i.test(t)) return true;
    if (t.length <= 12 && /^zoom\\b/i.test(t) && !/play|pause|mute|share/i.test(t)) return true;
    return false;
  }

  function looksLikeTitleBar(el) {
    if (!el || isPlayerControl(el)) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return true;
    var cls = (el.className && String(el.className)) || '';
    if (/title|topic|meeting-name|recording-name/i.test(cls)) return true;
    var t = ((el.innerText || el.textContent || '') + '').replace(/\\s+/g, ' ').trim();
    if (!t || t.length < 4 || t.length > 160) return false;
    // Top-of-page title near logo (not inside video controls)
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect && rect.top >= 0 && rect.top < 120 && rect.height > 0 && rect.height < 80) {
      if (el.querySelector && el.querySelector('video, button, input')) return false;
      return true;
    }
    return false;
  }

  function hide(el) {
    if (!el || el.__ibasHidden) return;
    el.__ibasHidden = true;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('max-height', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  function sweep() {
    try {
      ensureCss();
      var nodes = document.querySelectorAll('a, span, div, p, h1, h2, h3, img, svg, header, nav');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (looksLikeZoomWordmark(el) || looksLikeTitleBar(el)) hide(el);
      }
    } catch (e) {}
  }

  ensureCss();
  sweep();
  setTimeout(sweep, 300);
  setTimeout(sweep, 800);
  setTimeout(sweep, 1600);
  setTimeout(sweep, 3000);
  setTimeout(sweep, 5000);
  try {
    var mo = new MutationObserver(function(){ sweep(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
true;
`;

/** Auto-fill Zoom cloud recording passcode form so paid users never type it. */
function zoomPasscodeUnlockJs(passcode: string): string {
  const code = JSON.stringify(passcode);
  return `
(function(){
  var code = ${code};
  if (!code) return;
  function fill() {
    try {
      var inputs = document.querySelectorAll('input[type="password"], input[name*="pass" i], input[id*="pass" i], input[placeholder*="pass" i]');
      var filled = false;
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        if (!el || el.disabled) continue;
        el.focus();
        el.value = code;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled = true;
      }
      if (!filled) return false;
      var buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
      for (var j = 0; j < buttons.length; j++) {
        var b = buttons[j];
        var t = ((b.innerText || b.value || b.getAttribute('aria-label') || '') + '').toLowerCase();
        if (/view|watch|submit|continue|access|play|unlock|enter/.test(t)) {
          b.click();
          return true;
        }
      }
      var form = inputs[0] && inputs[0].form;
      if (form) { form.submit(); return true; }
      return filled;
    } catch (e) { return false; }
  }
  fill();
  setTimeout(fill, 400);
  setTimeout(fill, 1200);
  setTimeout(fill, 2500);
})();
true;
`;
}

function html5PlayerHtml(src: string) {
  const safe = src.replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}html,body{height:100%;background:#020617;overflow:hidden}video{width:100%;height:100%;object-fit:contain;background:#020617}</style></head>
<body>
<video controls playsinline webkit-playsinline controlslist="nodownload noremoteplayback noplaybackrate" disablepictureinpicture src="${safe}"></video>
<script>
document.addEventListener('contextmenu',function(e){e.preventDefault();},true);
document.querySelector('video')?.addEventListener('contextmenu',function(e){e.preventDefault();},true);
</script>
</body></html>`;
}

function allowedPlaybackNavigation(url: string, playbackSrc: string): boolean {
  if (!url || url === 'about:blank' || url.startsWith('data:')) return true;
  try {
    const next = new URL(url);
    const base = new URL(playbackSrc);
    const host = next.hostname.replace(/^www\./, '').toLowerCase();
    if (next.origin === base.origin) return true;
    if (host.endsWith('youtube.com') || host.endsWith('youtu.be') || host.endsWith('youtube-nocookie.com')) {
      return true;
    }
    if (host.endsWith('zoom.us') || host.endsWith('zoom.com')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Embedded YouTube or Zoom recording list for previous live classes. */
export function LiveClassRecordedVideos({ items }: Props) {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const valid = useMemo(
    () =>
      items
        .map((item) => {
          const playback = recordedContentPlayback(item);
          if (!playback) return null;
          return {
            title: item.title?.trim() || '',
            source: recordedContentSource(item),
            passcode: (item.passcode ?? '').trim(),
            playback,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    [items],
  );

  if (valid.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No recorded video yet</Text>
        <Text style={styles.emptyBody}>
          When the admin adds YouTube or Zoom recording links, they will play here.
        </Text>
      </View>
    );
  }

  const current = valid[Math.min(active, valid.length - 1)]!;
  const playerW = Math.max(280, width - spacing.lg * 2);
  const playerH = Math.round((playerW * 9) / 16);
  const isZoomPage = current.source === 'zoom' && current.playback.kind === 'page';
  const injectedParts = [ANTI_SHARE_JS];
  if (isZoomPage) injectedParts.push(ZOOM_HIDE_CHROME_JS);
  if (isZoomPage && current.passcode) injectedParts.push(zoomPasscodeUnlockJs(current.passcode));
  const injected = injectedParts.join('\n');

  const onShouldStartLoadWithRequest = (req: { url: string }) =>
    allowedPlaybackNavigation(req.url, current.playback.src);

  const sharedWebViewProps = {
    style: styles.webview,
    allowsFullscreenVideo: true,
    mediaPlaybackRequiresUserAction: false,
    allowsInlineMediaPlayback: true,
    javaScriptEnabled: true,
    domStorageEnabled: true,
    setSupportMultipleWindows: false,
    androidLayerType: 'hardware' as const,
    mediaCapturePermissionGrantType: 'deny' as const,
    allowsLinkPreview: false,
    allowFileAccess: false,
    allowFileAccessFromFileURLs: false,
    injectedJavaScriptBeforeContentLoaded: isZoomPage ? ZOOM_HIDE_CHROME_JS : undefined,
    injectedJavaScript: injected,
    onShouldStartLoadWithRequest,
    userAgent:
      Platform.OS === 'android'
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        : undefined,
  };

  return (
    <View style={styles.root}>
      {valid.length > 1 ? (
        <View style={styles.tabs}>
          {valid.map((item, index) => (
            <Pressable
              key={`${item.playback.src}-${index}`}
              style={[styles.tab, index === active && styles.tabActive]}
              onPress={() => setActive(index)}
            >
              <Text style={[styles.tabText, index === active && styles.tabTextActive]} numberOfLines={1}>
                {item.title || `Part ${index + 1}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.player, { width: playerW, height: playerH }]}>
        {current.playback.kind === 'html5' ? (
          <WebView
            key={current.playback.src}
            source={{ html: html5PlayerHtml(current.playback.src) }}
            scrollEnabled={false}
            nestedScrollEnabled
            {...sharedWebViewProps}
          />
        ) : (
          <WebView
            key={current.playback.src}
            source={{ uri: current.playback.src }}
            scrollEnabled={current.playback.kind === 'page'}
            nestedScrollEnabled
            {...sharedWebViewProps}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm, paddingBottom: spacing.md },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: '#fce7f3', borderColor: '#f9a8d4' },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, maxWidth: 140 },
  tabTextActive: { color: '#9d174d' },
  player: {
    alignSelf: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  webview: { flex: 1, backgroundColor: '#020617' },
  empty: { padding: spacing.lg, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
