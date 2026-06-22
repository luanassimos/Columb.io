'use client';

import React, { useState, useEffect } from 'react';
import { Contact, Notification, ContactStatus } from '@/types';
import {
  Inbox,
  Search,
  Trash2,
  Check,
  Loader2,
  Mail,
  User,
  Clock,
  ChevronRight,
  Eye,
  EyeOff,
  Building,
  Tag,
  MessageSquare,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';
import { toggleNotificationRead, deleteNotification } from '@/app/actions/notification';
import { updateContact } from '@/app/actions/contact';
import { useRouter } from 'next/navigation';

interface InboxClientProps {
  contacts: Contact[];
  notifications: Notification[];
  role: string;
}

interface ParsedReply {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactCompany: string;
  subject: string;
  body: string;
  receivedAt: string;
  read: boolean;
}

const CRM_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  waiting: 'Aguardando',
  replied: 'Respondido',
  converted: 'Convertido',
  closed: 'Perdido/Fechado',
};

const CRM_STATUS_COLORS: Record<ContactStatus, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  contacted: 'bg-purple-50 text-purple-700 border-purple-100',
  waiting: 'bg-amber-50 text-amber-700 border-amber-100',
  replied: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  converted: 'bg-teal-50 text-teal-700 border-teal-100',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function InboxClient({ contacts, notifications, role }: InboxClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Status updates states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Parse notifications of type 'email_replied'
  const parsedReplies: ParsedReply[] = notifications.map(notif => {
    try {
      const payload = JSON.parse(notif.message);
      return {
        id: notif.id,
        contactId: payload.contact_id || '',
        contactName: notif.title || 'Lead Misterioso',
        contactEmail: payload.contact_email || '',
        contactCompany: payload.contact_company || '',
        subject: payload.subject || 'Sem Assunto',
        body: payload.body || '',
        receivedAt: notif.created_at,
        read: notif.read,
      };
    } catch {
      // Fallback if not JSON
      return {
        id: notif.id,
        contactId: '',
        contactName: notif.title || 'Lead Misterioso',
        contactEmail: '',
        contactCompany: '',
        subject: 'Resposta de e-mail',
        body: notif.message,
        receivedAt: notif.created_at,
        read: notif.read,
      };
    }
  });

  // Filter & Search
  const filteredReplies = parsedReplies.filter(reply => {
    // Read status filter
    if (filter === 'unread' && reply.read) return false;
    if (filter === 'read' && !reply.read) return false;

    // Text search filter
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      reply.contactName.toLowerCase().includes(q) ||
      reply.contactEmail.toLowerCase().includes(q) ||
      reply.contactCompany.toLowerCase().includes(q) ||
      reply.subject.toLowerCase().includes(q) ||
      reply.body.toLowerCase().includes(q)
    );
  });

  const selectedReply = parsedReplies.find(r => r.id === selectedId);
  const selectedContact = contacts.find(c => c.id === selectedReply?.contactId);

  // Autoselect first item if nothing is selected and there are replies
  useEffect(() => {
    if (!selectedId && filteredReplies.length > 0) {
      setSelectedId(filteredReplies[0].id);
    }
  }, [filteredReplies, selectedId]);

  // Mark selected conversation as read automatically
  useEffect(() => {
    if (selectedReply && !selectedReply.read) {
      toggleNotificationRead(selectedReply.id, true).then(() => {
        router.refresh();
      });
    }
  }, [selectedId]);

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Excluir esta resposta permanentemente da sua caixa de entrada?')) return;
    const res = await deleteNotification(id);
    if (!res.error) {
      setSelectedId(null);
      router.refresh();
    } else {
      alert('Erro ao excluir: ' + res.error);
    }
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    const res = await toggleNotificationRead(id, !currentRead);
    if (!res.error) {
      router.refresh();
    }
  };

  const handleUpdateContactStatus = async (status: ContactStatus) => {
    if (!selectedContact) return;
    setIsUpdatingStatus(true);
    setStatusDropdownOpen(false);

    const res = await updateContact({
      id: selectedContact.id,
      name: selectedContact.name,
      company: selectedContact.company,
      email: selectedContact.email,
      phone: selectedContact.phone || undefined,
      city: selectedContact.city || undefined,
      linkedin_url: selectedContact.linkedin_url || undefined,
      tags: selectedContact.tags,
      status: status
    });

    setIsUpdatingStatus(false);
    if (!res.error) {
      router.refresh();
    } else {
      alert('Erro ao atualizar status: ' + res.error);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins}m`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500 text-white',
      'bg-indigo-500 text-white',
      'bg-purple-500 text-white',
      'bg-teal-500 text-white',
      'bg-emerald-500 text-white',
      'bg-orange-500 text-white',
      'bg-pink-500 text-white',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col space-y-4">
      {/* Main Split Layout */}
      <div className="flex-1 flex bg-white border border-[#D8E0EA] rounded-2xl overflow-hidden shadow-sm min-h-0">
        {/* Left Pane: Message List */}
        <div className="w-[360px] border-r border-[#D8E0EA] flex flex-col shrink-0 min-h-0">
          {/* List Toolbar */}
          <div className="p-4 border-b border-[#D8E0EA] space-y-3 shrink-0 bg-slate-50/50">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569]/50" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nas mensagens..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D8E0EA] bg-white text-xs text-[#061A40] placeholder-[#475569]/50 focus:outline-none focus:border-[#2D6BFF] transition-all"
              />
            </div>
            {/* Quick Filters */}
            <div className="flex gap-1.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200/50 text-[11px] font-semibold">
              {(['all', 'unread', 'read'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1 rounded-md text-center transition-all cursor-pointer ${
                    filter === f
                      ? 'bg-white text-[#002B6A] shadow-sm font-bold'
                      : 'text-[#475569]/80 hover:text-[#002B6A]'
                  }`}
                >
                  {f === 'all' ? 'Todas' : f === 'unread' ? 'Não Lidas' : 'Lidas'}
                </button>
              ))}
            </div>
          </div>

          {/* List Container */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#D8E0EA]/75 min-h-0">
            {filteredReplies.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-[#475569]/55">
                  <Inbox className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#002B6A]">Nenhum e-mail recebido</h4>
                  <p className="text-[10px] text-[#475569]/70 leading-normal max-w-[180px] mx-auto mt-0.5">
                    Quando seus leads responderem suas campanhas, elas aparecerão listadas aqui.
                  </p>
                </div>
              </div>
            ) : (
              filteredReplies.map(reply => {
                const isSelected = reply.id === selectedId;
                return (
                  <div
                    key={reply.id}
                    onClick={() => setSelectedId(reply.id)}
                    className={`p-4 flex gap-3 text-left transition-all cursor-pointer border-l-[3px] select-none relative ${
                      isSelected
                        ? 'bg-[#EAF2FF]/50 border-[#2D6BFF]'
                        : reply.read
                        ? 'border-transparent hover:bg-slate-50/50'
                        : 'border-[#2D6BFF]/40 bg-blue-50/10 font-medium'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${getAvatarColor(reply.contactName)}`}>
                      {getInitials(reply.contactName)}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-xs truncate ${!reply.read ? 'font-bold text-[#002B6A]' : 'font-semibold text-[#002B6A]'}`}>
                          {reply.contactName}
                        </span>
                        <span className="text-[9px] text-[#475569]/60 shrink-0 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelativeTime(reply.receivedAt)}
                        </span>
                      </div>
                      <div className={`text-[11px] truncate ${!reply.read ? 'font-semibold text-[#061A40]' : 'text-[#475569]'}`}>
                        {reply.subject}
                      </div>
                      <div className="text-[10px] text-[#475569]/70 truncate leading-normal">
                        {reply.body}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!reply.read && (
                      <span className="absolute right-4 bottom-4 h-2 w-2 rounded-full bg-[#2D6BFF] ring-4 ring-white" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation Details */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
          {selectedReply ? (
            <>
              {/* Active Conversation Toolbar */}
              <div className="px-6 py-4 bg-white border-b border-[#D8E0EA] flex items-center justify-between gap-4 shrink-0 shadow-sm z-10">
                {/* Contact and Status Info */}
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(selectedReply.contactName)}`}>
                    {getInitials(selectedReply.contactName)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#002B6A] flex items-center gap-2">
                      <span>{selectedReply.contactName}</span>
                      {selectedContact?.company && (
                        <span className="text-xs font-normal text-[#475569] flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {selectedReply.contactCompany}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#475569]/80 mt-0.5">{selectedReply.contactEmail}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Lead Status dropdown */}
                  {selectedContact && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                        disabled={isUpdatingStatus}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-all cursor-pointer hover:brightness-95 ${
                          CRM_STATUS_COLORS[selectedContact.status]
                        }`}
                      >
                        {isUpdatingStatus ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span>CRM: {CRM_STATUS_LABELS[selectedContact.status]}</span>
                        )}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>

                      {statusDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setStatusDropdownOpen(false)} />
                          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#D8E0EA] rounded-xl shadow-lg py-1.5 z-30">
                            <div className="px-3 py-1 text-[9px] font-bold text-[#475569]/60 uppercase tracking-wider">
                              Alterar Status no CRM
                            </div>
                            {(Object.keys(CRM_STATUS_LABELS) as ContactStatus[]).map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleUpdateContactStatus(s)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#EAF2FF] transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                                  selectedContact.status === s ? 'text-[#2D6BFF] font-bold bg-[#EAF2FF]/30' : 'text-[#061A40]'
                                }`}
                              >
                                <span>{CRM_STATUS_LABELS[s]}</span>
                                {selectedContact.status === s && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Mark unread */}
                  <button
                    type="button"
                    onClick={() => handleToggleRead(selectedReply.id, selectedReply.read)}
                    className="p-2 border border-[#D8E0EA] hover:border-[#2D6BFF]/30 hover:bg-[#EAF2FF] rounded-lg text-[#475569] hover:text-[#002B6A] transition-all cursor-pointer shadow-sm"
                    title={selectedReply.read ? 'Marcar como não lida' : 'Marcar como lida'}
                  >
                    {selectedReply.read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteConversation(selectedReply.id)}
                    className="p-2 border border-rose-100 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600 transition-all cursor-pointer shadow-sm"
                    title="Excluir da Caixa de Entrada"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Message Thread Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/50">
                {/* Outbound Email placeholder to show context */}
                <div className="bg-white border border-[#D8E0EA]/75 rounded-2xl p-5 space-y-3 shadow-xs max-w-2xl mx-auto">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-[#475569] flex items-center gap-1.5">
                        <span>Você</span>
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        <span className="font-normal text-[#475569]/70">para {selectedReply.contactName}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#002B6A] mt-1">
                        Assunto: {selectedReply.subject.startsWith('Re:') ? selectedReply.subject.substring(3).trim() : selectedReply.subject}
                      </h4>
                    </div>
                    <span className="text-[10px] text-[#475569]/50 font-medium">Outbound original</span>
                  </div>
                  <hr className="border-[#D8E0EA]/50" />
                  <div className="text-xs text-[#475569] italic whitespace-pre-wrap leading-relaxed">
                    [E-mail inicial disparado pelo Columb.io utilizando o modelo da campanha]
                  </div>
                </div>

                {/* Inbound Lead Reply Bubble */}
                <div className="bg-[#EAF2FF]/20 border border-[#2D6BFF]/15 rounded-2xl p-5 space-y-3 shadow-xs max-w-2xl mx-auto border-l-4 border-l-[#2D6BFF]">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-[#002B6A] flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-[#2D6BFF]" />
                        <span>{selectedReply.contactName}</span>
                        <span className="font-normal text-[#475569]/75">&lt;{selectedReply.contactEmail}&gt;</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#002B6A] mt-1">
                        Assunto: {selectedReply.subject}
                      </h4>
                    </div>
                    <span className="text-[10px] text-[#2D6BFF] font-bold bg-[#EAF2FF] px-2 py-0.5 rounded-full border border-[#2D6BFF]/10">
                      Resposta do Lead
                    </span>
                  </div>
                  <hr className="border-[#2D6BFF]/10" />
                  <div className="text-xs text-[#061A40] whitespace-pre-wrap leading-relaxed font-medium">
                    {selectedReply.body}
                  </div>
                </div>
              </div>

              {/* Simulated Reply Editor Footer */}
              <div className="p-4 bg-white border-t border-[#D8E0EA] shrink-0">
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#475569]">
                    <span className="flex items-center gap-1 font-semibold text-[#002B6A]">
                      <MessageSquare className="h-3.5 w-3.5 text-[#2D6BFF]" />
                      Responder Lead (Simulador)
                    </span>
                    <span className="text-[10px] text-[#475569]/60 italic">Respostas simuladas enviam apenas via logs de teste</span>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      placeholder={`Escreva uma resposta para ${selectedReply.contactName}...`}
                      rows={2}
                      className="flex-1 px-3 py-2 border border-[#D8E0EA] rounded-xl text-xs placeholder-[#475569]/55 focus:outline-none focus:border-[#2D6BFF] resize-none"
                      disabled
                    />
                    <button
                      type="button"
                      disabled
                      className="px-4 bg-[#EAF2FF] text-[#2D6BFF] text-xs font-bold rounded-xl transition-all flex items-center justify-center opacity-65 cursor-not-allowed"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Selected Conversation Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="h-16 w-16 bg-white border border-[#D8E0EA] rounded-2xl flex items-center justify-center shadow-xs text-[#475569]/40">
                <Mail className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#002B6A]">Nenhuma conversa selecionada</h3>
                <p className="text-xs text-[#475569] max-w-[280px] leading-normal">
                  Selecione um e-mail da lista à esquerda para analisar o histórico e atualizar o status do Lead no CRM.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
