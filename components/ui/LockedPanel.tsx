'use client';

import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

interface LockedPanelProps {
  title?: string;
  description?: string;
  requiredRole?: string;
}

export function LockedPanel({
  title = 'Access Restricted',
  description = 'You do not have permission to view this section. Please contact the academy owner if you need access.',
  requiredRole = 'Admin',
}: LockedPanelProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
      <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-rose-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-md text-xs text-slate-300 font-mono">
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span>Requires {requiredRole} privileges</span>
      </div>
    </div>
  );
}
