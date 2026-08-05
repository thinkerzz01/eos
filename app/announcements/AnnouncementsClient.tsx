'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { AcademyAnnouncement } from '@/lib/mockSupportData';
import { createAnnouncement } from './actions';
import {
  MessageSquare,
  Plus,
  Pin,
  Users,
  Search,
  Filter,
  X,
  Send,
  CheckCircle2,
} from 'lucide-react';

export function AnnouncementsClient({ initialAnnouncements }: { initialAnnouncements: AcademyAnnouncement[] }) {
  const { role } = useRole();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>(initialAnnouncements);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<'All' | 'Students' | 'Teachers' | 'Parents'>('All');
  const [posting, setPosting] = useState(false);

  // Keep the list in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setAnnouncements(initialAnnouncements); }, [initialAnnouncements]);

  const handleCreateAnnouncement = async () => {
    if (!title || !content) {
      alert('Title and body are required.');
      return;
    }
    setPosting(true);
    const res = await createAnnouncement({ title, content });
    setPosting(false);

    if (res.ok) {
      setShowAddModal(false);
      setTitle('');
      setContent('');
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to post announcement.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Academy Announcements & Broadcasts</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Broadcast system-wide notices to Students, Parents, and Faculty.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Announcement</span>
          </button>
        </div>

        {/* ANNOUNCEMENTS FEED */}
        <div className="space-y-3">
          {announcements.map((anc) => (
            <div
              key={anc.id}
              className={`p-5 rounded-2xl border transition-all ${
                anc.isPinned ? 'bg-purple-50/60 border-purple-300 shadow-xs' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {anc.isPinned && <Pin className="w-4 h-4 text-[#5B47D6] fill-[#5B47D6]" />}
                  <h3 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">{anc.title}</h3>
                </div>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full">
                  Audience: {anc.targetAudience}
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 leading-relaxed">
                {anc.content}
              </p>

              <div className="flex justify-between items-center text-[11px] text-[#6B7185] font-medium pt-3 mt-3 border-t border-slate-100">
                <span>Published by <strong>{anc.authorName}</strong></span>
                <span>{anc.publishedDate}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ADD ANNOUNCEMENT MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">+ Create Announcement</h3>
                <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700 block mb-1">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Exam Schedule Release" className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Target Audience</label>
                  <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as any)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900">
                    <option value="All">All Academy Users</option>
                    <option value="Students">Students Only</option>
                    <option value="Teachers">Faculty / Teachers Only</option>
                    <option value="Parents">Parents Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Notice Body</label>
                  <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Enter announcement body..." className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleCreateAnnouncement} disabled={posting} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">{posting ? 'Publishing...' : 'Publish Notice'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
