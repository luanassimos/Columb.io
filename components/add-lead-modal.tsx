'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createContact, updateContact } from '@/app/actions/contact';
import { Contact, ContactStatus } from '@/types';
import { X, Plus, Loader2, User, Building2, Mail, Phone, MapPin, Tag } from 'lucide-react';

// lucide-react@1.18 removed the LinkedIn icon — using an inline SVG instead
const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string }[] = [
  { value: 'new',       label: 'New',       color: 'bg-[#EAF2FF] text-[#2D6BFF]' },
  { value: 'contacted', label: 'Contacted',  color: 'bg-amber-50 text-amber-600' },
  { value: 'waiting',   label: 'Waiting',    color: 'bg-orange-50 text-orange-600' },
  { value: 'replied',   label: 'Replied',    color: 'bg-emerald-50 text-emerald-600' },
  { value: 'converted', label: 'Converted',  color: 'bg-teal-50 text-[#14B8A6]' },
  { value: 'closed',    label: 'Closed',     color: 'bg-[#F7FAFF] text-[#475569]' },
];

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: Contact | null;
}

export default function AddLeadModal({ isOpen, onClose, contactToEdit }: AddLeadModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [status, setStatus] = useState<ContactStatus>('new');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Sync state with contactToEdit when modal opens or contact changes
  useEffect(() => {
    if (isOpen) {
      if (contactToEdit) {
        setName(contactToEdit.name || '');
        setCompany(contactToEdit.company || '');
        setEmail(contactToEdit.email || '');
        setPhone(contactToEdit.phone || '');
        setCity(contactToEdit.city || '');
        setLinkedinUrl(contactToEdit.linkedin_url || '');
        setStatus(contactToEdit.status || 'new');
        setTags(contactToEdit.tags || []);
      } else {
        setName('');
        setCompany('');
        setEmail('');
        setPhone('');
        setCity('');
        setLinkedinUrl('');
        setStatus('new');
        setTags([]);
      }
    }
  }, [isOpen, contactToEdit]);

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

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !company.trim() || !email.trim()) {
      setError('Name, Company and Email are required.');
      return;
    }

    setIsSubmitting(true);
    let result;
    if (contactToEdit) {
      result = await updateContact({
        id: contactToEdit.id,
        name, company, email,
        phone: phone || undefined,
        city: city || undefined,
        linkedin_url: linkedinUrl || undefined,
        tags,
        status,
      });
    } else {
      result = await createContact({
        name, company, email,
        phone: phone || undefined,
        city: city || undefined,
        linkedin_url: linkedinUrl || undefined,
        tags,
        status,
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
              {contactToEdit ? 'Edit Lead' : 'Add Lead'}
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {contactToEdit ? 'Update lead details below.' : 'Fill in the contact details below.'}
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
        <form id="add-lead-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <User className="h-3.5 w-3.5" /> Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. João Silva"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Building2 className="h-3.5 w-3.5" /> Company <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Mail className="h-3.5 w-3.5" /> Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. joao@acme.com"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Phone + City (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
                <Phone className="h-3.5 w-3.5" /> Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
                <MapPin className="h-3.5 w-3.5" /> City
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. São Paulo"
                className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <LinkedinIcon className="h-3.5 w-3.5" /> LinkedIn URL
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/joaosilva"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#002B6A]">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
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

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Tag className="h-3.5 w-3.5" /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] focus-within:border-[#2D6BFF] focus-within:bg-white transition-all">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-[#EAF2FF] text-[#002B6A] text-xs font-semibold rounded-full">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-[#2D6BFF] hover:text-rose-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput && addTag(tagInput)}
                placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-[#475569]">Press Enter or comma to add a tag.</p>
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
            form="add-lead-form"
            onClick={handleSubmit as any}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : contactToEdit ? (
              <>Save Changes</>
            ) : (
              <><Plus className="h-4 w-4" /> Add Lead</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
