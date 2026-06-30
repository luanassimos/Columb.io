import { SupabaseClient } from '@supabase/supabase-js';
import { ChannelConnection, InboxChannel } from '@/types';

export interface ConnectChannelInput {
  workspace_id: string;
  channel: InboxChannel;
  account_name: string;
  external_account_id?: string | null;
  metadata?: Record<string, any>;
}

export async function connectChannel(
  supabase: SupabaseClient,
  input: ConnectChannelInput
) {
  const { data, error } = await supabase
    .from('channel_connections')
    .insert({
      workspace_id: input.workspace_id,
      channel: input.channel,
      account_name: input.account_name,
      external_account_id: input.external_account_id || null,
      connected: true,
      metadata: input.metadata || {},
    })
    .select('*')
    .single();

  if (error) {
    console.error('[InboxService] Error connecting channel:', error);
    return { error: error.message, data: null };
  }

  return { error: null, data: data as ChannelConnection };
}

export async function disconnectChannel(
  supabase: SupabaseClient,
  id: string,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from('channel_connections')
    .update({
      connected: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[InboxService] Error disconnecting channel:', error);
    return { error: error.message, success: false };
  }

  return { error: null, success: true, data: data as ChannelConnection | null };
}
