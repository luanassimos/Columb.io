'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { CampaignStatus } from '@/types';

export interface CreateCampaignInput {
  name: string;
  template_id: string;
  status: CampaignStatus;
  schedule_days: number[];
  schedule_time: string;
  target_tags: string[];
  smtp_setting_id?: string | null;
}

export interface UpdateCampaignInput {
  id: string;
  name: string;
  template_id: string;
  status: CampaignStatus;
  schedule_days: number[];
  schedule_time: string;
  target_tags: string[];
  smtp_setting_id?: string | null;
}

export async function createCampaign(input: CreateCampaignInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Get active workspace from profile
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  if (pError || !profile?.workspace_id) {
    return { error: 'Could not determine active workspace' };
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: profile.workspace_id,
      name: input.name.trim(),
      template_id: input.template_id,
      status: input.status,
      schedule_days: input.schedule_days,
      schedule_time: input.schedule_time,
      target_tags: input.target_tags,
      smtp_setting_id: input.smtp_setting_id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  return { success: true, campaignId: campaign.id };
}

export async function updateCampaign(input: UpdateCampaignInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('campaigns')
    .update({
      name: input.name.trim(),
      template_id: input.template_id,
      status: input.status,
      schedule_days: input.schedule_days,
      schedule_time: input.schedule_time,
      target_tags: input.target_tags,
      smtp_setting_id: input.smtp_setting_id || null,
    })
    .eq('id', input.id);

  if (error) {
    console.error('Error updating campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  return { success: true };
}

export async function deleteCampaign(id: string) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  return { success: true };
}

export async function bulkUpdateCampaignStatus(ids: string[], status: CampaignStatus) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('campaigns')
    .update({ status })
    .in('id', ids);

  if (error) {
    console.error('Error bulk updating campaigns status:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  return { success: true };
}

export async function bulkDeleteCampaigns(ids: string[]) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error bulk deleting campaigns:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  return { success: true };
}
