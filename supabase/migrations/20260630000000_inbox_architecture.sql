-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'instagram', 'telegram', 'messenger')),
  external_id TEXT,
  title TEXT NOT NULL,
  avatar_url TEXT,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'blocked')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'ai', 'system')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create channel_connections table
CREATE TABLE IF NOT EXISTS public.channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'instagram', 'telegram', 'messenger')),
  account_name TEXT NOT NULL,
  external_account_id TEXT,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
DROP POLICY IF EXISTS "Conversations select workspace member" ON public.conversations;
CREATE POLICY "Conversations select workspace member" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Conversations insert workspace member" ON public.conversations;
CREATE POLICY "Conversations insert workspace member" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Conversations update workspace member" ON public.conversations;
CREATE POLICY "Conversations update workspace member" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Conversations delete workspace member" ON public.conversations;
CREATE POLICY "Conversations delete workspace member" ON public.conversations
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

-- Policies for messages
DROP POLICY IF EXISTS "Messages select workspace member" ON public.messages;
CREATE POLICY "Messages select workspace member" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Messages insert workspace member" ON public.messages;
CREATE POLICY "Messages insert workspace member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.current_user_has_workspace_role(c.workspace_id, ARRAY['owner', 'admin', 'manager', 'member'])
    )
  );

DROP POLICY IF EXISTS "Messages update workspace member" ON public.messages;
CREATE POLICY "Messages update workspace member" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.current_user_has_workspace_role(c.workspace_id, ARRAY['owner', 'admin', 'manager', 'member'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.current_user_has_workspace_role(c.workspace_id, ARRAY['owner', 'admin', 'manager', 'member'])
    )
  );

DROP POLICY IF EXISTS "Messages delete workspace member" ON public.messages;
CREATE POLICY "Messages delete workspace member" ON public.messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.current_user_has_workspace_role(c.workspace_id, ARRAY['owner', 'admin', 'manager'])
    )
  );

-- Policies for channel_connections
DROP POLICY IF EXISTS "Channel connections select workspace member" ON public.channel_connections;
CREATE POLICY "Channel connections select workspace member" ON public.channel_connections
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Channel connections insert workspace member" ON public.channel_connections;
CREATE POLICY "Channel connections insert workspace member" ON public.channel_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Channel connections update workspace member" ON public.channel_connections;
CREATE POLICY "Channel connections update workspace member" ON public.channel_connections
  FOR UPDATE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']))
  WITH CHECK (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager', 'member']));

DROP POLICY IF EXISTS "Channel connections delete workspace member" ON public.channel_connections;
CREATE POLICY "Channel connections delete workspace member" ON public.channel_connections
  FOR DELETE TO authenticated
  USING (public.current_user_has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'manager']));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON public.conversations(unread_count);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_channel_connections_workspace ON public.channel_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_channel ON public.channel_connections(channel);

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
