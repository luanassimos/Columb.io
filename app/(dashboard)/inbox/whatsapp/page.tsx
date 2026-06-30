import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppInboxPage() {
  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#002B6A] tracking-tight flex items-center gap-2.5">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
            WhatsApp Inbox
            <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold rounded-full">
              Em desenvolvimento
            </span>
          </h2>
          <p className="text-sm text-[#475569] font-medium mt-1">
            Gerencie suas conversas do WhatsApp Business e responda seus leads em tempo real.
          </p>
        </div>
      </div>

      {/* Central Card */}
      <div className="bg-white rounded-2xl border border-[#D8E0EA] p-8 shadow-sm text-center max-w-xl mx-auto space-y-4 my-8">
        <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 text-[#25D366] flex items-center justify-center mx-auto shadow-xs">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-bold text-[#002B6A]">WhatsApp ainda não conectado</h3>
          <p className="text-xs text-[#475569] max-w-sm mx-auto leading-relaxed">
            Em breve você poderá conectar sua conta do WhatsApp Business para enviar e receber mensagens diretamente pela Columb.
          </p>
        </div>
      </div>
    </div>
  );
}
