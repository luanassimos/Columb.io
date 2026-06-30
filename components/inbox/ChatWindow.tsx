import React from 'react';
import { Conversation } from '@/types';
import EmptyChat from './EmptyChat';
import MessageInput from './MessageInput';
import { ChevronLeft } from 'lucide-react';

interface ChatWindowProps {
  conversation: Conversation | null;
  onBack?: () => void;
}

export default function ChatWindow({ conversation, onBack }: ChatWindowProps) {
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
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
      {conversation ? (
        <>
          {/* Header */}
          <div className="px-6 py-4 bg-white border-b border-[#D8E0EA] flex items-center justify-between gap-4 shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="md:hidden p-1 rounded-lg text-[#475569] hover:text-[#002B6A] hover:bg-[#EAF2FF] transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {conversation.avatar_url ? (
                <img
                  src={conversation.avatar_url}
                  alt={conversation.title}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(conversation.title)}`}>
                  {getInitials(conversation.title)}
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-[#002B6A]">{conversation.title}</h3>
                <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Online</p>
              </div>
            </div>
          </div>

          {/* Messages area placeholder */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/50">
            {/* Future messages list */}
          </div>

          {/* Message input */}
          <MessageInput />
        </>
      ) : (
        <>
          {/* Header placeholder (same height for visual consistency) */}
          <div className="px-6 py-4 bg-white border-b border-[#D8E0EA] flex items-center gap-3 shrink-0 shadow-sm z-10 md:hidden">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg text-[#475569] hover:text-[#002B6A] hover:bg-[#EAF2FF] transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <span className="text-xs font-bold text-[#002B6A]">WhatsApp Inbox</span>
          </div>

          {/* Empty state view */}
          <EmptyChat />

          {/* Bottom input area layout displayed as disabled */}
          <MessageInput />
        </>
      )}
    </div>
  );
}
