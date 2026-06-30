import React from 'react';
import { Conversation } from '@/types';
import ConversationItem from './ConversationItem';
import EmptyConversationList from './EmptyConversationList';
import { Search } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  const [search, setSearch] = React.useState('');

  return (
    <div className="w-full md:w-[360px] border-r border-[#D8E0EA] flex flex-col shrink-0 min-h-0 bg-white">
      {/* Search and Title Header */}
      <div className="p-4 border-b border-[#D8E0EA] space-y-3 shrink-0 bg-slate-50/50">
        <h3 className="text-sm font-black text-[#002B6A] tracking-tight">
          WhatsApp Inbox
        </h3>
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled
            placeholder="Buscar conversa..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D8E0EA] bg-white text-xs text-[#061A40] placeholder-[#475569]/55 focus:outline-none focus:border-[#2D6BFF] transition-all cursor-not-allowed"
          />
        </div>
      </div>

      {/* List Scroll Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#D8E0EA]/75 min-h-0">
        {conversations.length === 0 ? (
          <EmptyConversationList />
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
