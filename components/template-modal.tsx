'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTemplate, updateTemplate } from '@/app/actions/template';
import { Template } from '@/types';
import { X, Plus, Loader2, Mail, Edit3, Type, FileText, Sparkles } from 'lucide-react';

const TEMPLATE_PRESETS = [
  {
    name: 'Apresentação Comercial (Cold Pitch)',
    subject: 'Parceria de Vendas com a {{company}}',
    body: 'Olá, {{name}}!\n\nTudo bem?\n\nVi que a {{company}} está crescendo e expandindo seu mercado de atuação. Nós ajudamos empresas a automatizar e otimizar processos de prospecção fria, reduzindo esforço manual.\n\nSeria possível conversarmos por 10 minutos na próxima quinta-feira às 14h?\n\nAbraços,',
  },
  {
    name: 'Follow-up de Conexão',
    subject: 'Dúvida rápida sobre a {{company}}',
    body: 'Olá, {{name}}!\n\nPassando apenas para confirmar se você recebeu meu e-mail anterior sobre a prospecção da {{company}} e se faria sentido agendarmos uma breve apresentação esta semana.\n\nAtenciosamente,',
  },
  {
    name: 'Proposta de Integração',
    subject: 'Integração de Sistemas para {{company}}',
    body: 'Olá, {{name}}!\n\nEspero que esteja bem.\n\nEstive analisando as soluções de tecnologia da {{company}} e vejo uma excelente oportunidade para integrarmos nossos sistemas para otimizar seus relatórios.\n\nVocê teria disponibilidade para conversarmos brevemente esta semana?\n\nObrigado,',
  }
];

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateToEdit?: Template | null;
}

