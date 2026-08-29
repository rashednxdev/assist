import { PermissionsAndroid, Platform } from 'react-native';
import type { ZoomLiveStreamJoinPayload } from '@ibas/shared-types';
import type { MeUser } from './auth-api';

export function zoomGuestDisplayName(
  join: ZoomLiveStreamJoinPayload,
  user: MeUser | null,
): string {
  return (
    join.user_name?.trim() ||
    user?.full_name_bn?.trim() ||
    user?.full_name_en?.trim() ||
    'Guest'
  );
}

/** Ensure Zoom join URL includes display name (and email when available). */
export function withZoomGuestIdentity(
  webClientUrl: string,
  name: string,
  email?: string,
): string {
  try {
    const url = new URL(webClientUrl);
    url.searchParams.set('uname', name);
    if (email?.trim()) url.searchParams.set('email', email.trim());
    return url.toString();
  } catch {
    const sep = webClientUrl.includes('?') ? '&' : '?';
    let out = `${webClientUrl}${sep}uname=${encodeURIComponent(name)}`;
    if (email?.trim()) out += `&email=${encodeURIComponent(email.trim())}`;
    return out;
  }
}

/** Android runtime permission — required before WebView can use mic/camera. */
export async function ensureAvPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (granted && micGranted) return true;

    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

/**
 * Inline page that pre-requests getUserMedia, then redirects to Zoom Web Client.
 * Combined with WebView mediaCapturePermissionGrantType="grant", guests skip browser prompts.
 */
export function buildZoomGuestWebViewHtml(zoomUrl: string): string {
  const safeUrl = JSON.stringify(zoomUrl);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<style>
  html,body{margin:0;height:100%;background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif}
  #msg{display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;font-size:15px;line-height:1.45}
</style>
</head>
<body>
<div id="msg">Starting camera and microphone…</div>
<script>
(function(){
  var target = ${safeUrl};
  function go(){ location.replace(target); }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    go();
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    .then(function(stream){ stream.getTracks().forEach(function(t){ t.stop(); }); go(); })
    .catch(function(){ go(); });
})();
</script>
</body>
</html>`;
}
