import { supabase } from './supabase'
import type { Conversation, ChatMessage } from '../types/chat'
import { createNotification } from './notificationService'

/**
 * Helper to detect if text is predominantly Urdu/Arabic for RTL direction.
 */
export function isUrduText(text: string): boolean {
  if (!text) return false
  const urduArabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return urduArabicRegex.test(text)
}

// LocalStorage Keys for resilient offline / fallback chat support
const STORAGE_KEY_CONVS = 'fixmate_local_conversations'
const STORAGE_KEY_MSGS = 'fixmate_local_messages'

function getLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalConversation(conv: Conversation) {
  try {
    const list = getLocalConversations()
    const existingIdx = list.findIndex((c) => c.id === conv.id)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...conv }
    } else {
      list.unshift(conv)
    }
    localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(list))
  } catch {}
}

function getLocalMessages(conversationId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_MSGS}_${conversationId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalMessage(msg: ChatMessage) {
  try {
    const list = getLocalMessages(msg.conversation_id)
    if (!list.some((m) => m.id === msg.id)) {
      list.push(msg)
      localStorage.setItem(`${STORAGE_KEY_MSGS}_${msg.conversation_id}`, JSON.stringify(list))
    }
  } catch {}
}

/**
 * Gets or creates a conversation between a customer (user_id) and a technician (technician_id).
 */
export async function getOrCreateConversation(params: {
  customerId?: string | null
  technicianId: string
  requestId?: string | null
  bookingId?: string | null
}): Promise<Conversation | null> {
  let { customerId, technicianId, requestId, bookingId } = params

  try {
    // Resolve customerId if omitted
    if (!customerId) {
      const { data: authData } = await supabase.auth.getUser()
      customerId = authData?.user?.id || null
    }

    if (!customerId) {
      console.warn('getOrCreateConversation: Missing customerId')
      return null
    }

    // 1. Try finding an existing conversation in Supabase
    let query = supabase
      .from('conversations')
      .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
      .eq('customer_id', customerId)
      .eq('technician_id', technicianId)

    if (requestId) {
      query = query.eq('request_id', requestId)
    }

    const { data: existing, error: findError } = await query.limit(1).maybeSingle()

    if (!findError && existing) {
      return existing as Conversation
    }

    // 2. Try finding any active conversation between customer & technician
    const { data: anyExisting } = await supabase
      .from('conversations')
      .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
      .eq('customer_id', customerId)
      .eq('technician_id', technicianId)
      .limit(1)
      .maybeSingle()

    if (anyExisting) {
      return anyExisting as Conversation
    }

    // 3. Insert new conversation into Supabase
    const insertPayload: Record<string, unknown> = {
      customer_id: customerId,
      technician_id: technicianId,
    }
    if (requestId) insertPayload.request_id = requestId
    if (bookingId) insertPayload.booking_id = bookingId

    const { data: created, error: insertError } = await supabase
      .from('conversations')
      .insert([insertPayload])
      .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
      .single()

    if (insertError) {
      console.warn('Error inserting conversation in Supabase, using local fallback:', insertError)
      // Fallback: check query or generate local conversation object
      const { data: fallback } = await supabase
        .from('conversations')
        .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
        .eq('customer_id', customerId)
        .eq('technician_id', technicianId)
        .limit(1)
        .maybeSingle()

      if (fallback) return fallback as Conversation

      // Client-side local fallback
      const localConv: Conversation = {
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        request_id: requestId || null,
        booking_id: bookingId || null,
        customer_id: customerId,
        technician_id: technicianId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      saveLocalConversation(localConv)
      return localConv
    }

    return created as Conversation
  } catch (err) {
    console.error('getOrCreateConversation catch error:', err)
    if (customerId && technicianId) {
      const localConv: Conversation = {
        id: `conv-${Date.now()}`,
        request_id: requestId || null,
        booking_id: bookingId || null,
        customer_id: customerId,
        technician_id: technicianId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      saveLocalConversation(localConv)
      return localConv
    }
    return null
  }
}

/**
 * Fetch all conversations for a customer (user_id).
 */
export async function fetchCustomerConversations(customerId: string): Promise<Conversation[]> {
  try {
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })

    let remoteConvs: Conversation[] = []

    if (!error && convs) {
      remoteConvs = convs as Conversation[]
    }

    // Merge with local storage fallback conversations
    const localConvs = getLocalConversations().filter((c) => c.customer_id === customerId)
    const combined = [...remoteConvs]
    for (const lc of localConvs) {
      if (!combined.some((c) => c.id === lc.id)) {
        combined.push(lc)
      }
    }

    if (combined.length === 0) return []

    // Enrich conversations with technician info and latest message
    const result: Conversation[] = []

    for (const c of combined) {
      let techName = 'Verified Technician'
      let techAvatar: string | null = null
      let techProfession: string | null = null
      let techPhone: string | null = null
      let techUserId: string | null = null

      try {
        const { data: tech } = await supabase
          .from('technicians')
          .select('id, name, avatar_url, profession, phone, whatsapp_number, user_id')
          .eq('id', c.technician_id)
          .maybeSingle()

        if (tech) {
          techName = tech.name || 'Verified Technician'
          techAvatar = tech.avatar_url
          techProfession = tech.profession
          techPhone = tech.whatsapp_number || tech.phone
          techUserId = tech.user_id
        }
      } catch {}

      // Get request title if linked
      let reqTitle: string | null = null
      if (c.request_id) {
        try {
          const { data: req } = await supabase
            .from('service_requests')
            .select('title, service_categories!left(name)')
            .eq('id', c.request_id)
            .maybeSingle()
          if (req) {
            reqTitle = req.title || (req as unknown as { service_categories?: { name: string } }).service_categories?.name || 'Service Request'
          }
        } catch {}
      }

      // Get last message and unread count
      let lastMsgText: string | null = null
      let lastMsgTime: string | null = c.updated_at || c.created_at
      let unread = 0

      try {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, is_read')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastMsg) {
          lastMsgText = lastMsg.content
          lastMsgTime = lastMsg.created_at
        }

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', customerId)
          .eq('is_read', false)

        unread = unreadCount || 0
      } catch {}

      // Check local storage messages if remote lastMsg is null
      if (!lastMsgText) {
        const lMsgs = getLocalMessages(c.id)
        if (lMsgs.length > 0) {
          const lastL = lMsgs[lMsgs.length - 1]
          lastMsgText = lastL.content
          lastMsgTime = lastL.created_at
        }
      }

      result.push({
        ...c,
        other_party_name: techName,
        other_party_avatar: techAvatar,
        other_party_profession: techProfession,
        other_party_phone: techPhone,
        other_party_user_id: techUserId,
        request_title: reqTitle,
        last_message: lastMsgText,
        last_message_time: lastMsgTime,
        unread_count: unread,
      })
    }

    return result.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime())
  } catch (err) {
    console.error('fetchCustomerConversations error:', err)
    return getLocalConversations().filter((c) => c.customer_id === customerId)
  }
}

