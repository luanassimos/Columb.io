import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 select-none">
      <div className="h-16 w-16 bg-white border border-[#D8E0EA] rounded-2xl flex items-center justify-center shadow-xs text-[#475569]/40">
        <MessageSquare className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[#002B6A]">Nenhuma conversa selecionada</h3>
        <p className="text-xs text-[#475569] max-w-[280px] leading-normal mx-auto">
          Selecione uma conversa à esquerda para visualizar as mensagens.
        </p>
      </div>
    </div>
  );
}
