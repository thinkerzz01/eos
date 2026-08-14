'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ui/ThemeContext';
import { useRole } from '@/components/ui/RoleContext';
import { createClient } from '@/lib/supabase/client';
import {
  Search,
  Sun,
  Moon,
  Plus,
  Bell,
  ChevronDown,
  ShieldCheck,
  Command,
  Menu,
  UserPlus,
  Calendar,
  Receipt,
  Megaphone,
  BookOpen,
  DollarSign,
  FileText,
  User,
  Shield,
  LogOut,
} from 'lucide-react';

interface TopBarProps {
  onMobileMenuToggle?: () => void;
  onQuickAdd?: (actionType: string) => void;
}

export function TopBar({ onMobileMenuToggle, onQuickAdd }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { role } = useRole();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const displayName = role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : role === 'teacher' ? 'Teacher' : 'Student';

  return (
    <header className="h-[70px] bg-white dark:bg-[#0F172A] border-b border-[#EBEDF3] dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 transition-colors duration-200">
      {/* Left: Mobile Menu Toggle & Greeting */}
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="p-2 text-slate-600 dark:text-slate-300 lg:hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h1 className="font-heading font-extrabold text-slate-900 dark:text-white text-lg sm:text-xl flex items-center gap-1.5 leading-tight">
            <span>Welcome back, {displayName}!</span>
            <span>👋</span>
          </h1>
          <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium hidden sm:block">
            Here's what's happening at Thinkerzz today.
          </p>
        </div>
      </div>

      {/* Right Controls: Search, Quick Action, Bell, Theme, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Global Search Bar */}
        <div className="relative hidden xl:block w-72">
          <Search className="w-4 h-4 text-[#9AA0B4] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search students, teachers, leads, invoices…"
            className="w-full bg-[#F6F7FB] dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-xl pl-9 pr-12 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-[#9AA0B4] focus:outline-none focus:border-[#5B47D6]"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#9AA0B4] bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>

        {/* Top Quick Action Button - create actions are admin/manager only */}
        {(role === 'admin' || role === 'manager') && (
        <div className="relative">
          <button
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            className="h-[38px] px-3.5 sm:px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-[#5B47D6]/20 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Quick Action</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {showQuickMenu && (
            <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#0F172A] border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs font-semibold space-y-0.5 max-h-[420px] overflow-y-auto">
              <button
                onClick={() => {
                  onQuickAdd?.('student');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <UserPlus className="w-4 h-4 text-[#5B47D6]" />
                <span>+ New Student</span>
              </button>
              <button
                onClick={() => {
                  router.push('/leads');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>+ New Lead</span>
              </button>
              <button
                onClick={() => {
                  router.push('/demos?new=1');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>+ Book Demo</span>
              </button>
              <button
                onClick={() => {
                  router.push('/schedule');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>+ Schedule Class</span>
              </button>
              <button
                onClick={() => {
                  router.push('/vouchers');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <Receipt className="w-4 h-4 text-purple-600" />
                <span>+ Create Voucher</span>
              </button>
              <button
                onClick={() => {
                  router.push('/vouchers');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>+ Record Payment</span>
              </button>
              <button
                onClick={() => {
                  router.push('/homework');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>+ Assign Homework</span>
              </button>
              <button
                onClick={() => {
                  router.push('/announcements');
                  setShowQuickMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2.5"
              >
                <Megaphone className="w-4 h-4 text-[#5B47D6]" />
                <span>+ Post Announcement</span>
              </button>
            </div>
          )}
        </div>
        )}

        {/* Notification Bell */}
        <button
          title="Notifications"
          className="relative w-9.5 h-9.5 rounded-xl border border-[#EBEDF3] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <Bell className="w-4.5 h-4.5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="w-9.5 h-9.5 rounded-xl border border-[#EBEDF3] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          {theme === 'light' ? (
            <Moon className="w-4.5 h-4.5 text-slate-700" />
          ) : (
            <Sun className="w-4.5 h-4.5 text-amber-400" />
          )}
        </button>

        {/* Profile (SIMPLE "Admin" NAME WITH ICON - NO "SUPER ADMIN") */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-[#EBEDF3] dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <User className="w-4 h-4" />
            </div>
            <div className="text-left hidden sm:block pr-1">
              <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <span>{displayName}</span>
                <Shield className="w-3 h-3 text-[#5B47D6]" />
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0F172A] border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-xs">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5B47D6]" />
                  <span>{displayName}</span>
                </div>
              </div>

              <div className="px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5B47D6]" />
                <span>Role: <span className="capitalize text-slate-800 dark:text-slate-200">{role}</span></span>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
