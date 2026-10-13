/**
 * Voice Input & Speech-to-Text Service for FixMate
 * Provides a resilient multi-tier speech input system:
 * 1. Native Web Speech API (webkitSpeechRecognition) for zero-latency real-time streaming
 * 2. MediaStream & MediaRecorder + Server-side Multimodal Gemini API (/api/transcribe) as universal fallback
 * Supports Urdu (اردو), Roman Urdu, and English.
 */

export interface VoiceSessionController {
  stop: () => void
  isRecording: () => boolean
}

export type VoiceState = 'idle' | 'listening' | 'recording' | 'transcribing'

export interface VoiceOptions {
  language?: 'ur' | 'en' | 'both'
  onStateChange?: (state: VoiceState) => void
  onInterim?: (text: string) => void
  onFinal: (text: string) => void
  onError: (errorMsg: string) => void
}

/**
 * Checks if any audio input capability is present in the browser.
 */
export function isVoiceSupported(): boolean {
  if (typeof window === 'undefined') return false
  const hasWebSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  const hasGetUserMedia = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
  return hasWebSpeech || hasGetUserMedia
}

/**
 * Converts a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = reader.result as string
      resolve(res)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Starts voice recognition with automatic fallback to MediaRecorder + Gemini
 */
/**
 * Starts voice recognition with direct user gesture audio capture and Gemini AI transcription
 */
