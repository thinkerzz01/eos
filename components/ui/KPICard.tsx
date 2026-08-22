'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  badgeText?: string;
  badgeType?: 'danger' | 'warning' | 'success' | 'info';
  onClick?: () => void;
  clickable?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeType = 'info',
  onClick,
  clickable = false,
}: KPICardProps) {
  const badgeColors = {
    danger: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    info: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20',
  };

  return (
    <div
      onClick={onClick}
      className={`p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm dark:shadow-none transition-all duration-200 ${
        clickable || onClick
          ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]'
          : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </span>
        {Icon && (
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-medium text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </span>
        {badgeText && (
          <span
            className={`text-xs font-medium px-2 py-0.5 border rounded-full ${badgeColors[badgeType]}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}
