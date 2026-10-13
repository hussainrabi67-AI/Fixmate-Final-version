import { useEffect, useState, useRef } from 'react'
import {
  MessageSquare, Send, Search, CheckCheck, Check, Clock, User,
  Phone, Globe, Sparkles, RefreshCw, AlertCircle, ArrowLeft,
  ChevronRight, ShieldCheck, Wrench, MessageCircle, Info
} from 'lucide-react'
import type { Conversation, ChatMessage } from '../../types/chat'
import { CHAT_TRANSLATIONS } from '../../types/chat'
import {
  fetchCustomerConversations, fetchTechnicianConversations,
  fetchMessages, sendMessage, markMessagesAsRead,
  subscribeToMessages, isUrduText
} from '../../lib/chatService'
import { getTechnicianWhatsAppUrl } from '../../lib/technicianService'

interface ChatSectionProps {
  currentUserId: string
  userRole: 'user' | 'technician'
  technicianId?: string
  initialConversationId?: string | null
  onUnreadCountChange?: (count: number) => void
}

export default function ChatSection({
  currentUserId,
  userRole,
  technicianId,
  initialConversationId,
  onUnreadCountChange,
}: ChatSectionProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [language, setLanguage] = useState<'en' | 'ur'>('en')
  const [error, setError] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dict = CHAT_TRANSLATIONS[language]

  // 1. Load Conversations
  async function loadConversations(selectId?: string | null) {
    try {
      setError('')
      let convs: Conversation[] = []
      if (userRole === 'technician' && technicianId) {
        convs = await fetchTechnicianConversations(technicianId, currentUserId)
      } else {
        convs = await fetchCustomerConversations(currentUserId)
      }

      setConversations(convs)

      // Calculate total unread count for parent dashboard
      const totalUnread = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0)
      if (onUnreadCountChange) onUnreadCountChange(totalUnread)

      // Determine which conversation to select
      const targetId = selectId || initialConversationId || selectedConversation?.id
      if (targetId) {
        const found = convs.find((c) => c.id === targetId)
        if (found) {
          setSelectedConversation(found)
          setMobileView('chat')
        } else if (convs.length > 0 && !selectedConversation) {
          setSelectedConversation(convs[0])
        }
      } else if (convs.length > 0 && !selectedConversation) {
        setSelectedConversation(convs[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load conversations.')
    } finally {
      setLoadingConvs(false)
    }
  }

  useEffect(() => {
    loadConversations(initialConversationId)
  }, [currentUserId, userRole, technicianId, initialConversationId])

  // 2. Load Messages when Selected Conversation Changes
  async function loadSelectedMessages(convId: string) {
    setLoadingMsgs(true)
    try {
      const msgs = await fetchMessages(convId)
      setMessages(msgs)
      await markMessagesAsRead(convId, currentUserId)

      // Update local unread state
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      )
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingMsgs(false)
      scrollToBottom()
    }
  }

  useEffect(() => {
    if (!selectedConversation) return
    loadSelectedMessages(selectedConversation.id)

    // Subscribe to Realtime messages for active conversation
    const unsubscribe = subscribeToMessages(selectedConversation.id, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })

      // Mark as read immediately if it's from the other party
      if (newMsg.sender_id !== currentUserId) {
        markMessagesAsRead(selectedConversation.id, currentUserId)
      }

      scrollToBottom()
    })

    // Polling sync every 4 seconds as a fallback
    const interval = setInterval(() => {
      fetchMessages(selectedConversation.id).then((latestMsgs) => {
        setMessages(latestMsgs)
      })
    }, 4000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [selectedConversation?.id, currentUserId])

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // 3. Handle Send Message
  async function handleSend(textToSend?: string) {
    const text = (textToSend || inputMessage).trim()
    if (!text || !selectedConversation || sending) return

    setSending(true)
    setInputMessage('')

    // Optimistic UI insertion
    const tempId = `temp-${Date.now()}`
    const senderRole = userRole === 'technician' ? 'technician' : 'user'
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      sender_role: senderRole,
      content: text,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()

    try {
      const recipientId = selectedConversation.other_party_user_id
      const actualMsg = await sendMessage({
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        senderRole,
        content: text,
        recipientUserId: recipientId,
      })

      if (actualMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? actualMsg : m)))
      }

      // Update conversation list item last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message: text,
                last_message_time: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : c
        )
      )
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Message failed to send. Please try again.')
    } finally {
      setSending(false)
      scrollToBottom()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Search Filter
  const filteredConversations = conversations.filter((c) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      c.other_party_name?.toLowerCase().includes(query) ||
      c.other_party_profession?.toLowerCase().includes(query) ||
      c.request_title?.toLowerCase().includes(query) ||
      c.last_message?.toLowerCase().includes(query)
    )
  })

  // Format Time
  function formatTime(isoString?: string | null): string {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  // WhatsApp Link for Other Party
  const whatsappUrl = selectedConversation?.other_party_phone
    ? getTechnicianWhatsAppUrl(
        selectedConversation.other_party_phone,
        selectedConversation.other_party_name || 'Customer',
        selectedConversation.request_title || 'FixMate Inquiry'
      )
    : null

  return (
    <div className="flex h-[780px] max-h-[85vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-primary/10">
      {/* Top Banner / Navigation Header */}
      <div className="flex items-center justify-between border-b border-primary/10 bg-gradient-to-r from-primary-light/80 via-white to-primary-light/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">{dict.messages}</h2>
            <p className="text-xs font-medium text-ink/60">
              {userRole === 'technician' ? 'Customer Support & Inquiries' : 'Direct Technician Messaging'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center rounded-2xl bg-white p-1 ring-1 ring-primary/15 shadow-sm">
            <button
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/60 hover:text-primary hover:bg-primary-light/50'
              }`}
            >
              🇬🇧 {dict.english}
            </button>
            <button
              onClick={() => setLanguage('ur')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                language === 'ur'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/60 hover:text-primary hover:bg-primary-light/50'
              }`}
            >
              🇵🇰 {dict.urdu}
            </button>
          </div>

          <button
            onClick={() => loadConversations(selectedConversation?.id)}
            className="rounded-2xl p-2.5 text-ink/60 hover:bg-primary-light hover:text-primary transition-colors"
            title="Refresh messages"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 px-6 py-2.5 text-xs font-medium text-red-600 border-b border-red-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
        {/* Left Sidebar: Conversations List */}
        <div
          className={`flex-col border-r border-primary/10 bg-slate-50/50 md:col-span-4 md:flex ${
            mobileView === 'list' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Search Box */}
          <div className="p-4 border-b border-primary/10 bg-white">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={dict.searchConversations}
                className="w-full rounded-2xl bg-slate-100/80 py-2.5 pl-10 pr-4 text-xs font-medium text-ink placeholder:text-ink/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Conversations List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-primary/5 p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex h-40 items-center justify-center text-ink/40">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-ink/50">
                <MessageCircle className="mx-auto h-8 w-8 text-ink/20" />
                <p className="mt-2 text-xs font-semibold">No active conversations found</p>
                <p className="mt-1 text-[11px] text-ink/40">
                  {userRole === 'technician'
                    ? 'Customer inquiries will appear here'
                    : 'Start a chat from any technician profile or service request!'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id
                const hasUnread = (conv.unread_count || 0) > 0

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversation(conv)
                      setMobileView('chat')
                    }}
                    className={`group relative flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-soft'
                        : 'bg-white hover:bg-primary-light/60 text-ink'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {conv.other_party_avatar ? (
                        <img
                          src={conv.other_party_avatar}
                          alt={conv.other_party_name || ''}
                          className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white/50"
                        />
                      ) : (
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl font-black text-sm ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
                          }`}
                        >
                          {conv.other_party_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>

                    {/* Meta & Last Msg */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="truncate text-xs font-bold">
                          {conv.other_party_name}
                        </h4>
                        <span
                          className={`shrink-0 text-[10px] font-medium ${
                            isSelected ? 'text-white/80' : 'text-ink/40'
                          }`}
                        >
                          {formatTime(conv.last_message_time)}
                        </span>
                      </div>

                      {conv.other_party_profession && (
                        <p
                          className={`truncate text-[11px] font-medium ${
                            isSelected ? 'text-white/90' : 'text-primary font-semibold'
                          }`}
                        >
                          {conv.other_party_profession}
                        </p>
                      )}

                      {conv.request_title && (
                        <p
                          className={`truncate text-[10px] ${
                            isSelected ? 'text-white/70' : 'text-ink/50'
                          }`}
                        >
                          📌 {conv.request_title}
                        </p>
                      )}

                      <p
                        className={`mt-1 truncate text-xs ${
                          isSelected ? 'text-white/80' : 'text-ink/60'
                        } ${hasUnread && !isSelected ? 'font-bold text-ink' : ''}`}
                      >
                        {conv.last_message || 'Tap to view conversation'}
                      </p>
                    </div>

                    {/* Unread Badge */}
                    {hasUnread && !isSelected && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white shadow-soft">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Area: Messages Thread */}
        <div
          className={`flex flex-col bg-white md:col-span-8 ${
            mobileView === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="flex items-center justify-between border-b border-primary/10 bg-slate-50/80 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileView('list')}
                    className="rounded-xl p-1.5 text-ink/60 hover:bg-primary-light md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="relative">
                    {selectedConversation.other_party_avatar ? (
                      <img
                        src={selectedConversation.other_party_avatar}
                        alt={selectedConversation.other_party_name || ''}
                        className="h-10 w-10 rounded-2xl object-cover ring-2 ring-primary/20"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light font-bold text-primary">
                        {selectedConversation.other_party_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                      {selectedConversation.other_party_name}
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {dict.online}
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-ink/60 font-medium">
                      <span>{selectedConversation.other_party_profession || 'Verified User'}</span>
                      {selectedConversation.request_title && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px] text-primary font-semibold">
                            {selectedConversation.request_title}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Actions: WhatsApp */}
                <div className="flex items-center gap-2">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Messages Thread History */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/30">
                {loadingMsgs ? (
                  <div className="flex h-48 items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto my-12 max-w-sm rounded-3xl bg-white p-6 text-center ring-1 ring-primary/10 shadow-soft">
                    <Sparkles className="mx-auto h-8 w-8 text-primary" />
                    <h4 className="mt-3 text-sm font-bold text-ink">{dict.noMessagesYet}</h4>
                    <p className="mt-1 text-xs text-ink/60">
                      Send a message below or click one of the quick response chips to get started!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId
                    const isUrduMsg = isUrduText(msg.content) || language === 'ur'

                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          dir={isUrduMsg ? 'rtl' : 'ltr'}
                          className={`relative max-w-[85%] sm:max-w-[70%] rounded-3xl px-4 py-3 shadow-soft ${
                            isMe
                              ? 'bg-primary text-white rounded-br-xs'
                              : 'bg-white text-ink ring-1 ring-primary/10 rounded-bl-xs'
                          }`}
                        >
                          {/* Message Content */}
                          <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>

                          {/* Footer Meta */}
                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                              isMe ? 'text-white/70' : 'text-ink/40'
                            }`}
                          >
                            <span>{formatTime(msg.created_at)}</span>
                            {isMe && (
                              <span>
                                {msg.is_read ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-white" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-white/80" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Response Chips */}
              <div className="border-t border-primary/10 bg-white px-4 py-2">
                <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider mb-1.5">
                  {dict.quickRepliesTitle}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {dict.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => handleSend(reply)}
                      disabled={sending}
                      className="shrink-0 rounded-2xl bg-primary-light/60 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Footer Box */}
              <div className="p-3 sm:p-4 border-t border-primary/10 bg-white">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <textarea
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={dict.typeMessage}
                      dir={isUrduText(inputMessage) || language === 'ur' ? 'rtl' : 'ltr'}
                      className="w-full resize-none rounded-2xl bg-slate-100/80 px-4 py-3 text-xs sm:text-sm font-medium text-ink placeholder:text-ink/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] max-h-[120px]"
                    />
                  </div>

                  <button
                    onClick={() => handleSend()}
                    disabled={!inputMessage.trim() || sending}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-soft hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50"
                  >
                    {sending ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-light text-primary shadow-soft">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-base font-bold text-ink">{dict.selectConversation}</h3>
              <p className="mt-1 text-xs text-ink/60 max-w-sm">
                Choose a conversation from the sidebar to view message history, chat in real-time, or toggle language to Urdu!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
