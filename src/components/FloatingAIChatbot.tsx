import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sparkles, X, Send, Bot, User, Wrench, ShieldAlert, ArrowRight,
  Maximize2, Settings, CheckCircle2, RotateCcw, Activity, ExternalLink,
  Check, AlertCircle, RefreshCw, Camera, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { diagnoseProblem, fileToBase64, getCategorySlugAndTitle } from '../lib/aiService'
import {
  getN8nChatWebhookUrl,
  setN8nChatWebhookUrl,
  testN8nConnection,
  isN8nChatConfigured,
} from '../lib/n8nService'
import type { AIDiagnosis } from '../types/ai'
import ServiceImageLogo from './ServiceImageLogo'
import VoiceInputButton from './VoiceInputButton'

interface QuickMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  imageUrl?: string
  diagnosis?: AIDiagnosis
}

export default function FloatingAIChatbot() {
  const { session, profile } = useAuth()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [n8nUrlInput, setN8nUrlInput] = useState('')
  const [showN8nUrl, setShowN8nUrl] = useState(false)
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null)
  const [isN8nActive, setIsN8nActive] = useState(false)

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<QuickMessage[]>([])
  const [chatImageFile, setChatImageFile] = useState<File | null>(null)
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null)
  const chatFileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Hide floating widget when on the dedicated /ai-assistant page to avoid redundancy
  const isDedicatedAiPage = location.pathname === '/ai-assistant'

  useEffect(() => {
    const url = getN8nChatWebhookUrl()
    setN8nUrlInput(url)
    setIsN8nActive(Boolean(url))
  }, [isOpen])

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'ai',
          text: `Hi ${profile?.name || 'there'}! Ask me anything in English or اردو about repairs, washing machines, plumbing, or electrical faults. You can also attach a photo for instant detection.`,
        },
      ])
    }
  }, [profile])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, busy, showConfig])

  // Hide floating widget when user is not logged in (website front page before login) or on the dedicated /ai-assistant page
  if (!session || isDedicatedAiPage) return null

  async function handleSaveWebhook(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setN8nChatWebhookUrl(n8nUrlInput.trim())
    setIsN8nActive(Boolean(n8nUrlInput.trim()))
    setShowConfig(false)
    setTestStatus(null)
  }

  async function handleTestWebhook() {
    if (!n8nUrlInput.trim()) {
      setTestStatus({ testing: false, success: false, message: 'Please enter a webhook URL first.' })
      return
    }
    setTestStatus({ testing: true })
    const res = await testN8nConnection(n8nUrlInput.trim())
    setTestStatus({
      testing: false,
      success: res.success,
      message: res.message,
    })
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setChatImageFile(file)
      setChatImagePreview(URL.createObjectURL(file))
    }
  }

  function clearChatImage() {
    setChatImageFile(null)
    setChatImagePreview(null)
    if (chatFileRef.current) chatFileRef.current.value = ''
  }

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim()
    if ((!text && !chatImageFile) || busy) return
    const curImgPreview = chatImagePreview
    const fileToUpload = chatImageFile

    // 1. Repetitive message check (don't entertain same message 3 or more times)
    const norm = text.toLowerCase().trim()
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
      const userMsg: QuickMessage = {
        id: String(Date.now()),
        role: 'user',
        text: text || 'Please inspect attached picture',
        imageUrl: curImgPreview || undefined,
      }

      const isUrdu = /[\u0600-\u06FF]/.test(text)
      const apologyText = isUrdu
        ? `معذرت! آپ نے ایک ہی پیغام بار بار بھیجا ہے۔ میں ایک ہی سوال کو بار بار نہیں دہرا سکتا۔ برائے مہربانی اپنے مسئلے کی مزید تفصیل بیان کریں یا نیچے دیے گئے بٹن سے ہمارے تصدیق شدہ ٹیکنیشنز سے رابطہ کریں۔`
        : `I'm sorry! You've sent the exact same message multiple times. I cannot entertain identical repeated queries. Please rephrase your query with more details or connect directly with our verified FixMate specialists below.`

      const catRouting = getCategorySlugAndTitle(text)

      const aiApologyMsg: QuickMessage = {
        id: String(Date.now() + 1),
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

      setMessages((prev) => [...prev, userMsg, aiApologyMsg])
      setInput('')
      clearChatImage()
      return
    }

    setInput('')
    clearChatImage()

    const userMsg: QuickMessage = {
      id: String(Date.now()),
      role: 'user',
      text: text || 'Please inspect attached picture',
      imageUrl: curImgPreview || undefined,
    }
    setMessages((prev) => [...prev, userMsg])
    setBusy(true)

    try {
      let imageBase64: string | undefined
      if (fileToUpload) {
        try {
          imageBase64 = await fileToBase64(fileToUpload)
        } catch {}
      }

      const diag = await diagnoseProblem({
        description: text || 'Inspect attached picture for repair issues',
        imageBase64,
        userId: session?.user.id,
      })
      const aiMsg: QuickMessage = {
        id: String(Date.now() + 1),
        role: 'ai',
        text: diag.conversational_reply || diag.problem_summary,
        diagnosis: diag,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'ai',
          text: 'I could not analyze this at the moment. Please try again or browse our verified technicians.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Chat Window Popover */}
      {isOpen && (
        <div className="mb-3 flex w-[92vw] max-w-[400px] flex-col rounded-3xl bg-white shadow-lift ring-1 ring-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary-dark p-3.5 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black tracking-tight truncate">FixMate AI Assistant</h3>
                <div className="flex items-center gap-1.5 text-[10px] text-white/90 font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isN8nActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'
                    }`}
                  />
                  <span className="truncate">
                    {isN8nActive ? 'n8n AI Agent Connected' : 'Ready / AI Diagnostics'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`rounded-lg p-1.5 transition-colors ${
                  showConfig ? 'bg-white/30 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                title="Configure n8n Webhook"
              >
                <Settings className="h-4 w-4" />
              </button>
              <Link
                to="/ai-assistant"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title="Open Full Screen AI Assistant"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* n8n Webhook Configuration Panel Drawer */}
          {showConfig && (
            <div className="border-b border-purple-100 bg-purple-50/90 p-3.5 text-xs animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Activity className="h-3.5 w-3.5" />
                  <span>n8n AI Agent Webhook</span>
                </div>
                <span className="text-[10px] text-ink/50">Real-time LLM agent</span>
              </div>
              <p className="text-[11px] text-ink/70 mb-2 leading-relaxed">
                Connect your live n8n workflow. FixMate will forward user queries and fetch real diagnostic responses.
              </p>
              <form onSubmit={handleSaveWebhook} className="space-y-2">
                <div className="relative flex items-center">
                  <input
                    type={showN8nUrl ? "text" : "password"}
                    value={n8nUrlInput}
                    onChange={(e) => setN8nUrlInput(e.target.value)}
                    placeholder="https://your-n8n.cloud/webhook/..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-2.5 pr-8 py-1.5 text-[11px] text-ink placeholder:text-ink/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowN8nUrl(!showN8nUrl)}
                    className="absolute right-2.5 text-ink/40 hover:text-ink transition-colors flex items-center justify-center"
                    title={showN8nUrl ? "Hide URL" : "Show URL"}
                  >
                    {showN8nUrl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {testStatus && (
                  <div
                    className={`rounded-lg p-2 text-[10px] flex items-start gap-1.5 ${
                      testStatus.success
                        ? 'bg-emerald-100/80 text-emerald-800'
                        : testStatus.testing
                        ? 'bg-blue-100/80 text-blue-800'
                        : 'bg-rose-100/80 text-rose-800'
                    }`}
                  >
                    {testStatus.testing ? (
                      <RefreshCw className="h-3 w-3 animate-spin shrink-0 mt-0.5" />
                    ) : testStatus.success ? (
                      <Check className="h-3 w-3 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    )}
                    <span>{testStatus.message || 'Connecting to n8n...'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testStatus?.testing || !n8nUrlInput.trim()}
                    className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-primary border border-primary/20 hover:bg-primary-light disabled:opacity-50"
                  >
                    Test Webhook
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowConfig(false)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-ink/60 hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white shadow-soft hover:bg-primary-dark"
                    >
                      Save URL
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 space-y-3 p-3.5 overflow-y-auto max-h-[380px] min-h-[220px] bg-slate-50/60 text-xs">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-white shadow-soft">
                    <p className="leading-relaxed">{m.text}</p>
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="Attached" className="mt-2 h-24 w-full rounded-xl object-cover border border-white/20" />
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[92%] space-y-2 rounded-2xl rounded-tl-sm bg-white p-3.5 shadow-card ring-1 ring-slate-200/60 text-ink">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 text-[10px]">
                      <span className="font-bold text-primary flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        FixMate Assistant
                      </span>
                      {m.diagnosis?.source === 'n8n' ? (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 font-bold text-primary flex items-center gap-1">
                          <Activity className="h-2.5 w-2.5 text-emerald-500" /> n8n AI Agent
                        </span>
                      ) : (
                        <span className="text-ink/40">AI Vision / Chat</span>
                      )}
                    </div>

                    {/* Detected visual elements from photo */}
                    {m.diagnosis?.detected_objects && m.diagnosis.detected_objects.length > 0 && (
                      <div className="rounded-xl bg-indigo-50 p-2 text-[10px] text-indigo-900 border border-indigo-100">
                        <span className="font-bold block mb-1">🔍 Photo Detection:</span>
                        <div className="flex flex-wrap gap-1">
                          {m.diagnosis.detected_objects.map((obj, i) => (
                            <span key={i} className="bg-white rounded px-1.5 py-0.5 border border-indigo-100 font-medium">{obj}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="font-medium text-ink leading-relaxed whitespace-pre-wrap">{m.text}</p>

                    {/* Urdu Translation */}
                    {m.diagnosis?.problem_summary_urdu && (
                      <p className="rounded-xl bg-purple-50/70 p-2 text-[11px] font-semibold text-purple-900 border border-purple-100/70" dir="rtl">
                        {m.diagnosis.problem_summary_urdu}
                      </p>
                    )}

                    {m.diagnosis?.safe_steps && m.diagnosis.safe_steps.length > 0 && (
                      <div className="rounded-xl bg-purple-50/80 p-2.5 text-[11px] text-ink/80 border border-purple-100">
                        <span className="font-bold text-primary block mb-1">Recommended Safe Steps:</span>
                        <ul className="space-y-1 list-disc list-inside">
                          {m.diagnosis.safe_steps.slice(0, 3).map((s, idx) => (
                            <li key={idx} className="leading-tight">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(() => {
                      const catName = m.diagnosis?.recommended_category
                      if (!catName) return null
                      const routing = getCategorySlugAndTitle(catName) || { title: catName, icon: '🔧' }

                      return (
                        <Link
                          to={`/technicians?name=${encodeURIComponent(routing.title)}`}
                          onClick={() => setIsOpen(false)}
                          className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-3 py-2 text-[11px] font-extrabold text-white shadow-soft hover:opacity-95 transition-all"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm">{routing.icon || '🔧'}</span>
                            <span className="truncate">Find {routing.title}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        </Link>
                      )
                    })()}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-[11px] text-ink/70 shadow-card">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  <span className="ml-1 font-medium">
                    {isN8nActive ? 'Fetching from n8n AI Agent...' : 'Diagnosing issue with Gemini...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick topic suggestion pills if start of conversation */}
          {messages.length <= 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100/60 px-3 py-1.5 text-[11px] scrollbar-none">
              <button
                type="button"
                onClick={() => handleSend('Washing machine is not draining water or spinning')}
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-medium text-ink/70 hover:bg-purple-100 hover:text-primary transition-colors border border-slate-200/60"
              >
                🧺 Washing Machine won't spin
              </button>
              <button
                type="button"
                onClick={() => handleSend('واشنگ مشین کا پانی نہیں نکل رہا')}
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-medium text-ink/70 hover:bg-purple-100 hover:text-primary transition-colors border border-slate-200/60"
              >
                🧺 واشنگ مشین (Urdu)
              </button>
              <button
                type="button"
                onClick={() => handleSend('Kitchen tap is leaking under the sink')}
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-medium text-ink/70 hover:bg-purple-100 hover:text-primary transition-colors border border-slate-200/60"
              >
                🚰 Leaking sink tap
              </button>
              <button
                type="button"
                onClick={() => handleSend('Circuit breaker keeps tripping')}
                className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-medium text-ink/70 hover:bg-purple-100 hover:text-primary transition-colors border border-slate-200/60"
              >
                ⚡ Tripped breaker
              </button>
            </div>
          )}

          {/* Image Preview before send */}
          {chatImagePreview && (
            <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <img src={chatImagePreview} alt="Preview" className="h-8 w-8 rounded-lg object-cover ring-1 ring-primary" />
                <span className="text-[11px] font-medium text-ink/70">Photo attached for vision AI</span>
              </div>
              <button type="button" onClick={clearChatImage} className="text-ink/40 hover:text-rose-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Quick Input Bar */}
          <div className="border-t border-slate-100 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-1.5"
            >
              <input
                ref={chatFileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => chatFileRef.current?.click()}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-ink/60 hover:bg-purple-100 hover:text-primary transition-colors shrink-0"
                title="Attach Photo for AI Vision Detection"
              >
                <Camera className="h-4 w-4" />
              </button>
              <VoiceInputButton
                onTranscript={(text) => {
                  if (text && text.trim()) handleSend(text.trim())
                }}
                language="both"
                variant="icon"
                disabled={busy}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type in English or اردو / attach photo..."
                disabled={busy}
                className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs text-ink placeholder:text-ink/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={busy || (!input.trim() && !chatImageFile)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-soft hover:bg-primary-dark transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-gradient-to-tr from-primary to-primary-dark px-4 py-3 text-sm font-bold text-white shadow-lift transition-all hover:scale-105 active:scale-95"
        aria-label="Toggle FixMate AI Chatbot"
      >
        <Sparkles className="h-4 w-4 text-yellow-300" />
        <span className="hidden sm:inline">Ask FixMate AI</span>
        {isOpen ? <X className="h-4 w-4 sm:hidden" /> : <Bot className="h-4 w-4 sm:hidden" />}
      </button>
    </div>
  )
}
