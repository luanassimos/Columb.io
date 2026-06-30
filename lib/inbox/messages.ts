import { SupabaseClient } from '@supabase/supabase-js';
import { Message, SenderType, MessageDirection, MessageStatus } from '@/types';

export interface CreateMessageInput {
  conversation_id: string;
  external_message_id?: string | null;
  sender_type: SenderType;
  direction: MessageDirection;
  body?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  status?: MessageStatus;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

export async function createMessage(
  supabase: SupabaseClient,
  input: CreateMessageInput
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversation_id,
      external_message_id: input.external_message_id || null,
      sender_type: input.sender_type,
      direction: input.direction,
      body: input.body || null,
      attachment_url: input.attachment_url || null,
      attachment_type: input.attachment_type || null,
      status: input.status || 'pending',
      sent_at: input.sent_at || null,
      delivered_at: input.delivered_at || null,
      read_at: input.read_at || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[InboxService] Error creating message:', error);
    return { error: error.message, data: null };
  }

  // Automatically update the conversation's last_message_preview and updated_at
  if (input.body) {
    try {
      await supabase
        .from('conversations')
        .update({
          last_message_preview: input.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.conversation_id);
    } catch (updateErr) {
      console.error('[InboxService] Warning: Failed to update conversation preview:', updateErr);
    }
  }

  return { error: null, data: data as Message };
}

export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string
) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[InboxService] Error listing messages:', error);
    return { error: error.message, data: [] };
  }

  return { error: null, data: (data || []) as Message[] };
}
