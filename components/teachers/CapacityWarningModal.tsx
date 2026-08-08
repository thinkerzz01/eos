'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface CapacityWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  currentLoad: number;
  capacity: number;
  onConfirm: () => void;
}

export function CapacityWarningModal({
  isOpen,
  onClose,
  teacherName,
  currentLoad,
  capacity,
  onConfirm,
}: CapacityWarningModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Capacity Soft-Warning"
      maxWidth="md"
      footerButtons={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Assign Anyway (Audit Override)</span>
          </button>
        </>
      }
    >
      <div className="space-y-4 text-center p-2">
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <h4 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
            Teacher is at Capacity ({currentLoad} / {capacity})
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            <strong className="text-slate-800 dark:text-slate-200">{teacherName}</strong> has reached their assigned capacity of {capacity} active students. Capacity is a soft warning, not a hard block.
          </p>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-mono text-amber-700 dark:text-amber-300">
          Overriding capacity will be recorded in the append-only <strong>audit_log</strong> table.
        </div>
      </div>
    </Modal>
  );
}
