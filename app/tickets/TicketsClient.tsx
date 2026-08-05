'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { SupportTicket } from '@/lib/mockSupportData';
import { replyToTicket, resolveTicket } from './actions';
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  X,
  Send,
  User,
  ShieldCheck,
} from 'lucide-react';

export function TicketsClient({ initialTickets }: { initialTickets: SupportTicket[] }) {
  const { role } = useRole();
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(initialTickets[0] ?? null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Keep the list + selected ticket in sync when the server refetches after a write.
  useEffect(() => {
    setTickets(initialTickets);
    setSelectedTicket((prev) =>
      prev ? initialTickets.find((t) => t.id === prev.id) ?? initialTickets[0] ?? null : initialTickets[0] ?? null
    );
  }, [initialTickets]);

  const handleSendReply = async () => {
    if (!replyText || !selectedTicket) return;
    setSending(true);
    const res = await replyToTicket({ ticketId: selectedTicket.id, message: replyText });
    setSending(false);

    if (res.ok) {
      setReplyText('');
      router.refresh();
      alert('Reply sent. Ticket moved to In Progress.');
    } else {
      alert(res.error ?? 'Failed to send reply.');
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;
    setResolving(true);
    const res = await resolveTicket({ ticketId: selectedTicket.id });
    setResolving(false);
    if (res.ok) {
      router.refresh();
      alert('Ticket marked as resolved.');
    } else {
      alert(res.error ?? 'Failed to resolve ticket.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Support Desk & Parent/Student Tickets</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              1-Hour SLA Response Target (7 AM - 11 PM PKT window). Past-target tickets automatically flag red.
            </p>
          </div>

          <Link
            href="/announcements"
            className="h-[38px] px-3.5 bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#5B47D6]" />
            <span>Announcements →</span>
          </Link>
        </div>

        {/* 1-HOUR SLA POLICY BANNER */}
        <div className="p-4 bg-gradient-to-r from-rose-900 to-[#1B1E38] text-white rounded-[20px] shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-heading font-extrabold text-xs text-rose-300 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-rose-400" />
              <span>Locked Policy: 1-Hour SLA Target (AGENTS.md §4)</span>
            </div>
            <p className="text-xs text-rose-100 leading-relaxed">
              Ticket reply is a <strong>1-hour target (not a guarantee)</strong> across 7:00 AM to 11:00 PM PKT. Tickets exceeding 60 minutes without response automatically flag <strong>RED</strong>.
            </p>
          </div>
          <span className="px-3 py-1 bg-rose-600 text-white font-extrabold text-xs rounded-full shrink-0">
            {tickets.filter((t) => t.isPastTarget).length} Past Target Flagged Red
          </span>
        </div>

        {/* TICKETS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* TICKETS LIST (5 COLS) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm p-4 space-y-3">
            <div className="font-heading font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider border-b pb-2">
              Support Tickets Queue
            </div>

            <div className="space-y-2.5">
              {tickets.map((tkt) => (
                <div
                  key={tkt.id}
                  onClick={() => setSelectedTicket(tkt)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedTicket?.id === tkt.id
                      ? 'border-[#5B47D6] bg-purple-50/70 shadow-xs'
                      : tkt.isPastTarget
                      ? 'border-rose-300 bg-rose-50/60'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{tkt.subject}</div>
                      <div className="text-xs text-[#6B7185] font-medium mt-0.5">{tkt.submittedBy}</div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                        tkt.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {tkt.priority}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-slate-100 font-bold">
                    <span className="font-mono text-slate-500">{tkt.ticketNo}</span>
                    {tkt.isPastTarget ? (
                      <span className="text-rose-600 bg-rose-100 px-2 py-0.5 rounded font-extrabold animate-pulse">
                        🚨 SLA Overdue ({tkt.elapsedMinutes}m)
                      </span>
                    ) : (
                      <span className="text-emerald-600">Within SLA Target</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TICKET CONVERSATION DRAWER (7 COLS) */}
          {selectedTicket && (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm p-6 space-y-5">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-xl text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                    {selectedTicket.isPastTarget && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-600 text-white">
                        🔴 SLA Target Missed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7185] font-medium mt-0.5">
                    Ticket No: <span className="font-mono font-bold text-slate-800">{selectedTicket.ticketNo}</span> · Submitted by {selectedTicket.submittedBy}
                  </p>
                </div>
              </div>

              {/* MESSAGES THREAD */}
              <div className="space-y-3 text-xs font-medium max-h-64 overflow-y-auto p-3 bg-slate-50 rounded-2xl border">
                <div className="p-3 bg-white border rounded-xl space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-900">{selectedTicket.submittedBy}</span>
                    <span className="text-slate-400 font-mono text-[10.5px]">{selectedTicket.createdAt}</span>
                  </div>
                  <p className="text-slate-700">{selectedTicket.subject}</p>
                </div>
              </div>

              {/* REPLY COMPOSER */}
              <div className="space-y-2 pt-2 border-t">
                <label className="font-extrabold text-xs text-slate-900 uppercase">Write Staff Response</label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type official academy response..."
                  className="w-full bg-slate-50 border rounded-2xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                />
                <div className="flex justify-end gap-2 pt-1">
                  {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' && (
                    <button
                      onClick={handleResolve}
                      disabled={resolving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>{resolving ? 'Resolving...' : 'Mark Resolved'}</span>
                    </button>
                  )}
                  <button
                    onClick={handleSendReply}
                    disabled={sending}
                    className="px-4 py-2 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sending ? 'Sending...' : 'Send Staff Response'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </PortalLayout>
  );
}
