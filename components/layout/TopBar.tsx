'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ui/ThemeContext';
import { useRole } from '@/components/ui/RoleContext';
import { createClient } from '@/lib/supabase/client';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, type MyNotification } from '@/app/notifications/actions';
import { globalSearch, type SearchResults } from '@/app/search/actions';
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
  X,
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

  // In-app notifications (the bell). Polled lightly so the badge stays fresh.
  const [notifs, setNotifs] = useState<MyNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  const refreshNotifs = useCallback(async () => {
    try {
      const res = await listMyNotifications();
      setNotifs(res.items);
      setUnread(res.unread);
    } catch {
      /* ignore - bell just stays empty */
    }
  }, []);

  useEffect(() => {
    refreshNotifs();
    const t = setInterval(refreshNotifs, 60000);
    return () => clearInterval(t);
  }, [refreshNotifs]);

  const openNotif = async (n: MyNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setUnread((u) => Math.max(0, u - 1));
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setShowNotifs(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setUnread(0);
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // Global search (debounced) - admin/manager/teacher only.
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const canSearch = role === 'admin' || role === 'manager' || role === 'teacher';

  useEffect(() => {
    if (!canSearch || searchQ.trim().length < 2) { setSearchRes(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await globalSearch(searchQ);
        setSearchRes(res);
      } catch {
        setSearchRes(null);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ, canSearch]);

  const searchCount = searchRes ? searchRes.students.length + searchRes.teachers.length + searchRes.leads.length : 0;
  const gotoHit = (link: string) => {
    setShowSearch(false);
    setSearchQ('');
    router.push(link);
  };
  const searchGroups: { label: string; hits: SearchResults['students'] }[] = searchRes
    ? [
        { label: 'Students', hits: searchRes.students },
        { label: 'Teachers', hits: searchRes.teachers },
        { label: 'Leads', hits: searchRes.leads },
      ].filter((g) => g.hits.length > 0)
    : [];

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
        {canSearch && (
          <div className="relative hidden md:block w-56 lg:w-72">
            <Search className="w-4 h-4 text-[#9AA0B4] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search students, teachers, leads…"
              className="w-full bg-[#F6F7FB] dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-[#9AA0B4] focus:outline-none focus:border-[#5B47D6]"
            />
            {searchQ && (
              <button onClick={() => { setSearchQ(''); setSearchRes(null); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {showSearch && searchQ.trim().length >= 2 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0F172A] border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
                  {searching && searchCount === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#6B7185]">Searching…</div>
                  ) : searchCount === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#6B7185]">No matches for “{searchQ}”.</div>
                  ) : (
                    searchGroups.map((g) => (
                      <div key={g.label}>
                        <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#9AA0B4]">{g.label}</div>
                        {g.hits.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => gotoHit(h.link)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{h.label}</span>
                            {h.sub && <span className="block text-[11px] text-[#6B7185] truncate">{h.sub}</span>}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

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
        <div className="relative">
          <button
            onClick={() => { setShowNotifs((s) => !s); if (!showNotifs) refreshNotifs(); }}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            title="Notifications"
            className="relative w-9.5 h-9.5 rounded-xl border border-[#EBEDF3] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <Bell className="w-4.5 h-4.5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 mt-2 w-80 max-w-[92vw] bg-white dark:bg-[#0F172A] border border-[#EBEDF3] dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
                  {unread > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs font-semibold text-[#5B47D6] hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-[#6B7185]">You&apos;re all caught up.</div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openNotif(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex gap-2.5 ${n.read ? '' : 'bg-[#5B47D6]/[0.04]'}`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-[#5B47D6]'}`} />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</span>
                          {n.body && <span className="block text-xs text-[#6B7185] line-clamp-2">{n.body}</span>}
                          <span className="block text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
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
