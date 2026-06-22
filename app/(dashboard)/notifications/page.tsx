import React from 'react';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Notifications</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Stay updated with campaign statuses, customer responses, and email delivery reports.
        </p>
      </div>

      {/* Empty State */}
      <div className="glass-card rounded-2xl border border-zinc-800 p-12 text-center py-32 max-w-xl mx-auto space-y-4">
        <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-550 flex items-center justify-center mx-auto">
          <Bell className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">All caught up</h3>
          <p className="text-xs text-zinc-550 max-w-[280px] mx-auto leading-normal">
            No new notifications in this workspace. In future steps, alerts for campaign completions and cold email replies will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
