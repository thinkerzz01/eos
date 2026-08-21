'use client';

// A three-dots row-actions menu whose popup is rendered with position:fixed so it
// is NEVER clipped by a table's overflow-x-auto / overflow-hidden container (the
// bug where lower menu items were cut off). It anchors to the trigger button and
// flips upward when there isn't room below.
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
  hidden?: boolean;
}

const TONE: Record<string, string> = {
  default: 'text-slate-700 hover:bg-slate-50',
  primary: 'text-[#5B47D6] hover:bg-purple-50',
  danger: 'text-rose-600 hover:bg-rose-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
  warning: 'text-amber-700 hover:bg-amber-50',
};

export function RowActionsMenu({ actions, ariaLabel = 'More actions', width = 200 }: { actions: RowAction[]; ariaLabel?: string; width?: number }) {
  const visible = actions.filter((a) => !a.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const menuH = popRef.current?.offsetHeight || visible.length * 36 + 12;
    const below = b.bottom + 6;
    const openUp = below + menuH > window.innerHeight && b.top - menuH - 6 > 0;
    const left = Math.min(Math.max(8, b.right - width), window.innerWidth - width - 8);
    setPos({ top: openUp ? b.top - menuH - 6 : below, left });
  };

  useLayoutEffect(() => { if (open) place(); /* eslint-disable-next-line */ }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.row-actions-pop') && !t.closest('.row-actions-btn')) setOpen(false);
    };
    const onScrollResize = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="row-actions-btn w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          ref={popRef}
          className="row-actions-pop fixed z-[100] bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-xl shadow-2xl p-1.5 text-[13px] font-medium"
          style={{ top: pos.top, left: pos.left, width }}
          onClick={(e) => e.stopPropagation()}
        >
          {visible.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={() => { setOpen(false); a.onClick(); }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed ${TONE[a.tone ?? 'default']}`}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
