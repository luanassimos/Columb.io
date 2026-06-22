'use client';

import React, { useState, useRef, useEffect } from 'react';
import { switchWorkspace, createWorkspace } from '@/app/actions/workspace';
import { ChevronDown, Plus, Check, Briefcase, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspaceName: string;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  activeWorkspaceName,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Optimistic local state — updates instantly on click,
  // then server props take over after router.refresh() completes.
  const [localActiveId, setLocalActiveId] = useState(activeWorkspaceId);
  const [localActiveName, setLocalActiveName] = useState(activeWorkspaceName);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Sync with server props when they change (e.g. after router.refresh())
  useEffect(() => {
    setLocalActiveId(activeWorkspaceId);
    setLocalActiveName(activeWorkspaceName);
  }, [activeWorkspaceId, activeWorkspaceName]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (ws: Workspace) => {
    if (ws.id === localActiveId) {
      setIsOpen(false);
      return;
    }

    // Optimistic update — change the displayed name immediately
    setLocalActiveId(ws.id);
    setLocalActiveName(ws.name);
    setIsOpen(false);

    setSwitchingId(ws.id);
    const result = await switchWorkspace(ws.id);
    setSwitchingId(null);

    if (result?.error) {
      // Rollback on failure
      setLocalActiveId(activeWorkspaceId);
      setLocalActiveName(activeWorkspaceName);
      console.error('Failed to switch workspace:', result.error);
    } else {
      router.refresh();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setSwitchingId('new');
    const result = await createWorkspace(newWorkspaceName);
    setSwitchingId(null);
    if (!result?.error) {
      const createdName = newWorkspaceName.trim();
      setNewWorkspaceName('');
      setIsCreating(false);
      setIsOpen(false);
      // Optimistically show new workspace as active
      if (result.workspaceId) {
        setLocalActiveId(result.workspaceId);
        setLocalActiveName(createdName);
      }
      router.refresh();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#EAF2FF] border border-[#D8E0EA] hover:bg-[#d8e8ff] rounded-lg text-sm text-[#002B6A] transition-all focus:outline-none"
      >
        <Briefcase className="h-4 w-4 text-[#2D6BFF]" />
        <span className="font-semibold max-w-[120px] truncate">{localActiveName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#002B6A]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#D8E0EA] z-[100] p-1">
          <div className="px-2.5 py-1.5 text-xs text-[#475569] font-semibold border-b border-[#D8E0EA] mb-1">
            Workspaces
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSwitch(ws)}
                disabled={switchingId !== null}
                className="w-full flex items-center justify-between px-2.5 py-2 text-sm text-left rounded-lg text-[#061A40] hover:text-[#002B6A] hover:bg-[#EAF2FF] transition-all disabled:opacity-50"
              >
                <span className="truncate">{ws.name}</span>
                {ws.id === localActiveId ? (
                  <Check className="h-4 w-4 text-[#2D6BFF] shrink-0" />
                ) : (
                  switchingId === ws.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-[#D8E0EA] mt-1.5 pt-1.5 p-1">
            {!isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-[#2D6BFF] hover:text-[#002B6A] hover:bg-[#EAF2FF] rounded-md transition-all text-left"
              >
                <Plus className="h-3.5 w-3.5" />
                New Workspace
              </button>
            ) : (
              <form onSubmit={handleCreate} className="space-y-1.5 p-1">
                <input
                  type="text"
                  required
                  placeholder="Workspace Name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  disabled={switchingId === 'new'}
                  className="w-full px-2 py-1 bg-white border border-[#D8E0EA] rounded text-xs text-[#061A40] placeholder-zinc-400 focus:outline-none focus:border-[#2D6BFF]"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    type="submit"
                    disabled={switchingId === 'new'}
                    className="flex-1 py-1 bg-[#2D6BFF] hover:bg-[#1b58ec] text-white rounded text-[10px] font-bold transition-all disabled:opacity-50"
                  >
                    {switchingId === 'new' ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-1 bg-[#EAF2FF] hover:bg-[#d8e8ff] text-[#002B6A] rounded text-[10px] font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