/**
 * Fetch all conversations for a technician (technician_id).
 */
export async function fetchTechnicianConversations(technicianId: string, currentTechUserId?: string): Promise<Conversation[]> {
  try {
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('id, request_id, booking_id, customer_id, technician_id, created_at, updated_at')
      .eq('technician_id', technicianId)
      .order('updated_at', { ascending: false })

    let remoteConvs: Conversation[] = []
    if (!error && convs) {
      remoteConvs = convs as Conversation[]
    }

    const localConvs = getLocalConversations().filter((c) => c.technician_id === technicianId)
    const combined = [...remoteConvs]
    for (const lc of localConvs) {
      if (!combined.some((c) => c.id === lc.id)) {
        combined.push(lc)
      }
    }

    if (combined.length === 0) return []

    const result: Conversation[] = []

    for (const c of combined) {
      let customerName = 'Customer'
      let customerAvatar: string | null = null
      let customerPhone: string | null = null

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, phone, email')
          .eq('user_id', c.customer_id)
          .maybeSingle()

        if (profile) {
          customerName = profile.name || 'Customer'
          customerAvatar = profile.avatar_url
          customerPhone = profile.phone
        }
      } catch {}

      let reqTitle: string | null = null
      if (c.request_id) {
        try {
          const { data: req } = await supabase
            .from('service_requests')
            .select('title, service_categories!left(name)')
            .eq('id', c.request_id)
            .maybeSingle()
          if (req) {
            reqTitle = req.title || (req as unknown as { service_categories?: { name: string } }).service_categories?.name || 'Service Request'
          }
        } catch {}
      }

      let lastMsgText: string | null = null
      let lastMsgTime: string | null = c.updated_at || c.created_at
      let unread = 0

      try {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, is_read')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastMsg) {
          lastMsgText = lastMsg.content
          lastMsgTime = lastMsg.created_at
        }

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', currentTechUserId || c.technician_id)
          .eq('is_read', false)

        unread = unreadCount || 0
      } catch {}

      if (!lastMsgText) {
        const lMsgs = getLocalMessages(c.id)
        if (lMsgs.length > 0) {
          const lastL = lMsgs[lMsgs.length - 1]
          lastMsgText = lastL.content
          lastMsgTime = lastL.created_at
        }
      }

      result.push({
        ...c,
        other_party_name: customerName,
        other_party_avatar: customerAvatar,
        other_party_profession: 'Customer',
        other_party_phone: customerPhone,
        other_party_user_id: c.customer_id,
        request_title: reqTitle,
        last_message: lastMsgText,
        last_message_time: lastMsgTime,
        unread_count: unread,
      })
    }

    return result.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime())
  } catch (err) {
    console.error('fetchTechnicianConversations error:', err)
    return getLocalConversations().filter((c) => c.technician_id === technicianId)
  }
}

