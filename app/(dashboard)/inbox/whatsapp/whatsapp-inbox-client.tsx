'use client';

import React, { useState } from 'react';
import { Conversation } from '@/types';
import ConversationList from '@/components/inbox/ConversationList';
import ChatWindow from '@/components/inbox/ChatWindow';

export default function WhatsAppInboxClient() {
  const [conversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  return (
    <div className="h-full flex flex-col">
      {/* Main Split Layout */}
      <div className="flex-1 flex bg-white border border-[#D8E0EA] rounded-2xl overflow-hidden shadow-sm min-h-0">
        
        {/* Desktop / Tablet view (always side-by-side) */}
        <div className="hidden md:flex flex-1 min-h-0">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
          />
          <ChatWindow
            conversation={activeConversation}
          />
        </div>

        {/* Mobile view (only show active screen) */}
        <div className="flex md:hidden flex-1 min-h-0">
          {activeId === null ? (
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={setActiveId}
            />
          ) : (
            <ChatWindow
              conversation={activeConversation}
              onBack={() => setActiveId(null)}
            />
          )}
        </div>

      </div>
    </div>
  );
}
