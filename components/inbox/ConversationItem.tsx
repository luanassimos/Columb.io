import React from 'react';
import { Conversation } from '@/types';
import { Clock } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
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

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 flex gap-3 text-left transition-all cursor-pointer border-l-[3px] select-none relative ${
        isActive
          ? 'bg-[#EAF2FF]/50 border-[#2D6BFF]'
          : 'border-transparent hover:bg-slate-50/50'
      }`}
    >
      {/* Avatar */}
      {conversation.avatar_url ? (
        <img
          src={conversation.avatar_url}
          alt={conversation.title}
          className="h-9 w-9 rounded-full shrink-0 object-cover"
        />
      ) : (
        <div className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${getAvatarColor(conversation.title)}`}>
          {getInitials(conversation.title)}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-xs font-bold text-[#002B6A] truncate">
            {conversation.title}
          </span>
          <span className="text-[9px] text-[#475569]/60 shrink-0 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(conversation.updated_at)}
          </span>
        </div>
        <div className="text-[10px] text-[#475569]/70 truncate leading-normal">
          {conversation.last_message_preview || 'Sem mensagens'}
        </div>
      </div>

      {/* Unread badge */}
      {conversation.unread_count > 0 && (
        <span className="absolute right-4 bottom-4 h-4 min-w-4 px-1 rounded-full bg-[#2D6BFF] text-[8px] font-black text-white flex items-center justify-center shadow-sm">
          {conversation.unread_count}
        </span>
      )}
    </div>
  );
}