export default function TemplateModal({ isOpen, onClose, templateToEdit }: TemplateModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Cursor tracking for inserting variables
  const [activeField, setActiveField] = useState<'subject' | 'body' | null>(null);
  const [selectionStart, setSelectionStart] = useState<number>(0);
  const [selectionEnd, setSelectionEnd] = useState<number>(0);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Sync state with templateToEdit when modal opens or template changes
  useEffect(() => {
    if (isOpen) {
      if (templateToEdit) {
        setName(templateToEdit.name || '');
        setSubject(templateToEdit.subject || '');
        setBody(templateToEdit.body || '');
      } else {
        setName('');
        setSubject('');
        setBody('');
      }
      setActiveField(null);
      setError(null);
    }
  }, [isOpen, templateToEdit]);

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

  const trackSubjectCursor = () => {
    setActiveField('subject');
    if (subjectInputRef.current) {
      setSelectionStart(subjectInputRef.current.selectionStart || 0);
      setSelectionEnd(subjectInputRef.current.selectionEnd || 0);
    }
  };

  const trackBodyCursor = () => {
    setActiveField('body');
    if (bodyTextareaRef.current) {
      setSelectionStart(bodyTextareaRef.current.selectionStart || 0);
      setSelectionEnd(bodyTextareaRef.current.selectionEnd || 0);
    }
  };

  const insertVariable = (variable: string) => {
    if (activeField === 'subject') {
      const start = selectionStart;
      const end = selectionEnd;
      const before = subject.substring(0, start);
      const after = subject.substring(end);
      const val = before + variable + after;
      setSubject(val);

      setTimeout(() => {
        if (subjectInputRef.current) {
          subjectInputRef.current.focus();
          const cursor = start + variable.length;
          subjectInputRef.current.setSelectionRange(cursor, cursor);
          setSelectionStart(cursor);
          setSelectionEnd(cursor);
        }
      }, 30);
    } else if (activeField === 'body') {
      const start = selectionStart;
      const end = selectionEnd;
      const before = body.substring(0, start);
      const after = body.substring(end);
      const val = before + variable + after;
      setBody(val);

      setTimeout(() => {
        if (bodyTextareaRef.current) {
          bodyTextareaRef.current.focus();
          const cursor = start + variable.length;
          bodyTextareaRef.current.setSelectionRange(cursor, cursor);
          setSelectionStart(cursor);
          setSelectionEnd(cursor);
        }
      }, 30);
    } else {
      // Default fallback: append to body
      setBody(prev => prev + variable);
      setTimeout(() => {
        if (bodyTextareaRef.current) {
          bodyTextareaRef.current.focus();
        }
      }, 30);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Template Name, Subject and Body are required.');
      return;
    }

    setIsSubmitting(true);
    let result;
    if (templateToEdit) {
      result = await updateTemplate({
        id: templateToEdit.id,
        name,
        subject,
        body,
      });
    } else {
      result = await createTemplate({
        name,
        subject,
        body,
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
              {templateToEdit ? 'Edit Template' : 'Create Template'}
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {templateToEdit ? 'Update template details below.' : 'Design a reusable email layout.'}
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
        <form id="template-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Presets Suggestions */}
          {!templateToEdit && (
            <div className="p-4 bg-slate-50 border border-[#D8E0EA] rounded-xl space-y-3">
              <div>
                <h4 className="text-xs font-bold text-[#002B6A] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  Modelos Prontos (Presets)
                </h4>
                <p className="text-[10px] text-[#475569] mt-0.5">
                  Clique em um modelo abaixo para preencher os campos automaticamente:
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PRESETS.map((preset, idx) => (
                   <button
                     key={idx}
                     type="button"
                     onClick={() => {
                       if (name.trim() || subject.trim() || body.trim()) {
                         if (!window.confirm('Isso irá substituir o conteúdo digitado atualmente. Deseja continuar?')) {
                           return;
                         }
                       }
                       setName(preset.name);
                       setSubject(preset.subject);
                       setBody(preset.body);
                     }}
                     className="px-3 py-1.5 bg-white border border-[#D8E0EA] hover:border-violet-500 hover:bg-violet-50/50 rounded-lg text-xs font-semibold text-[#002B6A] transition-all cursor-pointer shadow-xs"
                   >
                     {preset.name}
                   </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Edit3 className="h-3.5 w-3.5" /> Template Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cold Outreach - Phase 1"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <Type className="h-3.5 w-3.5" /> Email Subject <span className="text-rose-400">*</span>
            </label>
            <input
              ref={subjectInputRef}
              type="text"
              value={subject}
              onChange={e => {
                setSubject(e.target.value);
                trackSubjectCursor();
              }}
              onKeyUp={trackSubjectCursor}
              onSelect={trackSubjectCursor}
              onFocus={() => setActiveField('subject')}
              placeholder="e.g. Quick question for {{company}}"
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#002B6A]">
              <FileText className="h-3.5 w-3.5" /> Email Body <span className="text-rose-400">*</span>
            </label>
            <textarea
              ref={bodyTextareaRef}
              rows={12}
              value={body}
              onChange={e => {
                setBody(e.target.value);
                trackBodyCursor();
              }}
              onKeyUp={trackBodyCursor}
              onSelect={trackBodyCursor}
              onFocus={() => setActiveField('body')}
              placeholder="Hi {{name}},&#10;&#10;I noticed that your team in {{city}} is growing..."
              className="w-full px-3 py-2.5 rounded-lg border border-[#D8E0EA] bg-[#F7FAFF] text-sm text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] focus:bg-white transition-all resize-none font-mono"
            />
          </div>

          {/* Variables helper panel */}
          <div className="p-4 bg-[#F7FAFF] border border-[#D8E0EA] rounded-xl space-y-2.5">
            <div>
              <h4 className="text-xs font-bold text-[#002B6A]">Dynamic Placeholders</h4>
              <p className="text-[10px] text-[#475569] mt-0.5">
                Place cursor in Subject or Body field, then click to insert:
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => insertVariable('{{name}}')}
                className="px-2.5 py-1.5 bg-white border border-[#D8E0EA] hover:border-[#2D6BFF] hover:text-[#2D6BFF] rounded-lg text-xs font-semibold text-[#002B6A] transition-all shadow-sm flex items-center gap-1"
              >
                <span>&#123;&#123;name&#125;&#125;</span>
                <span className="text-[10px] text-[#475569] font-normal">(Lead Name)</span>
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{{company}}')}
                className="px-2.5 py-1.5 bg-white border border-[#D8E0EA] hover:border-[#2D6BFF] hover:text-[#2D6BFF] rounded-lg text-xs font-semibold text-[#002B6A] transition-all shadow-sm flex items-center gap-1"
              >
                <span>&#123;&#123;company&#125;&#125;</span>
                <span className="text-[10px] text-[#475569] font-normal">(Company)</span>
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{{city}}')}
                className="px-2.5 py-1.5 bg-white border border-[#D8E0EA] hover:border-[#2D6BFF] hover:text-[#2D6BFF] rounded-lg text-xs font-semibold text-[#002B6A] transition-all shadow-sm flex items-center gap-1"
              >
                <span>&#123;&#123;city&#125;&#125;</span>
                <span className="text-[10px] text-[#475569] font-normal">(City)</span>
              </button>
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
            form="template-form"
            onClick={handleSubmit as any}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2D6BFF] hover:bg-[#1b58ec] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : templateToEdit ? (
              <>Save Changes</>
            ) : (
              <><Plus className="h-4 w-4" /> Create Template</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
