'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, MessageSquare, CheckCircle, Clock, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notification';
import { Notification } from '@/types';
import { useRouter } from 'next/navigation';

interface NotificationCenterProps {
  notifications: Notification[];
  workspaceId: string;
}

export default function NotificationCenter({
  notifications,
  workspaceId,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    setLoadingId(id);
    const result = await markNotificationRead(id);
    setLoadingId(null);
    if (!result?.error) {
      router.refresh();
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    const result = await markAllNotificationsRead(workspaceId);
    setMarkingAll(false);
    if (!result?.error) {
      router.refresh();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'email_replied':
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'campaign_finished':
        return <CheckCircle className="h-4 w-4 text-[#2D6BFF]" />;
      case 'followup_pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'delivery_failed':
        return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      default:
        return <Bell className="h-4 w-4 text-[#475569]" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#002B6A] hover:text-[#2D6BFF] bg-[#EAF2FF] border border-[#D8E0EA] rounded-lg transition-all focus:outline-none"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2D6BFF] text-[9px] font-bold text-white shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#D8E0EA] z-[100] p-1">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#D8E0EA] mb-1">
            <span className="text-xs font-bold text-[#002B6A]">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-[10px] text-[#2D6BFF] hover:text-[#002B6A] font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                ) : (
                  'Mark all as read'
                )}
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#475569]">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 p-2.5 rounded-lg transition-all relative group ${
                    n.read ? 'opacity-65 hover:opacity-85' : 'bg-[#EAF2FF]/50'
                  }`}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className={`text-xs font-bold text-[#061A40]`}>
                      {n.title}
                    </p>
                    <p className="text-[10px] text-[#475569] leading-normal mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-[#475569]/80 mt-1">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={loadingId !== null}
                      className="absolute right-2.5 top-2.5 p-1 text-[#475569] hover:text-[#2D6BFF] bg-white border border-[#D8E0EA] rounded transition-all disabled:opacity-50"
                      title="Mark as read"
                    >
                      {loadingId === n.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
