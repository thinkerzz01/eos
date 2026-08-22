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
  Sun,
  Moon,
  Eye,
  EyeOff,
} from 'lucide-react';

// Role-specific sign-in greeting (Title Case). Students are greeted by first
// name; if the name is missing the line still reads cleanly.
function welcomeMessage(role?: string, name?: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  switch (role) {
    case 'admin':
      return "Welcome Back, Boss. The Academy's All Yours.";
    case 'manager':
      return "Welcome Back. Let's Run The Show.";
    case 'teacher':
      return "Class Is Waiting. Let's Make It Count.";
    case 'student':
      return first
        ? `Good To See You, ${first}. Let's Grow More.`
        : "Good To See You. Let's Grow More.";
    default:
      return 'Signed In. Redirecting You Now.';
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        // Greet by role (students by first name). A failed lookup just falls
        // back to the neutral welcome — never blocks the redirect.
        const { data: profile } = await supabase
          .from('profiles')
          .select('role,name')
          .eq('user_id', data.user.id)
          .is('deleted_at', null)
          .maybeSingle();
        showToast(welcomeMessage((profile as any)?.role, (profile as any)?.name), 'brand');
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      showToast('An unexpected authentication error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      showToast('Enter your email above first, then click "Forgot password".', 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      // Do not reveal whether an account exists (privacy) - always show the same note.
      if (error) showToast(error.message, 'error');
      else showToast('If that email has an account, a reset link is on its way. Check your inbox.', 'success');
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
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-xs font-medium"
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
        {/* Brand Logo (light logo on light bg, white logo on dark bg) */}
        <img src="/logo-light.png" alt="Thinkerzz" className="mx-auto h-11 w-auto object-contain mb-3 dark:hidden" />
        <img src="/logo-dark.png" alt="Thinkerzz" className="mx-auto h-11 w-auto object-contain mb-3 hidden dark:block" />
        <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Operating System & Portal Suite
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 py-8 px-6 shadow-2xl shadow-slate-200/60 dark:shadow-none rounded-3xl sm:px-10 space-y-6">
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
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
                className="block text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={loading}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
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
        </div>

        <p className="mt-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          Question · Think · Achieve
        </p>
      </div>
    </div>
  );
}
