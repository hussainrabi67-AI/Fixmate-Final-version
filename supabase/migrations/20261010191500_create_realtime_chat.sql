-- FixMate Realtime Chat Migration
-- Creates conversations and messages tables, indexes, RLS policies, and enables realtime.

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_technician ON public.conversations(technician_id);
CREATE INDEX IF NOT EXISTS idx_conversations_request ON public.conversations(request_id);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'technician'
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- 3. Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversation RLS
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() = customer_id OR
    EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.id = conversations.technician_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id OR
    EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.id = conversations.technician_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (
    auth.uid() = customer_id OR
    EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.id = conversations.technician_id AND t.user_id = auth.uid()
    )
  );

-- Messages RLS
DROP POLICY IF EXISTS "Participants can view conversation messages" ON public.messages;
CREATE POLICY "Participants can view conversation messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.technicians t
            WHERE t.id = c.technician_id AND t.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.technicians t
            WHERE t.id = c.technician_id AND t.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Recipients can update message read status" ON public.messages;
CREATE POLICY "Recipients can update message read status"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.customer_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.technicians t
            WHERE t.id = c.technician_id AND t.user_id = auth.uid()
          )
        )
    )
  );

-- Enable Supabase Realtime Publication for messages and conversations if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
