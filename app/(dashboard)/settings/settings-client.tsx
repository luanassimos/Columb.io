'use client';

import React, { useState } from 'react';
import { changePassword } from '@/app/actions/auth';
import { saveSmtpSettings, deleteSmtpSettings } from '@/app/actions/smtp';
import { SmtpSettings } from '@/types';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Settings,
  Mail,
  Server,
  Lock,
  Activity,
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft
} from 'lucide-react';

interface SettingsClientProps {
  activeWorkspace: { id: string; name: string; timezone?: string };
  smtpSettingsList: SmtpSettings[];
  updateWorkspaceSettings: (formData: FormData) => Promise<void>;
}

type TabType = 'workspace' | 'smtp' | 'security' | 'status';

export default function SettingsClient({
  activeWorkspace,
  smtpSettingsList,
  updateWorkspaceSettings,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('workspace');
  const router = useRouter();

  // Local state for interactive submit tracking
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [isSmtpLoading, setIsSmtpLoading] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  // SMTP List/Form view states
  const [showForm, setShowForm] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<SmtpSettings | null>(null);

  // Password form states
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleWorkspaceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsWorkspaceLoading(true);
    const formData = new FormData(e.currentTarget);
    await updateWorkspaceSettings(formData);
    setIsWorkspaceLoading(false);
  };

  const handleSmtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSmtpLoading(true);
    setSmtpError(null);

    const formData = new FormData(e.currentTarget);
    const host = formData.get('host') as string;
    const portStr = formData.get('port') as string;
    const secureVal = formData.get('secure') as string;
    const userEmail = formData.get('userEmail') as string;
    const password = formData.get('password') as string;
    const fromName = formData.get('fromName') as string;

    const result = await saveSmtpSettings({
      id: editingSmtp?.id,
      host: host.trim(),
      port: parseInt(portStr),
      secure: secureVal === 'true',
      user_email: userEmail.trim(),
      password: password && password.trim() !== '' ? password : undefined,
      from_name: fromName.trim(),
    });

    setIsSmtpLoading(false);
    if (result?.error) {
      setSmtpError(result.error);
    } else {
      setShowForm(false);
      setEditingSmtp(null);
      router.refresh();
    }
  };

  const handleDeleteSmtp = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete SMTP config for ${email}?`)) return;
    const result = await deleteSmtpSettings(id);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const formData = new FormData(e.currentTarget);
    const result = await changePassword(formData);

    setIsPasswordLoading(false);
    if (result?.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(true);
      e.currentTarget.reset();
    }
  };

  const navTabs = [
    { id: 'workspace' as TabType, label: 'Workspace Configuration', icon: Briefcase },
    { id: 'smtp' as TabType,      label: 'SMTP Outbox Accounts',     icon: Server },
    { id: 'security' as TabType,  label: 'Security & Password',       icon: Lock },
    { id: 'status' as TabType,    label: 'System Status',              icon: Activity },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start max-w-5xl">
      {/* Sidebar Navigation */}
      <div className="bg-white rounded-2xl border border-[#D8E0EA] p-3 shadow-sm space-y-1">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setPasswordError(null);
                setPasswordSuccess(false);
                setShowForm(false);
                setEditingSmtp(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition-all text-left ${
                isActive
                  ? 'bg-[#EAF2FF] text-[#002B6A] border-l-4 border-l-[#2D6BFF]'
                  : 'text-[#475569] hover:bg-[#F7FAFF] hover:text-[#002B6A]'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? 'text-[#2D6BFF]' : 'text-[#475569]'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Form Area */}
      <div className="md:col-span-3">
        {/* Workspace Form */}
        {activeTab === 'workspace' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 space-y-4 shadow-sm animate-loading-delay">
            <div className="flex items-center gap-2 pb-3 border-b border-[#D8E0EA]">
              <Briefcase className="h-4.5 w-4.5 text-[#2D6BFF]" />
              <h2 className="text-sm font-bold text-[#002B6A]">Workspace Configuration</h2>
            </div>

            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#002B6A]">
                  Active Workspace Name
                </label>
                <input
                  type="text"
                  name="workspaceName"
                  defaultValue={activeWorkspace.name}
                  required
                  className="w-full max-w-md px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#002B6A]">
                  Workspace Timezone
                </label>
                <select
                  name="timezone"
                  defaultValue={activeWorkspace.timezone || 'America/Sao_Paulo'}
                  className="w-full max-w-md px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all cursor-pointer font-semibold"
                >
                  <option value="America/Sao_Paulo">Brasília (UTC-3) - America/Sao_Paulo</option>
                  <option value="UTC">UTC (GMT) - Coordinated Universal Time</option>
                  <option value="America/New_York">New York (UTC-5) - America/New_York</option>
                  <option value="America/Los_Angeles">Los Angeles (UTC-8) - America/Los_Angeles</option>
                  <option value="Europe/London">London (UTC+0) - Europe/London</option>
                  <option value="Europe/Paris">Paris (UTC+1) - Europe/Paris</option>
                  <option value="Asia/Tokyo">Tokyo (UTC+9) - Asia/Tokyo</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isWorkspaceLoading}
                className="px-4 py-2.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-[#2D6BFF]/10 flex items-center justify-center gap-2"
              >
                {isWorkspaceLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Save Workspace Settings
              </button>
            </form>
          </div>
        )}

        {/* SMTP Form or List */}
        {activeTab === 'smtp' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 space-y-4 shadow-sm animate-loading-delay">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E0EA]">
              <div className="flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-[#2D6BFF]" />
                <h2 className="text-sm font-bold text-[#002B6A]">
                  {showForm ? (editingSmtp ? 'Edit SMTP Account' : 'Add SMTP Account') : 'SMTP Outbox Accounts'}
                </h2>
              </div>
              {!showForm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSmtp(null);
                    setShowForm(true);
                    setSmtpError(null);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-[#2D6BFF]/10 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Email Account
                </button>
              )}
            </div>

            {/* List View */}
            {!showForm ? (
              <div className="space-y-3">
                {smtpSettingsList.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[#D8E0EA] rounded-2xl space-y-2">
                    <Mail className="h-8 w-8 text-[#475569]/30 mx-auto" />
                    <p className="text-xs text-[#475569] font-medium">No SMTP sender emails configured.</p>
                    <p className="text-[10px] text-[#475569]/60 max-w-xs mx-auto">
                      Add at least one SMTP account to enable email campaigns in this workspace.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#D8E0EA] border border-[#D8E0EA] rounded-2xl overflow-hidden bg-[#F7FAFF]/30">
                    {smtpSettingsList.map((smtp) => (
                      <div key={smtp.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#F7FAFF] transition-all bg-white">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#002B6A]">{smtp.from_name}</span>
                            <span className="text-[10px] text-[#475569] bg-[#EAF2FF] px-2 py-0.5 rounded-full border border-[#D8E0EA]">{smtp.user_email}</span>
                          </div>
                          <p className="text-[10px] text-[#475569]/70">
                            Host: <span className="font-semibold">{smtp.host}:{smtp.port}</span> | Security: <span className="font-semibold">{smtp.secure ? 'SSL' : 'STARTTLS'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSmtp(smtp);
                              setShowForm(true);
                              setSmtpError(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#2D6BFF] hover:bg-[#EAF2FF] rounded-lg transition-all cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSmtp(smtp.id, smtp.user_email)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Add/Edit Form View */
              <form onSubmit={handleSmtpSubmit} className="space-y-4">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingSmtp(null);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#2D6BFF] hover:text-[#002B6A] cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back to Accounts List
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      SMTP Host <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="host"
                      defaultValue={editingSmtp?.host || ''}
                      placeholder="e.g. smtp.gmail.com"
                      required
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      SMTP Port <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="port"
                      defaultValue={editingSmtp?.port || 587}
                      placeholder="e.g. 587 or 465"
                      required
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      Connection Security <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="secure"
                      defaultValue={editingSmtp?.secure ? 'true' : 'false'}
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    >
                      <option value="false">Non-secure / STARTTLS (Port 587)</option>
                      <option value="true">Secure / SSL (Port 465)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      Sender Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fromName"
                      defaultValue={editingSmtp?.from_name || ''}
                      placeholder="e.g. John Doe"
                      required
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      SMTP Username / Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="userEmail"
                      defaultValue={editingSmtp?.user_email || ''}
                      placeholder="e.g. john@company.com"
                      required
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#002B6A]">
                      SMTP Password {editingSmtp && <span className="text-xs text-[#475569]/60">(Leave blank to keep unchanged)</span>}
                    </label>
                    <input
                      type="password"
                      name="password"
                      required={!editingSmtp}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {smtpError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg">
                    {smtpError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSmtpLoading}
                    className="px-4 py-2.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-[#2D6BFF]/10 flex items-center justify-center gap-2"
                  >
                    {isSmtpLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    {editingSmtp ? 'Update SMTP' : 'Save SMTP Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingSmtp(null);
                    }}
                    className="px-4 py-2.5 bg-[#F7FAFF] hover:bg-[#EAF2FF] text-[#475569] border border-[#D8E0EA] rounded-lg text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Security / Password Form */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 space-y-4 shadow-sm animate-loading-delay">
            <div className="flex items-center gap-2 pb-3 border-b border-[#D8E0EA]">
              <Lock className="h-4.5 w-4.5 text-[#2D6BFF]" />
              <h2 className="text-sm font-bold text-[#002B6A]">Security & Password</h2>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#002B6A]">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#002B6A]">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2.5 bg-[#F7FAFF] border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-[#475569]/30 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium rounded-lg">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-600 font-medium rounded-lg flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Password updated successfully!
                </div>
              )}

              <button
                type="submit"
                disabled={isPasswordLoading}
                className="px-4 py-2.5 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-[#2D6BFF]/10 flex items-center justify-center gap-2"
              >
                {isPasswordLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Update Password
              </button>
            </form>
          </div>
        )}

        {/* System Status Panel */}
        {activeTab === 'status' && (
          <div className="bg-white rounded-2xl border border-[#D8E0EA] p-6 space-y-4 shadow-sm animate-loading-delay">
            <div className="flex items-center gap-2 pb-3 border-b border-[#D8E0EA]">
              <Settings className="h-4.5 w-4.5 text-[#2D6BFF]" />
              <h2 className="text-sm font-bold text-[#002B6A]">System Status</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-[#002B6A]">Database Connection</p>
                  <p className="text-[10px] text-[#475569] leading-normal mt-0.5">
                    Connected to Supabase PostgreSQL.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
