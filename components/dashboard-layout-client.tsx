'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './sidebar';
import WorkspaceSwitcher from './workspace-switcher';
import NotificationCenter from './notification-center';
import { User, Menu, Sun, Moon } from 'lucide-react';

interface DashboardLayoutClientProps {
  profile: any;
  userEmail: string;
  workspacesList: any[];
  activeWorkspaceRole: any;
  displayedWorkspace: any;
  notificationsList: any[];
  children: React.ReactNode;
}

export default function DashboardLayoutClient({
  profile,
  userEmail,
  workspacesList,
  activeWorkspaceRole,
  displayedWorkspace,
  notificationsList,
  children,
}: DashboardLayoutClientProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark' ||
                   (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans relative">
      {/* Mobile Sidebar Overlay / Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Collapsible, rounded only on right sidebar */}
      <Sidebar
        profileName={profile?.name || 'Default User'}
        userEmail={userEmail}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Area inside rounded container card */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-0 lg:p-4">
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-card border border-border lg:rounded-2xl shadow-sm">
          {/* Header */}
          <header className="relative z-30 h-16 border-b border-border px-4 lg:px-6 flex items-center justify-between bg-card/85 backdrop-blur-md shrink-0">
            {/* Left side: Hamburger button + Workspace selector */}
            <div className="flex items-center gap-3">
              {/* Hamburger Button (Mobile only) */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="lg:hidden p-2 -ml-2 rounded-xl text-[#002B6A] hover:bg-[#EAF2FF] transition-all cursor-pointer"
                title="Abrir Menu"
              >
                <Menu className="h-5.5 w-5.5" />
              </button>

              <WorkspaceSwitcher
                workspaces={workspacesList}
                activeWorkspaceId={displayedWorkspace.id}
                activeWorkspaceName={displayedWorkspace.name}
                activeWorkspaceRole={activeWorkspaceRole}
              />
            </div>

            {/* Right Header items (Notification icon & Profile menu) */}
            <div className="flex items-center gap-2 lg:gap-4">
              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 rounded-xl text-[#002B6A] hover:bg-[#EAF2FF] transition-all cursor-pointer dark:text-[#e2ecff] dark:hover:bg-[#172a45]"
                title={darkMode ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
              >
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-[#002B6A]" />}
              </button>

              {/* Notification icon */}
              <NotificationCenter
                notifications={notificationsList}
                workspaceId={displayedWorkspace.id}
                role={activeWorkspaceRole}
              />

              {/* Profile menu (Hidden on mobile) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#EAF2FF] border border-[#D8E0EA] rounded-lg text-xs font-semibold text-[#002B6A]">
                <User className="h-3.5 w-3.5 text-[#002B6A]" />
                <span className="max-w-[100px] truncate">{profile?.name || 'Default User'}</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-background/25 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
