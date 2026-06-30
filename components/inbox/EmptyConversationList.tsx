import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function EmptyConversationList() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full max-w-xs mx-auto space-y-3 select-none">
      <div className="h-10 w-10 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-[#25D366] shadow-xs animate-pulse">
        <MessageCircle className="h-5 w-5" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-[#002B6A]">Nenhuma conversa encontrada</h4>
        <p className="text-[10px] text-[#475569]/70 leading-normal mt-1">
          Quando sua conta estiver conectada, as conversas aparecerão aqui.
        </p>
      </div>
    </div>
  );
}
