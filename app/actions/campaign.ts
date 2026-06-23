'use server';

import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission, canManageCampaigns } from '@/lib/permissions';
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
  dispatch_type?: 'scheduled' | 'immediate';
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
  dispatch_type?: 'scheduled' | 'immediate';
}

async function validateCampaignReferences(
  supabase: any,
  workspaceId: string,
  input: { template_id: string; smtp_setting_id?: string | null }
) {
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('id')
    .eq('id', input.template_id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (templateError || !template) {
    return 'Selected template does not belong to the active workspace';
  }

  if (input.smtp_setting_id) {
    const { data: smtp, error: smtpError } = await supabase
      .from('smtp_settings')
      .select('id')
      .eq('id', input.smtp_setting_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (smtpError || !smtp) {
      return 'Selected SMTP account does not belong to the active workspace';
    }
  }

  return null;
}

export async function createCampaign(input: CreateCampaignInput) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  if (!canManageCampaigns(context.role) && input.status !== 'draft') {
    return { error: 'You do not have permission to activate campaigns' };
  }
  const permissionError = assertPermission(context.role, 'manageTemplates');
  if (permissionError && input.status !== 'draft') return permissionError;
  if (context.role === 'viewer') return { error: 'You do not have permission to create campaigns' };
  const { supabase, workspaceId } = context;

  const referenceError = await validateCampaignReferences(supabase, workspaceId, input);
  if (referenceError) return { error: referenceError };

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: input.name.trim(),
      template_id: input.template_id,
      status: input.status,
      schedule_days: input.schedule_days,
      schedule_time: input.schedule_time,
      target_tags: input.target_tags,
      smtp_setting_id: input.smtp_setting_id || null,
      dispatch_type: input.dispatch_type || 'scheduled',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  revalidatePath('/blasts');
  return { success: true, campaignId: campaign.id };
}

export async function updateCampaign(input: UpdateCampaignInput) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const { supabase, workspaceId } = context;

  if (context.role === 'viewer') {
    return { error: 'You do not have permission to update campaigns' };
  }

  const { data: existingCampaign, error: existingError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', input.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError || !existingCampaign) {
    return { error: 'Campaign not found in active workspace' };
  }

  if (existingCampaign.status === 'completed') {
    return { error: 'Completed campaigns cannot be edited' };
  }

  if (!canManageCampaigns(context.role)) {
    if (input.status !== 'draft') {
      return { error: 'You do not have permission to activate campaigns' };
    }

    if (existingCampaign.status !== 'draft') {
      return { error: 'You can only edit draft campaigns' };
    }
  }

  const referenceError = await validateCampaignReferences(supabase, workspaceId, input);
  if (referenceError) return { error: referenceError };

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
      dispatch_type: input.dispatch_type || 'scheduled',
    })
    .eq('id', input.id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error updating campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  revalidatePath('/blasts');
  return { success: true };
}

export async function deleteCampaign(id: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageCampaigns');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting campaign:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  revalidatePath('/blasts');
  return { success: true };
}

export async function bulkUpdateCampaignStatus(ids: string[], status: CampaignStatus) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageCampaigns');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('campaigns')
    .update({ status })
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error bulk updating campaigns status:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  revalidatePath('/blasts');
  return { success: true };
}

export async function bulkDeleteCampaigns(ids: string[]) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageCampaigns');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  if (ids.length === 0) return { success: true };

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error bulk deleting campaigns:', error);
    return { error: error.message };
  }

  revalidatePath('/campaigns');
  revalidatePath('/blasts');
  return { success: true };
}
