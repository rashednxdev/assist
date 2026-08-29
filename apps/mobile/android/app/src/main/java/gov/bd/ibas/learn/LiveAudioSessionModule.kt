package gov.bd.ibas.learn

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Zoom Web Client in WebView uses WebRTC VoIP — needs MODE_IN_COMMUNICATION + speaker
 * so guests can hear the host. Also raises voice-call and media volumes.
 */
class LiveAudioSessionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LiveAudioSession"

  private var focusRequest: AudioFocusRequest? = null
  private var previousMode: Int = AudioManager.MODE_NORMAL
  private var previousSpeakerphone: Boolean = false
  private var started = false

  @ReactMethod
  fun start() {
    UiThreadUtil.runOnUiThread {
      try {
        val audioManager = audioManager() ?: return@runOnUiThread
        if (!started) {
          previousMode = audioManager.mode
          @Suppress("DEPRECATION")
          previousSpeakerphone = audioManager.isSpeakerphoneOn
        }
        // VoIP receive path for Zoom WebRTC in WebView
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        routeToSpeaker(audioManager)
        raiseVolumes(audioManager)
        requestVoiceFocus(audioManager)
        started = true
      } catch (e: Exception) {
        Log.w(TAG, "start failed", e)
        started = false
      }
    }
  }

  @ReactMethod
  fun stop() {
    UiThreadUtil.runOnUiThread {
      try {
        if (!started) return@runOnUiThread
        val audioManager = audioManager() ?: return@runOnUiThread
        abandonFocus(audioManager)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          try {
            audioManager.clearCommunicationDevice()
          } catch (_: Exception) {
          }
        }
        @Suppress("DEPRECATION")
        audioManager.isSpeakerphoneOn = previousSpeakerphone
        audioManager.mode = previousMode
      } catch (e: Exception) {
        Log.w(TAG, "stop failed", e)
      } finally {
        started = false
      }
    }
  }

  private fun audioManager(): AudioManager? =
      reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  private fun routeToSpeaker(audioManager: AudioManager) {
    @Suppress("DEPRECATION")
    audioManager.isSpeakerphoneOn = true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        val speaker =
            audioManager.availableCommunicationDevices.firstOrNull {
              it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            }
        if (speaker != null) {
          audioManager.setCommunicationDevice(speaker)
        }
      } catch (e: Exception) {
        Log.w(TAG, "setCommunicationDevice failed", e)
      }
    }
  }

  private fun raiseVolumes(audioManager: AudioManager) {
    raiseStream(audioManager, AudioManager.STREAM_VOICE_CALL, 0.92)
    raiseStream(audioManager, AudioManager.STREAM_MUSIC, 0.88)
  }

  private fun raiseStream(audioManager: AudioManager, stream: Int, ratio: Double) {
    try {
      val max = audioManager.getStreamMaxVolume(stream)
      if (max <= 0) return
      val current = audioManager.getStreamVolume(stream)
      val target = (max * ratio).toInt().coerceIn(1, max)
      if (current < target) {
        audioManager.setStreamVolume(stream, target, 0)
      }
    } catch (e: Exception) {
      Log.w(TAG, "raiseStream failed stream=$stream", e)
    }
  }

  private fun requestVoiceFocus(audioManager: AudioManager) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attrs =
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        focusRequest =
            AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(true)
                .build()
        audioManager.requestAudioFocus(focusRequest!!)
      } else {
        @Suppress("DEPRECATION")
        audioManager.requestAudioFocus(
            null,
            AudioManager.STREAM_VOICE_CALL,
            AudioManager.AUDIOFOCUS_GAIN,
        )
      }
    } catch (e: Exception) {
      Log.w(TAG, "requestVoiceFocus failed", e)
    }
  }

  private fun abandonFocus(audioManager: AudioManager) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
      } else {
        @Suppress("DEPRECATION")
        audioManager.abandonAudioFocus(null)
      }
    } catch (e: Exception) {
      Log.w(TAG, "abandonFocus failed", e)
    } finally {
      focusRequest = null
    }
  }

  companion object {
    private const val TAG = "LiveAudioSession"
  }
}
