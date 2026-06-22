'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import SendSuccessModal from './send-success-modal';
import type { EmailSendMode } from '@/lib/email-mode';

interface HeaderTestButtonProps {
  emailSendMode: EmailSendMode;
}

export default function HeaderTestButton({ emailSendMode }: HeaderTestButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isLive = emailSendMode === 'live';
  const modeLabel = emailSendMode === 'dry_run' ? 'dry run' : emailSendMode;

  return (
    <>
      <div className="flex items-center gap-2">
        {!isLive && (
          <span className="hidden lg:inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Email {modeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D6BFF] hover:bg-[#1b58ec] border border-[#2D6BFF]/10 rounded-lg text-xs font-bold text-white transition-all shadow-sm shadow-[#2D6BFF]/10 cursor-pointer focus:outline-none"
          title={`Disparar campanhas em modo ${modeLabel}`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Disparar Campanhas ({modeLabel})</span>
        </button>
      </div>

      <SendSuccessModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        emailSendMode={emailSendMode}
      />
    </>
  );
}
