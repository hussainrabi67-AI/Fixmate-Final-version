import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  Mic, Camera, Sparkles, User, ShieldAlert, Wrench, ArrowRight,
  Search, AlertCircle, CheckCircle2, X, Loader2, Send, RotateCcw,
  Bot, HelpCircle, ChevronRight, MessageSquare, Activity, Settings,
  Check, RefreshCw, ExternalLink, Languages, StopCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  uploadProblemImage, createServiceRequest, diagnoseProblem, markRequestSolved,
  fileToBase64, getCategorySlugAndTitle,
} from '../lib/aiService'
import { sendServiceRequestToN8n, isN8nChatConfigured } from '../lib/n8nService'
import { startVoiceSession, type VoiceSessionController, type VoiceState } from '../lib/voiceService'
import type { AIDiagnosis, ChatMessage } from '../types/ai'
import ServiceImageLogo from '../components/ServiceImageLogo'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const suggestedPrompts = [
  { icon: '🧺', text: 'Washing machine won\'t drain water or spin', urdu: 'واشنگ مشین پانی نہیں نکال رہی یا اسپن نہیں ہو رہی' },
  { icon: '🚰', text: 'Water leaking under the kitchen sink', urdu: 'کچن کے سنک کے نیچے سے پانی لیک ہو رہا ہے' },
  { icon: '⚡', text: 'Circuit breaker tripped and won\'t stay on', urdu: 'سرکٹ بریکر بار بار ٹرپ ہو رہا ہے' },
  { icon: '❄️', text: 'AC is running but not blowing cold air', urdu: 'اے سی چل رہا ہے لیکن ٹھنڈی ہوا نہیں دے رہا' },
  { icon: '🚗', text: 'Car engine making rattling noise on idle', urdu: 'گاڑی کے انجن سے کھٹ کھٹ کی آواز آ رہی ہے' },
  { icon: '🔨', text: 'Door is sticking and hard to close', urdu: 'لکڑی کا دروازہ پھنس رہا ہے اور بند نہیں ہو رہا' },
]

