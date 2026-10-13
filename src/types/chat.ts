export interface Conversation {
  id: string
  request_id: string | null
  booking_id: string | null
  customer_id: string
  technician_id: string
  created_at: string
  updated_at: string
  // Extended fields for display
  other_party_name?: string | null
  other_party_avatar?: string | null
  other_party_profession?: string | null
  other_party_phone?: string | null
  other_party_user_id?: string | null
  request_title?: string | null
  last_message?: string | null
  last_message_time?: string | null
  unread_count?: number
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: 'user' | 'technician'
  content: string
  is_read: boolean
  created_at: string
}

export interface ChatLanguageDict {
  messages: string
  searchConversations: string
  typeMessage: string
  send: string
  online: string
  serviceRequest: string
  noMessagesYet: string
  selectConversation: string
  unread: string
  technician: string
  customer: string
  directChat: string
  english: string
  urdu: string
  quickRepliesTitle: string
  quickReplies: string[]
}

export const CHAT_TRANSLATIONS: Record<'en' | 'ur', ChatLanguageDict> = {
  en: {
    messages: 'Messages',
    searchConversations: 'Search conversations...',
    typeMessage: 'Type a message...',
    send: 'Send',
    online: 'Online',
    serviceRequest: 'Service Request',
    noMessagesYet: 'No messages yet. Send a message to start chatting!',
    selectConversation: 'Select a conversation to start chatting',
    unread: 'unread',
    technician: 'Technician',
    customer: 'Customer',
    directChat: 'Direct Chat',
    english: 'English',
    urdu: 'اردو',
    quickRepliesTitle: 'Quick Replies',
    quickReplies: [
      'Is technician available today?',
      'What is the estimated cost and time?',
      'I am on my way to the service location.',
      'Please confirm your location and phone number.',
      'Thank you for the update!',
    ],
  },
  ur: {
    messages: 'پیغامات',
    searchConversations: 'گفتگو تلاش کریں...',
    typeMessage: 'پیغام ٹائپ کریں...',
    send: 'بھیجیں',
    online: 'آن لائن',
    serviceRequest: 'سروس کی درخواست',
    noMessagesYet: 'ابھی کوئی پیغام نہیں ہے۔ بات چیت شروع کرنے کے لیے پیغام بھیجیں!',
    selectConversation: 'بات چیت شروع کرنے کے لیے ایک گفتگو منتخب کریں',
    unread: 'غیر پڑھے ہوئے',
    technician: 'ٹیکنیشن',
    customer: 'کسٹمر',
    directChat: 'براہ راست چیٹ',
    english: 'English',
    urdu: 'اردو',
    quickRepliesTitle: 'فوری جوابات',
    quickReplies: [
      'کیا ٹیکنیشن آج دستیاب ہے؟',
      'تخمینہ لاگت اور وقت کیا ہے؟',
      'میں سروس کے مقام کی طرف آ رہا ہوں۔',
      'براہ کرم اپنے مقام اور فون نمبر کی تصدیق کریں۔',
      'معلومات فراہم کرنے کا شکریہ!',
    ],
  },
}
