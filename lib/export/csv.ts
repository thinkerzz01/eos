// Client-side CSV export. Builds a CSV from headers + rows and triggers a
// browser download. Values are quoted/escaped per RFC 4180 and a UTF-8 BOM is
// prepended so Excel opens Urdu/accented names correctly.
'use client';

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined): string => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}

/** Build a CSV and download it as `<name>_YYYY-MM-DD.csv`. */
export function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  isoDate?: string
): void {
  const stamp = isoDate ?? new Date().toISOString().slice(0, 10);
  const csv = '﻿' + toCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