export function startVoiceSession(options: VoiceOptions): VoiceSessionController {
  const { language = 'both', onStateChange, onInterim, onFinal, onError } = options

  let active = true
  let currentSpeechRecognition: any = null
  let currentMediaRecorder: MediaRecorder | null = null
  let currentStream: MediaStream | null = null
  let speechFinalResult: string = ''

  function updateState(s: VoiceState) {
    if (active && onStateChange) {
      onStateChange(s)
    }
  }

  function cleanupMedia() {
    if (currentStream) {
      try {
        currentStream.getTracks().forEach((track) => track.stop())
      } catch {}
      currentStream = null
    }
    currentMediaRecorder = null
  }

  function cleanup() {
    active = false
    if (currentSpeechRecognition) {
      try {
        currentSpeechRecognition.stop()
      } catch {}
      currentSpeechRecognition = null
    }
    cleanupMedia()
    updateState('idle')
  }

  // Helper to obtain media stream with progressive constraint fallback and detailed environment inspection
  async function acquireAudioStream(): Promise<MediaStream> {
    const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false
    const inIframe = typeof window !== 'undefined' && window.self !== window.top

    if (!isSecure) {
      console.warn('[Voice] Secure Context Check Failed:', { isSecureContext: isSecure, inIframe })
      throw new Error('INSECURE_CONTEXT')
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.warn('[Voice] mediaDevices or getUserMedia not supported in browser environment:', { inIframe })
      throw new Error('NOT_SUPPORTED')
    }

    // Query microphone permission if browser supports Permissions API query for microphone
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const permStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        console.info('[Voice] Permission status query:', permStatus.state, { inIframe })
        if (permStatus.state === 'denied') {
          if (inIframe) {
            throw new Error('IFRAME_BLOCKED')
          } else {
            throw new Error('PERMISSION_DENIED')
          }
        }
      } catch (pErr: any) {
        // Permissions query may not support 'microphone' name in all browsers (e.g. Firefox); ignore & proceed
      }
    }

    // Attempt plain standard { audio: true } first
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (primaryErr: any) {
      console.warn('[Voice] Standard audio constraints getUserMedia failed:', {
        name: primaryErr?.name,
        message: primaryErr?.message,
        isSecureContext: isSecure,
        inIframe,
      })

      // Secondary fallback attempt with explicit audio processing options
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
      } catch (secondaryErr: any) {
        throw primaryErr || secondaryErr
      }
    }
  }

  // Initialize recording immediately under active user click gesture
  ;(async () => {
    updateState('listening')

    const inIframe = typeof window !== 'undefined' && window.self !== window.top

    try {
      const stream = await acquireAudioStream()

      if (!active) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      currentStream = stream
      updateState('recording')

      let mimeType = 'audio/webm'
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType })
      currentMediaRecorder = recorder
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        cleanupMedia()

        const totalBytes = chunks.reduce((acc, c) => acc + c.size, 0)
        console.info('[Voice] Recording stopped. Chunks count:', chunks.length, 'Total audio bytes:', totalBytes)

        // Verify audio was actually captured before invoking Gemini transcription
        if (totalBytes < 200) {
          console.warn('[Voice] Recording captured zero or insufficient audio bytes:', totalBytes)
          if (speechFinalResult && speechFinalResult.trim()) {
            onFinal(speechFinalResult.trim())
          } else {
            onError('No clear speech recorded. Please check your microphone and try speaking again.')
          }
          updateState('idle')
          return
        }

        updateState('transcribing')
        try {
          const audioBlob = new Blob(chunks, { type: mimeType })
          const base64Data = await blobToBase64(audioBlob)

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType,
              language,
            }),
          })

          if (res.ok) {
            const data = await res.json()
            if (data.success && data.transcript && data.transcript.trim()) {
              onFinal(data.transcript.trim())
              return
            }
          }

          // Fallback to WebSpeech API result if Gemini was quiet or returned empty
          if (speechFinalResult && speechFinalResult.trim()) {
            onFinal(speechFinalResult.trim())
          } else {
            onError('No speech detected in recorded audio. Please speak clearly into your microphone.')
          }
        } catch (transcribeErr: any) {
          console.warn('[Voice] Gemini transcription request error:', {
            name: transcribeErr?.name,
            message: transcribeErr?.message,
          })
          if (speechFinalResult && speechFinalResult.trim()) {
            onFinal(speechFinalResult.trim())
          } else {
            onError('Speech transcription service unavailable. Please try typing your request.')
          }
        } finally {
          updateState('idle')
        }
      }

      recorder.start(250)

      // Auto-stop after 25 seconds max duration
      setTimeout(() => {
        if (active && recorder.state === 'recording') {
          recorder.stop()
        }
      }, 25000)

      // Concurrent WebSpeech API setup for real-time interim speech preview
      const SpeechRecognitionClass =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass()
          currentSpeechRecognition = recognition
          recognition.continuous = false
          recognition.interimResults = true
          recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US'

          recognition.onresult = (event: any) => {
            let interimText = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const item = event.results[i]
              const transcript = item[0]?.transcript || ''
              if (item.isFinal) {
                speechFinalResult = transcript
              } else {
                interimText += transcript
              }
            }
            if (interimText && onInterim) {
              onInterim(interimText)
            }
          }

          recognition.onerror = (evt: any) => {
            console.info('[Voice] WebSpeech API status:', evt?.error, { inIframe })
          }

          recognition.start()
        } catch (recErr: any) {
          console.info('[Voice] WebSpeech recognition init skipped:', recErr?.message)
        }
      }
    } catch (err: any) {
      console.warn('[Voice] Microphone initialization failed:', {
        errorName: err?.name,
        errorMessage: err?.message,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
        inIframe,
      })

      cleanup()

      const errName = err?.name || ''
      const errMessage = err?.message || ''

      const isPermissionsPolicyError =
        inIframe &&
        (errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errName === 'SecurityError' ||
          errMessage === 'IFRAME_BLOCKED' ||
          errMessage.toLowerCase().includes('permissions policy') ||
          errMessage.toLowerCase().includes('disallowed') ||
          errMessage.toLowerCase().includes('permission denied'))

      if (isPermissionsPolicyError) {
        onError(
          'Microphone access is blocked by the embedded preview frame\'s security policy. Please open the website in a separate tab or standalone window (using the top-right button) to test voice input.'
        )
      } else if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMessage === 'PERMISSION_DENIED') {
        onError(
          'Microphone permission denied. Please click the lock or microphone icon in your browser address bar to allow permissions and refresh.'
        )
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        onError('No microphone hardware found. Please connect an audio input device and try again.')
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        onError('Microphone is in use by another application. Please close other audio apps and try again.')
      } else if (errMessage === 'INSECURE_CONTEXT') {
        onError('Voice input requires a secure HTTPS connection.')
      } else if (errMessage === 'NOT_SUPPORTED') {
        onError('Audio recording is not supported in this browser. Please type your query.')
      } else {
        onError('Could not access microphone. Please check browser permissions or open the app in a standalone tab.')
      }
    }
  })()

  return {
    stop: () => {
      if (currentSpeechRecognition) {
        try {
          currentSpeechRecognition.stop()
        } catch {}
      }
      if (currentMediaRecorder && currentMediaRecorder.state === 'recording') {
        try {
          currentMediaRecorder.stop()
        } catch {}
      } else {
        cleanup()
      }
    },
    isRecording: () => active,
  }
}

