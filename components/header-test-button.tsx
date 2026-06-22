'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import SendSuccessModal from './send-success-modal';

export default function HeaderTestButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D6BFF] hover:bg-[#1b58ec] border border-[#2D6BFF]/10 rounded-lg text-xs font-bold text-white transition-all shadow-sm shadow-[#2D6BFF]/10 cursor-pointer focus:outline-none"
        title="Disparar envio das campanhas ativas"
      >
        <Send className="h-3.5 w-3.5" />
        <span>Disparar Campanhas</span>
      </button>

      <SendSuccessModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
