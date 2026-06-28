'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import {
  LayoutDashboard,
  Users,
  Mail,
  Send,
  Inbox,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Target,
  Building,
  Briefcase,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface SidebarProps {
  profileName: string;
  userEmail: string;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ profileName, userEmail, mobileOpen, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const [isCaptarLeadsOpen, setIsCaptarLeadsOpen] = useState(pathname.startsWith('/lead-finder'));

  const mainNavItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Inbox', icon: Inbox, href: '/inbox' },
    {
      label: 'Captar Leads',
      icon: Target,
      href: '/lead-finder',
      isDropdown: true,
      subItems: [
        { label: 'Empresas', icon: Building, href: '/lead-finder/companies' },
        { label: 'Profissionais', icon: Briefcase, href: '/lead-finder/professionals' }
      ]
    },
    { label: 'Leads', icon: Users, href: '/contacts' },
    { label: 'Templates', icon: Mail, href: '/templates' },
    { label: 'Campaigns', icon: Calendar, href: '/campaigns' },
    { label: 'Email Blasts', icon: Send, href: '/blasts' },
  ];

  const bottomNavItems = [
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ];

  return (
    <aside
      className={`bg-[#002B6A] m-0 rounded-l-none rounded-r-2xl flex flex-col justify-between h-full shadow-xl shadow-blue-950/10 border-r border-[#061A40]/15 transition-all duration-305 ease-in-out shrink-0 fixed lg:relative inset-y-0 left-0 z-50 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      <div className="flex flex-col justify-between h-full w-full overflow-hidden rounded-r-2xl">
        <div>
          {/* Logo and Brand */}
          <div
            className="h-16 flex items-center border-b border-[#061A40]/30 transition-all duration-300 ease-in-out px-5 justify-between"
          >
            <div className="flex items-center gap-3">
              <Image
                src="/columb_symbol_white.svg"
                alt="Columb Logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain shrink-0"
              />
              <span
                className={`font-bold text-xl text-white tracking-wide transition-all duration-300 ease-in-out origin-left whitespace-nowrap ${
                  isCollapsed ? 'opacity-0 scale-95 w-0 overflow-hidden pointer-events-none' : 'opacity-100 scale-100 w-auto'
                }`}
              >
                Columb
              </span>
            </div>
          </div>

          {/* Main Navigation Links */}
          <nav className="p-4 space-y-1">
            {mainNavItems.map((item: any) => {
              if (item.isDropdown) {
                const isChildActive = pathname.startsWith('/lead-finder');
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsCaptarLeadsOpen(!isCaptarLeadsOpen)}
                      className={`w-full flex items-center rounded-lg font-medium transition-all duration-205 group h-11 px-3.5 justify-between text-left cursor-pointer ${
                        isCollapsed ? 'justify-center' : 'gap-3 text-sm'
                      } ${
                        isChildActive
                          ? 'text-white bg-[#061A40]/30 border-l-2 border-[#2D6BFF]'
                          : 'text-blue-100 hover:text-white hover:bg-[#061A40]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                            isChildActive ? 'text-[#2D6BFF]' : 'text-blue-200 group-hover:text-white'
                          }`}
                        />
                        {!isCollapsed && (
                          <span className="transition-all duration-300 ease-in-out">
                            {item.label}
                          </span>
                        )}
                      </div>
                      {!isCollapsed && (
                        isCaptarLeadsOpen ? (
                          <ChevronUp className="h-4 w-4 text-blue-200" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-blue-200" />
                        )
                      )}
                    </button>

                    {/* Sub Menu Items */}
                    {isCaptarLeadsOpen && !isCollapsed && (
                      <div className="pl-6 space-y-1 border-l border-blue-900/30 ml-5 animate-fade-in">
                        {item.subItems!.map((subItem: any) => {
                          const isSubActive = pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => onClose?.()}
                              className={`flex items-center gap-2 rounded-lg font-medium transition-all duration-205 h-9 px-3 text-xs ${
                                isSubActive
                                  ? 'text-white bg-[#2D6BFF]/20 font-semibold border border-[#2D6BFF]/30'
                                  : 'text-blue-200 hover:text-white hover:bg-[#061A40]/20'
                              }`}
                            >
                              <subItem.icon className={`h-3.5 w-3.5 ${isSubActive ? 'text-[#2D6BFF]' : 'text-blue-300'}`} />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Collapsed view fallback */}
                    {isCollapsed && (
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        {item.subItems!.map((subItem: any) => {
                          const isSubActive = pathname === subItem.href;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              title={subItem.label}
                              onClick={() => onClose?.()}
                              className={`flex items-center justify-center rounded-lg h-8 w-8 transition-all ${
                                isSubActive
                                  ? 'text-white bg-[#2D6BFF] shadow-sm'
                                  : 'text-blue-200 hover:text-white hover:bg-[#061A40]/30'
                              }`}
                            >
                              <subItem.icon className="h-4 w-4" />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onClose?.()}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg font-medium transition-all duration-205 group h-11 px-3.5 ${
                    isCollapsed ? 'justify-center' : 'gap-3 text-sm'
                  } ${
                    isActive
                      ? 'text-white bg-[#061A40]/50 shadow-sm border border-[#061A40]/20'
                      : 'text-blue-100 hover:text-white hover:bg-[#061A40]/30'
                  }`}
                >
                  <item.icon
                    className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-blue-200 group-hover:text-white'
                    }`}
                  />
                  <span
                    className={`transition-all duration-300 ease-in-out origin-left whitespace-nowrap ${
                      isCollapsed ? 'opacity-0 scale-95 w-0 overflow-hidden pointer-events-none' : 'opacity-100 scale-100 w-auto'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          {/* Bottom Navigation Links */}
          <nav className="px-4 pb-3 space-y-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onClose?.()}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg font-medium transition-all duration-205 group h-11 px-3.5 ${
                    isCollapsed ? 'justify-center' : 'gap-3 text-sm'
                  } ${
                    isActive
                      ? 'text-white bg-[#061A40]/50 shadow-sm border border-[#061A40]/20'
                      : 'text-blue-100 hover:text-white hover:bg-[#061A40]/30'
                  }`}
                >
                  <item.icon
                    className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-blue-200 group-hover:text-white'
                    }`}
                  />
                  <span
                    className={`transition-all duration-300 ease-in-out origin-left whitespace-nowrap ${
                      isCollapsed ? 'opacity-0 scale-95 w-0 overflow-hidden pointer-events-none' : 'opacity-100 scale-100 w-auto'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User Info and Logout */}
          <div className="p-4 border-t border-[#061A40]/30 flex flex-col gap-3">
            <div
              className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out origin-left ${
                isCollapsed ? 'opacity-0 h-0 overflow-hidden pointer-events-none' : 'opacity-100 h-10 px-3.5'
              }`}
            >
              <span className="text-xs font-semibold text-white truncate">{profileName}</span>
              <span className="text-[10px] text-blue-200 truncate">{userEmail}</span>
            </div>

            <form action={signOut} className="w-full">
              <button
                type="submit"
                title="Sign Out"
                className={`w-full flex items-center rounded-lg font-medium transition-all duration-200 text-blue-200 hover:text-red-300 hover:bg-red-950/20 h-11 px-3.5 ${
                  isCollapsed ? 'justify-center' : 'gap-3 text-sm'
                }`}
              >
                <LogOut className="h-4.5 w-4.5 shrink-0" />
                <span
                  className={`transition-all duration-300 ease-in-out origin-left whitespace-nowrap ${
                    isCollapsed ? 'opacity-0 scale-95 w-0 overflow-hidden pointer-events-none' : 'opacity-100 scale-100 w-auto'
                  }`}
                >
                  Sign Out
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Border Toggle Button */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden lg:flex absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#002B6A] border border-[#2D6BFF] text-blue-200 hover:text-white hover:bg-[#2D6BFF] flex items-center justify-center shadow-lg transition-all focus:outline-none z-50 cursor-pointer"
        title={isCollapsed ? 'Expandir' : 'Recolher'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  );
}
