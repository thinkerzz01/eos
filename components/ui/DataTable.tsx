'use client';

import React, { useState } from 'react';
import { Search, Filter, Inbox, Download, Upload } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface FilterChip {
  id: string;
  label: string;
  value: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  filterChips?: FilterChip[];
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  onExportCSV?: () => void;
  onImportCSV?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Search records...',
  filterChips,
  activeFilter,
  onFilterChange,
  onExportCSV,
  onImportCSV,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria at this time.',
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row as Record<string, any>).some((val) =>
      String(val ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
      {/* Controls Bar with Compact Search & CSV Buttons */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
        {/* Status Chips */}
        {filterChips && filterChips.length > 0 ? (
          <div className="flex items-center gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => onFilterChange?.(chip.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === chip.id
                    ? 'bg-[#5B47D6] text-white shadow-sm shadow-[#5B47D6]/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : <div />}

        {/* Right Controls: Import, Export, Compact Search */}
        <div className="flex items-center gap-3">
          {onImportCSV && (
            <button
              onClick={onImportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}

          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          {/* Compact Search Bar */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium pl-9 pr-3.5 py-2 rounded-xl focus:outline-none focus:border-[#5B47D6] placeholder:text-slate-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table Content with Uniform High-Legibility Typography */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm font-medium text-slate-800 dark:text-slate-200">
          <thead className="bg-slate-100/80 dark:bg-slate-950/80 text-xs uppercase font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-800/80 tracking-wider">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-5 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-5 py-4 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? '')
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800/80 rounded-full flex items-center justify-center text-slate-400 mb-3">
                      <Inbox className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-medium text-slate-800 dark:text-slate-200 mb-1">
                      {emptyTitle}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      {emptyDescription}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
