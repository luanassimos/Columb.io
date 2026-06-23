'use client';

import React, { useState, startTransition } from 'react';
import Image from 'next/image';
import { signIn, signUp } from '@/app/actions/auth';
import { Mail, Lock, User, Briefcase, Eye, EyeOff, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let result;
      if (activeTab === 'signin') {
        result = await signIn(formData);
      } else {
        result = await signUp(formData);
      }

      if (result && 'error' in result) {
        setError(result.error as string);
        setLoading(false);
      } else if (result && 'success' in result) {
        if ('message' in result) {
          setSuccess(result.message as string);
          setLoading(false);
        } else {
          console.log('LOGIN_SUCCESS');
          console.log('REDIRECT_DASHBOARD');
          router.replace('/dashboard');
        }
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen px-4 bg-[#F7FAFF] relative overflow-hidden">
      {/* Visual background ambient decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#2D6BFF]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#EAF2FF]/40 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Container Box */}
      <div className="w-full max-w-md bg-white border border-[#D8E0EA] p-8 rounded-2xl shadow-lg relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Image
              src="/columb_symbol_navy.svg"
              alt="Columb Logo"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-[#002B6A]">
              Columb
            </span>
          </div>
          <p className="text-xs text-[#475569] text-center">
            Internal outreach platform for automated cold email campaigns
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex border-b border-[#D8E0EA] mb-6 p-0.5 bg-[#EAF2FF] rounded-lg">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'signin'
                ? 'bg-white text-[#002B6A] shadow-sm font-semibold'
                : 'text-[#475569] hover:text-[#002B6A]'
            }`}
            onClick={() => {
              setActiveTab('signin');
              setError(null);
              setSuccess(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === 'signup'
                ? 'bg-white text-[#002B6A] shadow-sm font-semibold'
                : 'text-[#475569] hover:text-[#002B6A]'
            }`}
            onClick={() => {
              setActiveTab('signup');
              setError(null);
              setSuccess(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs leading-relaxed">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-xs leading-relaxed">
              {success}
            </div>
          )}

          {activeTab === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="John Doe"
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2 bg-white/90 border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] focus:border-[#2D6BFF] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5" htmlFor="workspaceName">
                  Workspace Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    id="workspaceName"
                    name="workspaceName"
                    type="text"
                    required
                    placeholder="Coachmetric or Joseph"
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2 bg-white/90 border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] focus:border-[#2D6BFF] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5" htmlFor="timezone">
                  Timezone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-4 w-4 text-zinc-400" />
                  </div>
                  <select
                    id="timezone"
                    name="timezone"
                    defaultValue="America/Sao_Paulo"
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2 bg-white/90 border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] focus:border-[#2D6BFF] transition-all cursor-pointer font-medium"
                  >
                    <option value="America/Sao_Paulo">Brasília (UTC-3) - America/Sao_Paulo</option>
                    <option value="UTC">UTC (GMT) - Coordinated Universal Time</option>
                    <option value="America/New_York">New York (UTC-5) - America/New_York</option>
                    <option value="America/Los_Angeles">Los Angeles (UTC-8) - America/Los_Angeles</option>
                    <option value="Europe/London">London (UTC+0) - Europe/London</option>
                    <option value="Europe/Paris">Paris (UTC+1) - Europe/Paris</option>
                    <option value="Asia/Tokyo">Tokyo (UTC+9) - Asia/Tokyo</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                disabled={loading}
                className="block w-full pl-10 pr-3 py-2 bg-white/90 border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] focus:border-[#2D6BFF] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                disabled={loading}
                className="block w-full pl-10 pr-10 py-2 bg-white/90 border border-[#D8E0EA] rounded-lg text-sm text-[#061A40] placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] focus:border-[#2D6BFF] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-[#002B6A] transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#2D6BFF] to-[#002B6A] hover:from-[#1b58ec] hover:to-[#002152] text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-900/10 focus:outline-none focus:ring-2 focus:ring-[#2D6BFF] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : activeTab === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
