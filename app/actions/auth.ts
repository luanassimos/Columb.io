'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const workspaceName = formData.get('workspaceName') as string || 'My Workspace';
  const timezone = formData.get('timezone') as string || 'America/Sao_Paulo';

  if (!email || !password || !name) {
    return { error: 'Name, email, and password are required' };
  }

  const supabase = await createServerClient();

  // 1. Sign up the user (metadata is read by database trigger to generate profile & workspace)
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name,
        workspace_name: workspaceName,
        timezone: timezone,
      },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  const user = authData.user;
  const session = authData.session;
  
  if (!user) {
    return { error: 'Registration succeeded, but no user was returned.' };
  }

  revalidatePath('/', 'layout');
  
  if (!session) {
    // If email confirmation is enabled, notify user
    return { success: true, message: 'Please check your email to verify your account.' };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function changePassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || !confirmPassword) {
    return { error: 'Both password fields are required.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
