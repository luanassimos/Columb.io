'use server';

import { getActiveWorkspaceContext } from '@/lib/workspace';
import { assertPermission } from '@/lib/permissions';
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
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageTemplates');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { data: template, error } = await supabase
    .from('templates')
    .insert({
      workspace_id: workspaceId,
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
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'manageTemplates');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('templates')
    .update({
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body,
    })
    .eq('id', input.id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error updating template:', error);
    return { error: error.message };
  }

  revalidatePath('/templates');
  return { success: true };
}

export async function deleteTemplate(id: string) {
  const context = await getActiveWorkspaceContext();
  if ('error' in context) return { error: context.error };
  const permissionError = assertPermission(context.role, 'deleteTemplates');
  if (permissionError) return permissionError;
  const { supabase, workspaceId } = context;

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error deleting template:', error);
    if (error.code === '23503') {
      return { error: 'Este modelo não pode ser excluído porque está associado a uma ou mais campanhas. Por favor, remova as campanhas relacionadas antes de tentar novamente.' };
    }
    return { error: error.message };
  }

  revalidatePath('/templates');
  return { success: true };
}
