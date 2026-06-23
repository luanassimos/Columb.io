'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign, updateCampaign } from '@/app/actions/campaign';
import { Template, Campaign, CampaignStatus, SmtpSettings } from '@/types';
import { X, Plus, Loader2, Send, Tag, Calendar, Layout, Mail, Sunrise, Sun, Sunset, Moon, Utensils } from 'lucide-react';

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  campaignToEdit?: Campaign | null;
  availableTags: string[];
  smtpSettingsList: SmtpSettings[];
  canManageStatus: boolean;
  mode?: 'campaign' | 'blast';
}

const STATUS_OPTIONS: { value: CampaignStatus; label: string; color: string }[] = [
  { value: 'draft',     label: 'Draft',     color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'running',   label: 'Running',   color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { value: 'cancelled', label: 'Paused',    color: 'bg-amber-50 text-amber-600 border-amber-100' },
];

export default function CampaignModal({
  isOpen,
  onClose,
  templates,
  campaignToEdit,
  availableTags,
  smtpSettingsList,
  canManageStatus,
  mode = 'campaign',
}: CampaignModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('draft');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [smtpSettingId, setSmtpSettingId] = useState<string>('');
  const [dispatchType, setDispatchType] = useState<'scheduled' | 'immediate'>('scheduled');

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const [alreadySentCount, setAlreadySentCount] = useState<number>(0);
  const [checkingOverlap, setCheckingOverlap] = useState<boolean>(false);

  // Sync state with campaignToEdit when modal opens or template changes
  useEffect(() => {
    if (isOpen) {
      if (campaignToEdit) {
        setName(campaignToEdit.name || '');
        setTemplateId(campaignToEdit.template_id || '');
        setStatus(canManageStatus ? campaignToEdit.status || 'draft' : 'draft');
        setScheduleDays(campaignToEdit.schedule_days || []);
        setScheduleTime(campaignToEdit.schedule_time || '09:00');
        setTargetTags(campaignToEdit.target_tags || []);
        setSmtpSettingId(campaignToEdit.smtp_setting_id || smtpSettingsList[0]?.id || '');
        setDispatchType(campaignToEdit.dispatch_type || (mode === 'blast' ? 'immediate' : 'scheduled'));
      } else {
        setName('');
        // Pre-select first template if available
        setTemplateId(templates[0]?.id || '');
        setStatus('draft');
        // Pre-fill with weekdays (Mon-Fri) and 09:00 for campaigns, empty for blasts
        setScheduleDays(mode === 'blast' ? [] : [1, 2, 3, 4, 5]);
        setScheduleTime(mode === 'blast' ? '00:00' : '09:00');
        setTargetTags([]);
        setSmtpSettingId(smtpSettingsList[0]?.id || '');
        setDispatchType(mode === 'blast' ? 'immediate' : 'scheduled');
      }
      setError(null);
    }
  }, [isOpen, campaignToEdit, templates, smtpSettingsList, canManageStatus, mode]);

  // Check if template has already been sent to contacts matching the target tags
  useEffect(() => {
    if (!isOpen || !templateId || targetTags.length === 0) {
      setAlreadySentCount(0);
      return;
    }

    const checkOverlap = async () => {
      setCheckingOverlap(true);
      try {
        const { createBrowserClient } = await import('@/lib/supabase/client');
        const supabase = createBrowserClient();

        // 1. Get contacts in the workspace to filter matching tags
        const { data: contacts, error: contactsErr } = await supabase
          .from('contacts')
          .select('id, tags');

        if (contactsErr || !contacts) {
          setAlreadySentCount(0);
          return;
        }

        const matchingContactIds = contacts
          .filter(c => {
            const contactTags = c.tags || [];
            return targetTags.some((tag: string) => contactTags.includes(tag));
          })
          .map(c => c.id);

        if (matchingContactIds.length === 0) {
          setAlreadySentCount(0);
          return;
        }

        // 2. Count email jobs that have already sent this template to these contacts
        const { count, error: jobsErr } = await supabase
          .from('email_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('template_id', templateId)
          .eq('status', 'sent')
          .in('contact_id', matchingContactIds);

        if (jobsErr) {
          setAlreadySentCount(0);
          return;
        }

        setAlreadySentCount(count || 0);
      } catch (err) {
        console.error('Error checking template overlap:', err);
        setAlreadySentCount(0);
      } finally {
        setCheckingOverlap(false);
      }
    };

    // Debounce checks slightly to avoid excessive queries during tag selection
    const delayDebounce = setTimeout(() => {
      checkOverlap();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [isOpen, templateId, targetTags]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isScheduled = dispatchType === 'scheduled';

    if (!name.trim() || !templateId || (isScheduled && (scheduleDays.length === 0 || !scheduleTime))) {
      setError('Campaign Name, Email Template, Days of the Week and Time are required.');
      return;
    }

    if (!smtpSettingId) {
      setError('Please select a Sender Outbox Email to deploy the campaign.');
      return;
    }

    if (targetTags.length === 0) {
      setError('At least one Target Tag is required to define campaign recipients.');
      return;
    }

    // Round scheduleTime to nearest 5 minutes before saving
    let finalTime = scheduleTime;
    if (isScheduled && scheduleTime) {
      const [h, m] = scheduleTime.split(':').map(Number);
      const roundedM = Math.round(m / 5) * 5;
      let finalH = h;
      let finalM = roundedM;
      if (roundedM === 60) {
        finalM = 0;
        finalH = (h + 1) % 24;
      }
      finalTime = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
      setScheduleTime(finalTime); // Update state so UI reflects it immediately
    }

    setIsSubmitting(true);
    let result;
    
    if (campaignToEdit) {
      result = await updateCampaign({
        id: campaignToEdit.id,
        name,
        template_id: templateId,
        status,
        schedule_days: isScheduled ? scheduleDays : [],
        schedule_time: isScheduled ? finalTime : '00:00',
        target_tags: targetTags,
        smtp_setting_id: smtpSettingId,
        dispatch_type: dispatchType,
      });
    } else {
      result = await createCampaign({
        name,
        template_id: templateId,
        status,
        schedule_days: isScheduled ? scheduleDays : [],
        schedule_time: isScheduled ? finalTime : '00:00',
        target_tags: targetTags,
        smtp_setting_id: smtpSettingId,
        dispatch_type: dispatchType,
      });
    }
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    } else {
      handleClose();
      router.refresh();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#061A40]/30 z-[200] transition-opacity"
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed right-0 top-0 h-full w-[50vw] bg-white z-[201] shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#D8E0EA] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#002B6A]">
              {campaignToEdit 
                ? (mode === 'blast' ? 'Edit Email Blast' : 'Edit Campaign') 
                : (mode === 'blast' ? 'Create Email Blast' : 'Create Campaign')}
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {campaignToEdit 
                ? 'Update configuration below.' 
                : (mode === 'blast' ? 'Configure one-off mass email blast.' : 'Configure automated email sequences.')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#002B6A] hover:bg-[#EAF2FF] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form id="campaign-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {templates.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <h4 className="text-xs font-bold text-amber-800">No Email Templates Found</h4>
              <p className="text-xs text-amber-700 leading-normal">
                You must create at least one email template in the <strong>Templates</strong> section before launching a campaign.
              </p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Send className="h-3.5 w-3.5" /> {mode === 'blast' ? 'Blast Name' : 'Campaign Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={mode === 'blast' ? 'e.g. Product Launch Blast' : 'e.g. Q2 Outreach Campaign'}
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Sender Email Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Mail className="h-3.5 w-3.5" /> Sender Outbox Email <span className="text-rose-400">*</span>
            </label>
            {smtpSettingsList.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <h5 className="text-xs font-bold text-amber-800">⚠️ No SMTP Configured</h5>
                <p className="text-[11px] text-amber-700 leading-normal">
                  This workspace does not have any SMTP outbox emails configured. Please configure one under <strong>Settings &gt; SMTP Outbox Accounts</strong> first.
                </p>
              </div>
            ) : (
              <select
                value={smtpSettingId}
                onChange={e => setSmtpSettingId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
              >
                {smtpSettingsList.map(smtp => (
                  <option key={smtp.id} value={smtp.id}>
                    {smtp.from_name} &lt;{smtp.user_email}&gt; ({smtp.host})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template select dropdown */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Layout className="h-3.5 w-3.5" /> Email Template <span className="text-rose-400">*</span>
            </label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              disabled={templates.length === 0}
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all font-medium"
            >
              {templates.length === 0 ? (
                <option value="">No templates available</option>
              ) : (
                <>
                  <option value="" disabled>-- Selecione um Modelo --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Target Lead Tags Selector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Tag className="h-3.5 w-3.5" /> Target Lead Tags <span className="text-rose-400">*</span>
            </label>
            {availableTags.length === 0 ? (
              <p className="text-xs text-[#475569]/60 italic">
                No tags found in active workspace. Please add tags to your contacts first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF]">
                {availableTags.map(tag => {
                  const isSelected = targetTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setTargetTags(targetTags.filter(t => t !== tag));
                        } else {
                          setTargetTags([...targetTags, tag]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
                        isSelected
                           ? 'bg-[#2D6BFF] text-white border-[#2D6BFF] font-bold shadow-sm'
                           : 'bg-white text-[#475569] border-[#D8E0EA] hover:bg-[#EAF2FF] hover:border-[#2D6BFF]/30'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warning if already sent to any target contact */}
          {alreadySentCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-xs rounded-xl flex items-start gap-2.5">
              <span className="text-sm">⚠️</span>
              <div>
                <p className="font-bold text-amber-900">Aviso de Envio Duplicado</p>
                <p className="font-medium text-amber-800 mt-0.5 leading-normal">
                  Este modelo de e-mail já foi enviado anteriormente para <strong>{alreadySentCount} contato{alreadySentCount > 1 ? 's' : ''}</strong> que possui{alreadySentCount > 1 ? 'm' : ' a'} as tags selecionadas.
                </p>
              </div>
            </div>
          )}

          {mode === 'campaign' && (
            <>
              {/* Days of the Week */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
                  <Calendar className="h-3.5 w-3.5" /> Days of the Week <span className="text-rose-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 0, label: 'D' }, // Domingo
                    { key: 1, label: 'S' }, // Segunda
                    { key: 2, label: 'T' }, // Terça
                    { key: 3, label: 'Q' }, // Quarta
                    { key: 4, label: 'Q' }, // Quinta
                    { key: 5, label: 'S' }, // Sexta
                    { key: 6, label: 'S' }, // Sábado
                  ].map((day) => {
                    const isSelected = scheduleDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setScheduleDays(scheduleDays.filter((d) => d !== day.key));
                          } else {
                            setScheduleDays([...scheduleDays, day.key].sort());
                          }
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-full border text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                          isSelected
                            ? 'bg-[#2D6BFF] text-white border-[#2D6BFF] ring-2 ring-[#2D6BFF]/20 scale-105'
                            : 'bg-[#F7FAFF] text-[#475569] border-[#D8E0EA] hover:border-[#2D6BFF]/50 hover:bg-[#EAF2FF]'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Scheduler */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
                  <Calendar className="h-3.5 w-3.5" /> Time <span className="text-rose-400">*</span>
                </label>
                
                <div className="flex items-center gap-2">
                  <select
                    value={scheduleTime.split(':')[0] || '09'}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = scheduleTime.split(':')[1] || '00';
                      setScheduleTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all cursor-pointer font-semibold"
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = String(i).padStart(2, '0');
                      return <option key={h} value={h}>{h} h</option>;
                    })}
                  </select>

                  <span className="text-sm font-bold text-[#002B6A]">:</span>

                  <select
                    value={scheduleTime.split(':')[1] || '00'}
                    onChange={(e) => {
                      const hour = scheduleTime.split(':')[0] || '09';
                      const minute = e.target.value;
                      setScheduleTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all cursor-pointer font-semibold"
                  >
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = String(i * 5).padStart(2, '0');
                      return <option key={m} value={m}>{m} min</option>;
                    })}
                  </select>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">Presets</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: '09:00', label: 'Manhã (09:00)', icon: Sunrise },
                      { value: '12:00', label: 'Almoço (12:00)', icon: Utensils },
                      { value: '15:00', label: 'Tarde (15:00)', icon: Sun },
                      { value: '18:00', label: 'Fim do dia (18:00)', icon: Sunset },
                      { value: '21:00', label: 'Noite (21:00)', icon: Moon },
                    ].map((preset) => {
                      const isPresetSelected = scheduleTime === preset.value;
                      const Icon = preset.icon;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setScheduleTime(preset.value)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                            isPresetSelected
                              ? 'bg-[#2D6BFF]/10 text-[#2D6BFF] border-[#2D6BFF]/30 scale-105 font-bold shadow-sm'
                              : 'bg-[#F7FAFF] text-[#475569] border-[#D8E0EA] hover:border-[#2D6BFF]/30 hover:bg-[#EAF2FF]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Tag className="h-3.5 w-3.5" /> Campaign Status <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(canManageStatus ? STATUS_OPTIONS : STATUS_OPTIONS.filter((opt) => opt.value === 'draft')).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (canManageStatus || opt.value === 'draft') {
                      setStatus(opt.value);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    status === opt.value
                      ? `${opt.color} border-current ring-2 ring-current/30`
                      : 'bg-[#F7FAFF] text-[#475569] border-[#D8E0EA] hover:border-[#2D6BFF]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D8E0EA] shrink-0 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-[#475569] bg-[#F7FAFF] hover:bg-[#EAF2FF] border border-[#D8E0EA] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="campaign-form"
            onClick={handleSubmit as any}
            disabled={isSubmitting || templates.length === 0}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : campaignToEdit ? (
              <>Save Changes</>
            ) : (
              <><Plus className="h-4 w-4" /> {mode === 'blast' ? 'Create Email Blast' : 'Create Campaign'}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