export default function AIAssistantPage() {
  const { session, loading, profile } = useAuth()

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<'both' | 'ur' | 'en'>('both')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)

  // Explicit service request sending state (so chat messages aren't saved as requests automatically)
  const [sendingMsgId, setSendingMsgId] = useState<string | null>(null)
  const [sentRequestMap, setSentRequestMap] = useState<Record<string, string>>({})

  async function handleExplicitSendRequest(
    msgId: string,
    description: string,
    imageUrl?: string,
    categoryName?: string
  ) {
    if (!session?.user?.id) return
    setSendingMsgId(msgId)
    try {
      const catRouting = getCategorySlugAndTitle(categoryName || description)
      const requestId = await createServiceRequest({
        userId: session.user.id,
        description,
        imageUrl: imageUrl || null,
      })

      if (requestId) {
        setSentRequestMap((prev) => ({ ...prev, [msgId]: requestId }))
        setCurrentRequestId(requestId)

        // Send to n8n webhook non-blockingly
        sendServiceRequestToN8n({
          request_id: requestId,
          user_id: session.user.id,
          category_id: null,
          category_name: categoryName || catRouting?.title || null,
          title: description.slice(0, 80),
          description,
          location: null,
          urgency: 'medium',
          professional_required: true,
        })
      }
    } catch (err) {
      console.error('Failed to create explicit service request:', err)
    } finally {
      setSendingMsgId(null)
    }
  }

  // Voice recognition & recording states
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimVoiceText, setInterimVoiceText] = useState('')
  const voiceSessionRef = useRef<VoiceSessionController | null>(null)
  const [isN8nConnected, setIsN8nConnected] = useState(false)

  // Initialize n8n chat status on mount
  useEffect(() => {
    setIsN8nConnected(isN8nChatConfigured())
  }, [])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  // Stop active voice session on unmount
  useEffect(() => {
    return () => {
      voiceSessionRef.current?.stop()
    }
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const initialPromptProcessed = useRef(false)

  // Initial welcome message or incoming prompt from URL
  useEffect(() => {
    const promptParam = searchParams.get('prompt')

    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'ai',
          text: `Hi ${profile?.name || 'there'}! I'm FixMate AI, your 24/7 intelligent repair assistant. You can speak or write in English or Urdu (اردو میں بات کریں), or upload a photo of your damaged equipment for instant visual diagnosis and step-by-step guidance.`,
        },
      ])
    }

    if (promptParam && !initialPromptProcessed.current) {
      initialPromptProcessed.current = true
      // Clear URL param after reading
      setSearchParams({}, { replace: true })
      handleSendMessage(promptParam)
    }
  }, [profile, searchParams])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleVoice() {
    setError('')

    // If currently recording or listening, clicking again stops and processes
    if (voiceState !== 'idle') {
      voiceSessionRef.current?.stop()
      setInterimVoiceText('')
      return
    }

    setInterimVoiceText('')
    const sessionController = startVoiceSession({
      language: selectedLanguage,
      onStateChange: (state) => {
        setVoiceState(state)
      },
      onInterim: (text) => {
        setInterimVoiceText(text)
      },
      onFinal: (finalTranscript) => {
        setInterimVoiceText('')
        setVoiceState('idle')
        if (finalTranscript && finalTranscript.trim()) {
          const cleanText = finalTranscript.trim()
          setInput(cleanText)
          handleSendMessage(cleanText)
        }
      },
      onError: (errMessage) => {
        setInterimVoiceText('')
        setError(errMessage)
        setVoiceState('idle')
      },
    })

    voiceSessionRef.current = sessionController
  }



  async function handleSendMessage(promptText?: string) {
    const textToSend = promptText || input.trim()
    if (!textToSend && !imageFile) {
      setError('Please type a message or upload a photo.')
      return
    }

    setError('')

    // 1. Repetitive message check (don't entertain identical prompt more than 2 times, i.e. max 3 attempts)
    const norm = textToSend.toLowerCase().trim()
    const previousUserMessages = messages.filter((m) => m.role === 'user')
    let consecutiveRepeats = 0
    for (let i = previousUserMessages.length - 1; i >= 0; i--) {
      if (previousUserMessages[i].text.toLowerCase().trim() === norm) {
        consecutiveRepeats++
      } else {
        break
      }
    }

    const currentRepeatCount = consecutiveRepeats + 1

    if (currentRepeatCount >= 3) {
      const displayImg = imagePreview
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: textToSend,
        imageUrl: displayImg || undefined,
      }

      const isUrdu = selectedLanguage === 'ur' || /[\u0600-\u06FF]/.test(textToSend)
      const apologyText = isUrdu
        ? `معذرت! میں نے دیکھا ہے کہ آپ نے ایک ہی پیغام بار بار بھیجا ہے۔ میں ایک ہی سوال کو بار بار نہیں دہرا سکتا۔ برائے مہربانی اپنے مسئلے کی مزید تفصیل بیان کریں یا نیچے دیے گئے بٹن سے ہمارے تصدیق شدہ ٹیکنیشنز سے رابطہ کریں۔`
        : `I'm sorry! I've noticed you sent the exact same message multiple times. I cannot process identical repeated queries. Please rephrase your query with different details or connect directly with our verified FixMate specialists below.`

      const catRouting = getCategorySlugAndTitle(textToSend)

      const aiApologyMsg: ChatMessage = {
        id: uid(),
        role: 'ai',
        text: apologyText,
        diagnosis: catRouting ? {
          problem_summary: `Repeated query regarding ${catRouting.title}`,
          possible_causes: [],
          safe_steps: [],
          safety_warning: 'Avoid sending repetitive queries.',
          urgency: 'medium',
          professional_required: true,
          recommended_category: catRouting.title,
          conversational_reply: apologyText,
        } : undefined,
      }

      setMessages((m) => [...m, userMsg, aiApologyMsg])
      setInput('')
      clearImage()
      return
    }

    setBusy(true)

    const userId = session!.user.id

    try {
      // Upload image if provided & compute base64 for Gemini vision detection
      let imageUrl: string | null = null
      let imageBase64: string | null = null
      const displayImg = imagePreview
      if (imageFile) {
        try {
          imageBase64 = await fileToBase64(imageFile)
          imageUrl = await uploadProblemImage(imageFile, userId)
        } catch (imgErr) {
          console.warn('Image processing warning:', imgErr)
        }
      }

      const userText = textToSend || (selectedLanguage === 'ur' ? '📷 معائنہ کے لیے تصویر شیئر کی گئی' : '📷 Photo uploaded for inspection')

      // Add user message to conversation
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: userText,
        imageUrl: displayImg || imageUrl || undefined,
      }
      setMessages((m) => [...m, userMsg])
      setInput('')
      clearImage()

      // Get AI Diagnosis / Vision response (queries server Gemini vision endpoint)
      const diagnosis = await diagnoseProblem({
        description: textToSend || 'Please inspect the attached photo for defects or faults.',
        imageUrl: imageUrl ?? undefined,
        imageBase64: imageBase64 ?? undefined,
        userId,
        language: selectedLanguage === 'ur' ? 'Urdu' : selectedLanguage === 'en' ? 'English' : 'Urdu & English',
      })

      const aiMsg: ChatMessage = {
        id: uid(),
        role: 'ai',
        text: diagnosis.conversational_reply || diagnosis.problem_summary,
        diagnosis,
        source: diagnosis.source,
      }
      setMessages((m) => [...m, aiMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    handleSendMessage()
  }

  function handleResetChat() {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'ai',
        text: `Conversation restarted. How else can I assist you with your repairs today?`,
      },
    ])
    setSolved(false)
    setCurrentRequestId(null)
    setInput('')
    clearImage()
  }

  async function handleSolved() {
    if (currentRequestId) {
      await markRequestSolved(currentRequestId)
    }
    setSolved(true)
  }

  return (
    <div className="section py-8 sm:py-12 animate-fade-in">
      <div className="mx-auto max-w-3xl">
        {/* Chat Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary-dark text-white shadow-soft">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-ink">FixMate AI Assistant</h1>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                </span>
              </div>
              <p className="text-xs text-ink/60">Live interactive repair diagnosis & safety assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetChat}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-slate-100 hover:text-ink transition-colors shadow-soft"
              title="Reset Chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>
            <Link
              to="/technicians"
              className="flex items-center gap-1.5 rounded-xl bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Find Technicians</span>
            </Link>
          </div>
        </div>

        {/* Language Selector Bar & Quick Topic Chips */}
        {messages.length <= 1 && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Popular Topics / عام مسائل
              </p>

              {/* Language Selector */}
              <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('both')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedLanguage === 'both'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  🌐 English & اردو
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('ur')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedLanguage === 'ur'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  🇵🇰 اردو
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedLanguage === 'en'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {suggestedPrompts.map((p, idx) => {
                const textToSubmit = selectedLanguage === 'ur' ? p.urdu : p.text

                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(textToSubmit)}
                    disabled={busy}
                    className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-soft transition-all hover:border-primary/40 hover:bg-purple-50/50 hover:translate-x-0.5 group"
                  >
                    <span className="text-xl mt-0.5">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink group-hover:text-primary transition-colors">
                        {p.text}
                      </p>
                      <p className="text-[11px] text-primary/80 font-medium mt-0.5" dir="rtl">
                        {p.urdu}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink/30 group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Chat Messages Log */}
        <div className="mt-6 space-y-4 min-h-[350px] max-h-[600px] overflow-y-auto rounded-3xl bg-slate-50/70 p-4 sm:p-6 ring-1 ring-slate-200/60">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="flex max-w-[85%] items-start gap-3 rounded-3xl rounded-tr-md bg-primary px-5 py-3.5 text-white shadow-soft">
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base leading-relaxed">{msg.text}</p>
                    {msg.imageUrl && (
                      <div className="mt-2.5 overflow-hidden rounded-2xl border border-white/20">
                        <img
                          src={msg.imageUrl}
                          alt="Problem attachment"
                          className="h-36 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start">
                <div className="flex max-w-[92%] items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-soft">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {msg.diagnosis ? (
                      (() => {
                        const prevUserMsg = messages
                          .slice(0, messages.findIndex((item) => item.id === msg.id))
                          .reverse()
                          .find((item) => item.role === 'user')

                        return (
                          <ChatDiagnosisCard
                            message={msg}
                            userPromptText={prevUserMsg?.text || ''}
                            userImageUrl={prevUserMsg?.imageUrl}
                            onSendRequest={handleExplicitSendRequest}
                            isSending={sendingMsgId === msg.id}
                            sentRequestId={sentRequestMap[msg.id]}
                          />
                        )
                      })()
                    ) : (
                      <div className="rounded-3xl rounded-tl-md bg-white p-4 sm:p-5 shadow-card ring-1 ring-slate-200/60">
                        <p className="text-sm sm:text-base text-ink leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      </div>
                    )}

                    {/* Smart Specialty & Category Lead Button */}
                    {(() => {
                      const catName = msg.diagnosis?.recommended_category
                      if (!catName || catName === 'General Maintenance' || catName === 'General') return null
                      const routing = getCategorySlugAndTitle(catName)
                      if (!routing) return null

                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-100/70 p-3.5 border border-primary/25 shadow-soft">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{routing.icon}</span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Matching Trade Specialist</p>
                              <p className="text-xs sm:text-sm font-extrabold text-ink">{routing.title}</p>
                            </div>
                          </div>
                          <Link
                            to={`/technicians?name=${encodeURIComponent(routing.title)}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-soft hover:bg-primary-dark transition-all shrink-0 active:scale-95"
                          >
                            <span>Find {routing.title}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ),
          )}

          {/* Typing Indicator */}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-soft animate-pulse">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200/60">
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                  <span className="ml-1 text-xs font-semibold text-ink/60">
                    {isN8nConnected ? 'n8n AI Agent is diagnosing...' : 'FixMate AI is diagnosing...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Issue Resolution CTA */}
          {messages.length >= 3 && messages[messages.length - 1].role === 'ai' && !solved && (
            <div className="rounded-3xl bg-purple-50/80 p-4 sm:p-5 text-center ring-1 ring-primary/20">
              <p className="text-sm font-bold text-ink">Did this diagnostic advice help solve your issue?</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleSolved}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-soft hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" /> Yes, issue resolved
                </button>
                <Link
                  to="/technicians"
                  className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-primary ring-1 ring-primary/20 hover:bg-primary-light transition-colors"
                >
                  <Wrench className="h-4 w-4" /> Request certified technician
                </Link>
              </div>
            </div>
          )}

          {solved && (
            <div className="rounded-3xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
              <p className="mt-1 text-xs font-bold text-emerald-800">Glad we could help solve your repair!</p>
              <Link to="/dashboard" className="mt-2 inline-block text-xs font-bold text-primary hover:underline">
                View in Customer Dashboard →
              </Link>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Bar Form */}
        <div className="mt-4 card p-3 sm:p-4 shadow-lift ring-1 ring-slate-200/80">
          {imagePreview && (
            <div className="relative mb-3 inline-block">
              <img
                src={imagePreview}
                alt="Problem attachment preview"
                className="h-20 w-20 rounded-2xl object-cover ring-2 ring-primary"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-soft hover:bg-rose-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100/80 px-4 py-2 ring-1 ring-slate-200/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask FixMate AI about any repair (e.g. washing machine issues)..."
                disabled={busy}
                className="flex-1 bg-transparent py-1.5 text-sm text-ink placeholder:text-ink/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || (!input.trim() && !imageFile)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-soft transition-all hover:bg-primary-dark disabled:opacity-40 shrink-0"
                title="Send Message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Real-time Voice Transcription Indicator */}
            {interimVoiceText && (
              <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-1.5 text-xs text-purple-800 font-medium border border-purple-200 animate-in fade-in">
                <Mic className="h-3.5 w-3.5 shrink-0 text-primary animate-pulse" />
                <span className="italic truncate">{interimVoiceText}...</span>
              </div>
            )}

            {/* Quick Action Tools */}
            <div className="flex items-center justify-between text-xs text-ink/60 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-ink/70 hover:bg-slate-200 hover:text-ink transition-colors"
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  <span>Attach Photo</span>
                </button>
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={busy || voiceState === 'transcribing'}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition-all ${
                    voiceState === 'listening' || voiceState === 'recording'
                      ? 'bg-rose-500 text-white shadow-soft animate-pulse ring-2 ring-rose-400'
                      : voiceState === 'transcribing'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-ink/70 hover:bg-slate-200 hover:text-ink'
                  }`}
                  title="Voice input (English, Urdu, or Roman Urdu)"
                >
                  {voiceState === 'transcribing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                  ) : voiceState === 'listening' || voiceState === 'recording' ? (
                    <StopCircle className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>
                    {voiceState === 'transcribing'
                      ? 'Transcribing...'
                      : voiceState === 'recording'
                      ? 'Recording (Stop)'
                      : voiceState === 'listening'
                      ? 'Listening... (Stop)'
                      : 'Voice Input'}
                  </span>
                </button>
              </div>

              <span className="hidden sm:inline text-[11px] text-ink/40">
                AI diagnosis connects directly to matching verified technicians
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function ChatDiagnosisCard({
  message,
  userPromptText,
  userImageUrl,
  onSendRequest,
  isSending,
  sentRequestId,
}: {
  message: ChatMessage
  userPromptText: string
  userImageUrl?: string
  onSendRequest: (msgId: string, description: string, imageUrl?: string, categoryName?: string) => void
  isSending: boolean
  sentRequestId?: string
}) {
  const d = message.diagnosis!

  const isGeneralResponse =
    (!d.safe_steps || d.safe_steps.length === 0) &&
    (!d.possible_causes || d.possible_causes.length === 0) &&
    !d.recommended_category &&
    !d.professional_required

  if (isGeneralResponse) {
    return (
      <div className="rounded-3xl rounded-tl-md bg-white p-5 shadow-card ring-1 ring-slate-200/80 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-primary font-bold text-xs">
            <Sparkles className="h-4 w-4" />
            <span>FixMate AI Assistant</span>
          </div>
          {message.source === 'n8n' && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-primary flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-purple-600" /> n8n AI Agent
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-medium text-ink leading-relaxed whitespace-pre-wrap">
          {d.conversational_reply || d.problem_summary}
        </p>
        {d.problem_summary_urdu && (
          <p className="text-sm font-semibold text-primary/90 leading-relaxed font-sans mt-1 bg-purple-50/60 p-2.5 rounded-xl border border-purple-100/60" dir="rtl">
            {d.problem_summary_urdu}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-3xl rounded-tl-md bg-white p-5 shadow-card ring-1 ring-slate-200/80 space-y-4">
      {/* AI Header Tag */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-primary font-bold text-xs">
          <Sparkles className="h-4 w-4" />
          <span>FixMate Diagnostic Analysis</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1 border border-emerald-200">
            <Sparkles className="h-2.5 w-2.5 text-emerald-600" /> Verified AI Analysis
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            d.urgency === 'high'
              ? 'bg-rose-100 text-rose-700 animate-pulse'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {d.urgency || 'medium'} urgency
        </span>
      </div>

      {/* Detected Visual Elements from Uploaded Photo */}
      {d.detected_objects && d.detected_objects.length > 0 && (
        <div className="rounded-2xl bg-indigo-50/80 p-3 border border-indigo-100 text-xs">
          <p className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1.5">
            <Camera className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Visual Detection from Photo</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {d.detected_objects.map((obj, i) => (
              <span key={i} className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-800 shadow-soft border border-indigo-100">
                {obj}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Problem Summary (English & Urdu) */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/50">Identified Fault / مسئلہ کی تشخیص</p>
        <p className="text-sm sm:text-base font-bold text-ink leading-snug whitespace-pre-wrap">
          {d.problem_summary}
        </p>
        {d.problem_summary_urdu && (
          <p className="text-sm font-semibold text-primary/90 leading-relaxed font-sans mt-1 bg-purple-50/60 p-2.5 rounded-xl border border-purple-100/60" dir="rtl">
            {d.problem_summary_urdu}
          </p>
        )}
      </div>

      {/* Possible Causes */}
      {d.possible_causes && d.possible_causes.length > 0 && (
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold text-ink/70">Potential root causes / ممکنہ وجوہات:</p>
          <ul className="mt-1.5 space-y-1">
            {d.possible_causes.map((cause, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-ink/80">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>{cause}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safe Steps (English & Urdu) */}
      {d.safe_steps && d.safe_steps.length > 0 && (
        <div className="rounded-2xl bg-purple-50/70 p-3.5 border border-purple-100 space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Wrench className="h-3.5 w-3.5" /> Recommended Safe First Steps / محفوظ اقدامات
          </p>
          <ul className="space-y-2">
            {d.safe_steps.map((step, i) => (
              <li key={i} className="space-y-1 text-xs text-ink/85">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="font-medium">{step}</span>
                </div>
                {d.safe_steps_urdu && d.safe_steps_urdu[i] && (
                  <p className="text-[11px] text-purple-900 pr-6" dir="rtl">
                    {d.safe_steps_urdu[i]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety Warning (English & Urdu) */}
      {(d.safety_warning || d.safety_warning_urdu) && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-bold">Safety Precautions / احتیاطی تدابیر:</span>
            {d.safety_warning && <p className="leading-snug">{d.safety_warning}</p>}
            {d.safety_warning_urdu && <p className="leading-snug font-medium" dir="rtl">{d.safety_warning_urdu}</p>}
          </div>
        </div>
      )}

      {/* Professional Recommendation & Direct CTA */}
      {d.recommended_category && (
        <div className="rounded-2xl bg-gradient-to-r from-primary-light/60 to-purple-100/50 p-4 border border-primary/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <ServiceImageLogo name={d.recommended_category} size="md" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Recommended Professional
                </p>
                <p className="text-sm font-extrabold text-ink mt-0.5">
                  {d.recommended_category}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sentRequestId ? (
                <Link
                  to="/dashboard?tab=requests"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-soft hover:bg-emerald-700 transition-all shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Request Saved in Dashboard</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onSendRequest(
                      message.id,
                      userPromptText || d.problem_summary,
                      userImageUrl,
                      d.recommended_category || undefined
                    )
                  }
                  disabled={isSending}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-soft hover:bg-purple-700 transition-all disabled:opacity-50 shrink-0 active:scale-95"
                  title="Save this diagnostic issue as an official service request in your dashboard"
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Post Service Request</span>
                </button>
              )}

              <Link
                to={`/technicians?name=${encodeURIComponent(d.recommended_category)}`}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-soft hover:bg-primary-dark transition-all shrink-0 active:scale-95"
              >
                <span>View Technicians</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
