import { useState, useRef, useEffect } from 'react'
import { Mic, StopCircle, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { startVoiceSession, type VoiceSessionController, type VoiceState } from '../lib/voiceService'

export interface VoiceInputButtonProps {
  onTranscript: (transcript: string) => void
  language?: 'ur' | 'en' | 'both'
  variant?: 'icon' | 'button'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
  disabled?: boolean
  autoAppend?: boolean
}

export default function VoiceInputButton({
  onTranscript,
  language = 'both',
  variant = 'icon',
  size = 'md',
  label = 'Voice Input',
  className = '',
  disabled = false,
}: VoiceInputButtonProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const sessionRef = useRef<VoiceSessionController | null>(null)

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
    }
  }, [])

  function toggleVoice() {
    setErrorMsg('')

    if (voiceState !== 'idle') {
      sessionRef.current?.stop()
      setInterimText('')
      return
    }

    setInterimText('')
    const session = startVoiceSession({
      language,
      onStateChange: (state) => setVoiceState(state),
      onInterim: (text) => setInterimText(text),
      onFinal: (finalTranscript) => {
        setInterimText('')
        setVoiceState('idle')
        if (finalTranscript && finalTranscript.trim()) {
          onTranscript(finalTranscript.trim())
        }
      },
      onError: (err) => {
        setInterimText('')
        setVoiceState('idle')
        setErrorMsg(err)
        setTimeout(() => setErrorMsg(''), 10000)
      },
    })

    sessionRef.current = session
  }

  const isRecording = voiceState === 'listening' || voiceState === 'recording'
  const isTranscribing = voiceState === 'transcribing'

  // Sizing styles
  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const buttonPadding = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-2 text-xs sm:text-sm',
    lg: 'px-4 py-2.5 text-sm font-bold',
  }

  if (variant === 'button') {
    return (
      <div className="relative inline-flex flex-col items-center">
        <button
          type="button"
          onClick={toggleVoice}
          disabled={disabled || isTranscribing}
          className={`flex items-center gap-2 rounded-xl font-bold transition-all shadow-soft disabled:opacity-50 ${
            isRecording
              ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse'
              : isTranscribing
              ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300'
              : 'bg-slate-100 text-ink/80 hover:bg-slate-200 hover:text-ink'
          } ${buttonPadding[size]} ${className}`}
          title="Speech to text (English & Urdu / اردو میں بولیں)"
        >
          {isTranscribing ? (
            <Loader2 className={`${iconSizes[size]} animate-spin text-purple-600`} />
          ) : isRecording ? (
            <StopCircle className={`${iconSizes[size]} text-white`} />
          ) : (
            <Mic className={`${iconSizes[size]} text-primary`} />
          )}
          <span>
            {isTranscribing
              ? 'Transcribing (Gemini AI)...'
              : isRecording
              ? 'Listening... (Click to Stop)'
              : label}
          </span>
        </button>

        {/* Real-time interim preview or error indicator */}
        {interimText && (
          <div className="absolute top-full mt-1.5 z-30 flex items-center gap-1.5 rounded-xl bg-purple-900 px-3 py-1.5 text-xs text-white shadow-lift animate-in fade-in whitespace-nowrap">
            <Sparkles className="h-3 w-3 text-purple-300 animate-pulse shrink-0" />
            <span className="italic max-w-xs truncate">{interimText}...</span>
          </div>
        )}

        {errorMsg && (
          <div className="absolute top-full mt-1.5 z-30 flex items-start gap-1.5 rounded-xl bg-rose-100 px-3 py-2 text-xs font-medium text-rose-900 border border-rose-200 shadow-lift animate-in fade-in max-w-xs sm:max-w-sm text-left">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    )
  }

  // Icon Variant
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleVoice}
        disabled={disabled || isTranscribing}
        className={`flex items-center justify-center rounded-xl transition-all disabled:opacity-50 ${
          isRecording
            ? 'bg-rose-500 text-white ring-2 ring-rose-400 animate-pulse p-2'
            : isTranscribing
            ? 'bg-purple-100 text-purple-700 p-2'
            : 'bg-slate-100 text-ink/60 hover:bg-purple-100 hover:text-primary p-2'
        } ${className}`}
        title="Speech to text input (English or Urdu)"
      >
        {isTranscribing ? (
          <Loader2 className={`${iconSizes[size]} animate-spin text-purple-600`} />
        ) : isRecording ? (
          <StopCircle className={`${iconSizes[size]} text-white`} />
        ) : (
          <Mic className={`${iconSizes[size]} text-primary`} />
        )}
      </button>

      {/* Floating tooltip for interim speech text or errors */}
      {(interimText || errorMsg) && (
        <div
          className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-40 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs shadow-lift animate-in fade-in ${
            errorMsg
              ? 'bg-rose-900 text-white max-w-xs sm:max-w-sm text-left leading-tight break-words'
              : 'bg-purple-900/90 backdrop-blur-md text-white whitespace-nowrap'
          }`}
        >
          {errorMsg ? (
            <>
              <AlertCircle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-purple-300 animate-pulse shrink-0" />
              <span className="italic max-w-xs truncate">{interimText}...</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
