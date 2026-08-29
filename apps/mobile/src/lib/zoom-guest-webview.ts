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

function zoomBase64Utf8(value: string): string {
  const trimmed = value.trim();
  const bytes = new TextEncoder().encode(trimmed);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Guest join URL: prefer=1 auto-connects receive-audio (listen to host).
 */
export function withZoomGuestIdentity(
  webClientUrl: string,
  name: string,
  email?: string,
): string {
  try {
    const url = new URL(webClientUrl);
    url.searchParams.set('prefer', '1');
    url.searchParams.set('un', zoomBase64Utf8(name));
    url.searchParams.delete('uname');
    if (email?.trim()) url.searchParams.set('email', email.trim());
    return url.toString();
  } catch {
    const sep = webClientUrl.includes('?') ? '&' : '?';
    let out = `${webClientUrl}${sep}prefer=1&un=${encodeURIComponent(zoomBase64Utf8(name))}`;
    if (email?.trim()) out += `&email=${encodeURIComponent(email.trim())}`;
    return out;
  }
}

/**
 * Must complete before opening Zoom WebView — without RECORD_AUDIO,
 * Zoom cannot join computer audio and guests hear nothing.
 */
export async function ensureGuestListenPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const micOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (micOk) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Hear the host',
      message:
        'Allow microphone so Zoom can connect audio. Camera and speaking stay off until the host allows.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Request camera (and confirm mic) only after the host allows guest speech. */
export async function ensureGuestSpeakPermissions(): Promise<boolean> {
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

/** Android WebView: grant mic always; grant camera only when host allowed speech. */
export function filterZoomMediaResources(
  resources: string[],
  allowSpeech: boolean,
): string[] {
  if (allowSpeech) return resources;
  return resources.filter((r) => {
    const lower = String(r).toLowerCase();
    if (lower.includes('video') || lower.includes('camera')) return false;
    return lower.includes('audio') || lower.includes('microphone') || lower.includes('record');
  });
}

/**
 * Guest lock: join listen-only (mic muted, video off).
 * When allowSpeech, unlock Start Video / unmute controls.
 */
export function buildZoomGuestUiLockScript(allowSpeech: boolean): string {
  return `(function(){
    var allow=${allowSpeech ? 'true' : 'false'};
    var styleId='proassist-guest-lock';
    var hostStyleId='proassist-host-only';

    function ensureStyle(id, cssText){
      var s=document.getElementById(id);
      if(!s){
        s=document.createElement('style');
        s.id=id;
        (document.head||document.documentElement).appendChild(s);
      }
      s.textContent=cssText;
    }

    ensureStyle(hostStyleId, [
      '[class*="self-view" i],[class*="SelfView" i],',
      '[class*="my-self" i],[data-testid*="self-view" i]{',
      'opacity:0!important;pointer-events:none!important;max-width:0!important;max-height:0!important;overflow:hidden!important;}'
    ].join(''));

    if(allow){
      var old=document.getElementById(styleId);
      if(old) old.remove();
      if(window.__proassistVideoStopTimer){
        clearInterval(window.__proassistVideoStopTimer);
        window.__proassistVideoStopTimer=null;
      }
    } else {
      ensureStyle(styleId, [
        'button[aria-label*="Share Screen" i],button[aria-label*="share screen" i],',
        'button[aria-label*="Start Video" i],button[aria-label*="start video" i],',
        'button[aria-label*="Start my video" i],button[aria-label*="Turn on my video" i],',
        'button[aria-label*="Unmute" i],button[aria-label*="unmute" i],',
        '[data-tooltip*="Share Screen" i],[data-tooltip*="share screen" i],',
        '[data-tooltip*="Start Video" i],[data-tooltip*="Unmute" i]{',
        'display:none!important;visibility:hidden!important;pointer-events:none!important;}'
      ].join(''));
    }

    function labelOf(el){
      return ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).toLowerCase().replace(/\\s+/g,' ').trim();
    }

    function clickMatching(pred){
      try{
        var nodes=document.querySelectorAll('button,a,[role="button"],div[role="button"]');
        for(var i=0;i<nodes.length;i++){
          var t=labelOf(nodes[i]);
          if(!t) continue;
          if(pred(t)){
            nodes[i].click();
            return true;
          }
        }
      }catch(e){}
      return false;
    }

    function clickJoinAudio(){
      return clickMatching(function(t){
        return t.indexOf('join audio')!==-1 || t.indexOf('computer audio')!==-1 ||
          t.indexOf('join with computer')!==-1 || t.indexOf('connect audio')!==-1 ||
          t.indexOf('with computer audio')!==-1;
      });
    }

    function forceStopVideo(){
      return clickMatching(function(t){
        if(t.indexOf('start video')!==-1 || t.indexOf('turn on')!==-1) return false;
        return t.indexOf('stop video')!==-1 || t.indexOf('stop my video')!==-1 ||
          t.indexOf('turn off my video')!==-1 || t.indexOf('turn off video')!==-1 ||
          t==='video' && t.indexOf('stop')!==-1;
      });
    }

    function forceMuteMic(){
      return clickMatching(function(t){
        if(t.indexOf('unmute')!==-1) return false;
        return t.indexOf('mute')!==-1 && (t.indexOf('audio')!==-1 || t.indexOf('microphone')!==-1 || t==='mute' || t.indexOf('mute my')!==-1);
      });
    }

    if(!window.__proassistAudioJoinTimer){
      var tries=0;
      window.__proassistAudioJoinTimer=setInterval(function(){
        tries++;
        clickJoinAudio();
        if(tries>=12){
          clearInterval(window.__proassistAudioJoinTimer);
          window.__proassistAudioJoinTimer=null;
        }
      }, 1000);
    }
    clickJoinAudio();

    if(!allow){
      forceStopVideo();
      forceMuteMic();
      if(!window.__proassistVideoStopTimer){
        var vTries=0;
        window.__proassistVideoStopTimer=setInterval(function(){
          vTries++;
          forceStopVideo();
          forceMuteMic();
          if(vTries>=20){
            clearInterval(window.__proassistVideoStopTimer);
            window.__proassistVideoStopTimer=null;
          }
        }, 800);
      }
    }
  })();true;`;
}
