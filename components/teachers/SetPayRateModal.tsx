'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CreditCard, Lock } from 'lucide-react';
import { setTeacherPayRate } from '@/app/teachers/actions';

interface SetPayRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  teacherName: string;
  currentRate?: number;
}

export function SetPayRateModal({
  isOpen,
  onClose,
  teacherId,
  teacherName,
  currentRate = 0,
}: SetPayRateModalProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [rate, setRate] = useState(currentRate ? currentRate.toString() : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = Number(rate);
    if (!rateNum || rateNum <= 0) {
      showToast('Enter a valid per-class rate.', 'error');
      return;
    }
    setLoading(true);
    const res = await setTeacherPayRate({ teacherId, ratePerClass: rateNum });
    setLoading(false);

    if (res.ok) {
      showToast(`Per-class pay rate for ${teacherName} set to PKR ${rateNum.toLocaleString()} / class.`, 'success');
      router.refresh();
      onClose();
    } else {
      showToast(res.error ?? 'Failed to set pay rate.', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Set Per-Class Pay Rate - ${teacherName}`}
      subtitle="Pay rates are private to the Admin - managers and teachers can never see them."
      maxWidth="md"
      footerButtons={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payRateForm"
            disabled={loading}
            className="px-6 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Pay Rate'}</span>
          </button>
        </>
      }
    >
      <form id="payRateForm" onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div>
          <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">
            Per-Class Pay Rate (PKR / class)
          </label>
          <input
            type="number"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 75000"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6] font-mono font-medium"
          />
        </div>

        <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-2 text-xs text-[#5B47D6] dark:text-purple-300 font-medium">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Pay rates are visible to the Admin only - never to managers, teachers or students.</span>
        </div>
      </form>
    </Modal>
  );
}
