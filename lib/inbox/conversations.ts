import { SupabaseClient } from '@supabase/supabase-js';
import { Conversation, InboxChannel, ConversationStatus } from '@/types';

export interface CreateConversationInput {
  workspace_id: string;
  channel: InboxChannel;
  external_id?: string | null;
  title: string;
  avatar_url?: string | null;
  last_message_preview?: string | null;
  unread_count?: number;
  status?: ConversationStatus;
  archived?: boolean;
}

export async function createConversation(
  supabase: SupabaseClient,
  input: CreateConversationInput
) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      workspace_id: input.workspace_id,
      channel: input.channel,
      external_id: input.external_id || null,
      title: input.title,
      avatar_url: input.avatar_url || null,
      last_message_preview: input.last_message_preview || null,
      unread_count: input.unread_count ?? 0,
      status: input.status || 'active',
      archived: input.archived ?? false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[InboxService] Error creating conversation:', error);
    return { error: error.message, data: null };
  }

  return { error: null, data: data as Conversation };
}

export async function getConversation(
  supabase: SupabaseClient,
  id: string,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    console.error('[InboxService] Error getting conversation:', error);
    return { error: error.message, data: null };
  }

  return { error: null, data: data as Conversation | null };
}

export interface ListConversationsFilter {
  channel?: InboxChannel;
  status?: ConversationStatus;
  archived?: boolean;
}

export async function listConversations(
  supabase: SupabaseClient,
  workspaceId: string,
  filter?: ListConversationsFilter
) {
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (filter?.channel) {
    query = query.eq('channel', filter.channel);
  }
  if (filter?.status) {
    query = query.eq('status', filter.status);
  }
  if (filter?.archived !== undefined) {
    query = query.eq('archived', filter.archived);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[InboxService] Error listing conversations:', error);
    return { error: error.message, data: [] };
  }

  return { error: null, data: (data || []) as Conversation[] };
}
