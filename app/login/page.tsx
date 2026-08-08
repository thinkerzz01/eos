'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/components/ui/ThemeContext';
import {
  KeyRound,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email address and password.', 'error');
      return;
    }

    setLoading(true);

    try {
      // Sign-in only. Accounts are provisioned by an Admin (see supabase/seed_admin.sql),
      // never created as a side effect of a failed login.
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showToast(error.message || 'Invalid email or password.', 'error');
      } else if (data.user) {
        showToast('Signed in successfully! Redirecting...', 'success');
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      showToast('An unexpected authentication error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-200">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/20 via-sky-500/10 to-transparent blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs font-semibold"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Brand Logo Badge */}
        <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl tracking-widest shadow-xl shadow-indigo-500/30 mb-4 transition-transform hover:scale-105">
          TZ
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Thinkerzz EOS
        </h1>
        <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Academy Operating System & Portal Suite
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 py-8 px-6 shadow-2xl shadow-slate-200/60 dark:shadow-none rounded-3xl sm:px-10 space-y-6">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thinkerzz.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Role Access Information */}
          <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Multi-Role Access Control</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Admin:</span> Full Control
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                <span className="text-sky-600 dark:text-sky-400 font-bold">Manager:</span> Ops Only
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Teacher:</span> Own Classes
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                <span className="text-purple-600 dark:text-purple-400 font-bold">Student:</span> Parent Login
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          Question · Think · Achieve · Thinkerzz EOS v3.1
        </p>
      </div>
    </div>
  );
}