/**
 * Fetch messages for a conversation sorted by timestamp ascending.
 */
export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, sender_role, content, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    const remoteMsgs = (!error && data) ? (data as ChatMessage[]) : []
    const localMsgs = getLocalMessages(conversationId)

    const combined = [...remoteMsgs]
    for (const lm of localMsgs) {
      if (!combined.some((m) => m.id === lm.id)) {
        combined.push(lm)
      }
    }

    return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  } catch (err) {
    console.error('fetchMessages error:', err)
    return getLocalMessages(conversationId)
  }
}

/**
 * Sends a message in a conversation.
 */
export async function sendMessage(params: {
  conversationId: string
  senderId: string
  senderRole: 'user' | 'technician'
  content: string
  recipientUserId?: string | null
}): Promise<ChatMessage | null> {
  const { conversationId, senderId, senderRole, content, recipientUserId } = params
  if (!content.trim()) return null

  const msgObj: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    conversation_id: conversationId,
    sender_id: senderId,
    sender_role: senderRole,
    content: content.trim(),
    is_read: false,
    created_at: new Date().toISOString(),
  }

  saveLocalMessage(msgObj)

  try {
    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          sender_role: senderRole,
          content: content.trim(),
          is_read: false,
        },
      ])
      .select('id, conversation_id, sender_id, sender_role, content, is_read, created_at')
      .single()

    if (error) {
      console.warn('sendMessage insert in Supabase warning, saved locally:', error)
      return msgObj
    }

    // Touch conversation updated_at
    try {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    } catch {}

    // Send in-app notification to recipient if ID is known
    if (recipientUserId) {
      createNotification({
        userId: recipientUserId,
        type: 'chat_message',
        title: 'New Chat Message 💬',
        message: content.length > 60 ? content.substring(0, 60) + '...' : content,
      }).catch(() => {})
    }

    return (newMsg as ChatMessage) || msgObj
  } catch (err) {
    console.error('sendMessage error:', err)
    return msgObj
  }
}

/**
 * Marks messages in a conversation as read for the current user.
 */
export async function markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .eq('is_read', false)
  } catch (err) {
    console.error('markMessagesAsRead error:', err)
  }
}

/**
 * Subscribes to real-time message inserts for a conversation.
 */
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (msg: ChatMessage) => void
) {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as ChatMessage)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Gets total unread messages count for a user across all conversations.
 */
export async function fetchTotalUnreadCount(userId: string): Promise<number> {
  try {
    const { data: customerConvs } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', userId)

    const { data: tech } = await supabase
      .from('technicians')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    let techConvs: { id: string }[] = []
    if (tech) {
      const { data: tConvs } = await supabase
        .from('conversations')
        .select('id')
        .eq('technician_id', tech.id)
      techConvs = tConvs || []
    }

    const allConvIds = Array.from(
      new Set([
        ...(customerConvs || []).map((c) => c.id),
        ...techConvs.map((c) => c.id),
      ])
    )

    if (allConvIds.length === 0) return 0

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', allConvIds)
      .neq('sender_id', userId)
      .eq('is_read', false)

    return count || 0
  } catch {
    return 0
  }
}
