'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CreateTemplateInput {
  name: string;
  subject: string;
  body: string;
}

export interface UpdateTemplateInput {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export async function createTemplate(input: CreateTemplateInput) {
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

  const { data: template, error } = await supabase
    .from('templates')
    .insert({
      workspace_id: profile.workspace_id,
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating template:', error);
    return { error: error.message };
  }

  revalidatePath('/templates');
  return { success: true, templateId: template.id };
}

export async function updateTemplate(input: UpdateTemplateInput) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('templates')
    .update({
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body,
    })
    .eq('id', input.id);

  if (error) {
    console.error('Error updating template:', error);
    return { error: error.message };
  }

  revalidatePath('/templates');
  return { success: true };
}

export async function deleteTemplate(id: string) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    return { error: error.message };
  }

  revalidatePath('/templates');
  return { success: true };
}
