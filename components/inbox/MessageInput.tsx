import React from 'react';
import { Send } from 'lucide-react';

export default function MessageInput() {
  return (
    <div className="p-4 bg-white border-t border-[#D8E0EA] shrink-0">
      <div className="max-w-2xl mx-auto flex gap-2">
        <textarea
          placeholder="Digite uma mensagem..."
          rows={1}
          disabled
          className="flex-1 px-3 py-2 border border-[#D8E0EA] rounded-xl text-xs placeholder-[#475569]/55 bg-slate-50/50 focus:outline-none resize-none cursor-not-allowed"
        />
        <button
          type="button"
          disabled
          className="px-4 bg-[#EAF2FF] text-[#2D6BFF] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 opacity-65 cursor-not-allowed"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Enviar</span>
        </button>
      </div>
    </div>
  );
}
