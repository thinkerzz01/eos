'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { PaymentTransaction } from '@/lib/mockFinanceData';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { updatePayment, deletePayment } from './actions';
import { downloadCsv } from '@/lib/export/csv';
import {
  Receipt,
  Search,
  Lock,
  Eye,
  MessageSquare,
  Edit3,
  Trash2,
  X,
  FileText,
} from 'lucide-react';

// wa.me digits (0300... -> 92300...)
function waDigits(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  if (d.startsWith('3')) return '92' + d;
  return d;
}
function humanDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric' });
}

export function PaymentsClient({ initialPayments }: { initialPayments: PaymentTransaction[] }) {
  const { role } = useRole();
  const router = useRouter();
  const [payments] = useState<PaymentTransaction[]>(initialPayments);
  const [receipt, setReceipt] = useState<PaymentTransaction | null>(null);

  // EDIT / DELETE receipt
  const [editRcpt, setEditRcpt] = useState<PaymentTransaction | null>(null);
  const [edAmount, setEdAmount] = useState('');
  const [edMethod, setEdMethod] = useState('Bank Transfer');
  const [edRef, setEdRef] = useState('');
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState<string | null>(null);
  const openEdit = (p: PaymentTransaction) => {
    setEditRcpt(p);
    setEdAmount(String(Math.abs(p.amount)));
    setEdMethod(p.paymentMethod);
    setEdRef(p.reason ?? '');
    setEdError(null);
  };
  const handleUpdate = async () => {
    if (!editRcpt) return;
    setEdError(null);
    const amt = parseFloat(edAmount);
    if (Number.isNaN(amt) || amt <= 0) { setEdError('Enter a valid amount.'); return; }
    setEdSaving(true);
    // Preserve the sign (refunds are negative).
    const signed = editRcpt.amount < 0 ? -Math.abs(amt) : Math.abs(amt);
    const res = await updatePayment({ paymentId: editRcpt.id, amount: signed, method: edMethod, reference: edRef });
    setEdSaving(false);
    if (res.ok) { setEditRcpt(null); router.refresh(); }
    else setEdError(res.error ?? 'Failed to update the receipt.');
  };
  const handleDelete = async (p: PaymentTransaction) => {
    if (!confirm(`Delete receipt ${p.receiptNo} for ${p.studentName}? The linked voucher's paid total will drop accordingly.`)) return;
    const res = await deletePayment(p.id);
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Failed to delete the receipt.');
  };

  // FILTERS
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('All Methods');
  const [dateRange, setDateRange] = useState<'all' | '7' | '30' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (method !== 'All Methods' && p.paymentMethod !== method) return false;
      if (dateRange !== 'all' && p.paymentDate) {
        const t = new Date(p.paymentDate).getTime();
        if (!Number.isNaN(t)) {
          const now = Date.now();
          if (dateRange === '7' && t < now - 7 * 864e5) return false;
          if (dateRange === '30' && t < now - 30 * 864e5) return false;
          if (dateRange === 'custom') {
            if (fromDate && t < new Date(`${fromDate}T00:00:00`).getTime()) return false;
            if (toDate && t > new Date(`${toDate}T23:59:59`).getTime()) return false;
          }
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.studentName.toLowerCase().includes(q) && !p.receiptNo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [payments, method, dateRange, fromDate, toDate, search]);

  // BULK SELECTION STATE (export-only; this is an append-only audit trail)
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const toggleSelectAllReceipts = () => {
    if (selectedReceiptIds.length === filtered.length && filtered.length > 0) setSelectedReceiptIds([]);
    else setSelectedReceiptIds(filtered.map((p) => p.id));
  };
  const toggleSelectReceipt = (id: string) => {
    setSelectedReceiptIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const handleBulkExportReceipts = () => {
    const rows = payments.filter((p) => selectedReceiptIds.includes(p.id));
    downloadCsv(
      'Thinkerzz_Receipts',
      ['Receipt No', 'Student', 'Phone', 'Amount (PKR)', 'Type', 'Method', 'Date', 'Reason', 'Audited By'],
      rows.map((p) => [p.receiptNo, p.studentName, p.studentPhone ?? '', p.amount, p.type, p.paymentMethod, p.paymentDate, p.reason ?? '', p.auditedBy])
    );
  };

  const sendReceiptWa = (p: PaymentTransaction) => {
    const text = [
      `*Thinkerzz - Payment Receipt*`,
      ``,
      `Receipt: ${p.receiptNo}`,
      `Student: ${p.studentName}`,
      `Date: ${humanDate(p.paymentDate)}`,
      `Method: ${p.paymentMethod}`,
      `Amount: ${p.amount < 0 ? `-PKR ${Math.abs(p.amount).toLocaleString()}` : `PKR ${p.amount.toLocaleString()}`}`,
      ``,
      `Thank you!`,
    ].join('\n');
    const phone = waDigits(p.studentPhone ?? '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const boxCls = 'bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs';
  const selCls = 'bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-[13px]';

  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><Lock className="w-7 h-7" /></div>
          <h2 className="font-heading font-medium text-xl text-slate-900">Access restricted</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">Receipts and finance records are visible to the Admin only. Please contact the academy owner if you need access.</p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12 text-sm">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Receipts</span>
            </h1>
            <p className="text-[13px] text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Every payment and refund, kept as a permanent audit trail (never edited or deleted).
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'Thinkerzz_Receipts',
                  ['Receipt No', 'Student', 'Phone', 'Amount (PKR)', 'Type', 'Method', 'Date', 'Reason', 'Audited By'],
                  filtered.map((p) => [
                    p.receiptNo, p.studentName, p.studentPhone ?? '', p.amount, p.type, p.paymentMethod,
                    p.paymentDate, p.reason ?? '', p.auditedBy,
                  ])
                )
              }
              title="Export the current view to CSV"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>
            <Link href="/vouchers" className="h-[38px] px-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
              <Receipt className="w-3.5 h-3.5" />
              <span>Manage Vouchers →</span>
            </Link>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px]">
          <div className="relative w-full sm:w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or receipt no..." className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[13px] font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]" />
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={selCls}>
              <option>All Methods</option>
              {['Bank Transfer', 'Cash', 'JazzCash', 'Easypaisa', 'Cheque'].map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div className={boxCls}>
            <span className="text-[11px] text-[#6B7185] block font-medium">Date</span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className={selCls}>
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 text-[13px]">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
              <span className="text-[#6B7185]">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2 py-1.5 font-medium text-slate-800 dark:text-slate-100" />
            </div>
          )}
        </div>

        {/* BULK ACTION BAR — export only (append-only audit trail) */}
        {selectedReceiptIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-[#EEEBFB] dark:bg-[#5B47D6]/15 border border-[#5B47D6]/30 rounded-[14px] px-4 py-2.5 text-sm">
            <span className="font-medium text-[#5B47D6] dark:text-[#b9adf2]">
              {selectedReceiptIds.length} selected
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>

            <button
              onClick={handleBulkExportReceipts}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
            </button>

            <button
              onClick={() => setSelectedReceiptIds([])}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* RECEIPTS TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3 w-[40px] text-center">
                    <input
                      type="checkbox"
                      checked={selectedReceiptIds.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAllReceipts}
                      className="rounded accent-[#5B47D6] cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3">Receipt No & Student</th>
                  <th className="py-3.5 px-3">Date & Method</th>
                  <th className="py-3.5 px-3">Type</th>
                  <th className="py-3.5 px-3">Amount</th>
                  <th className="py-3.5 px-3">Note</th>
                  <th className="py-3.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px] font-medium">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[#6B7185]">No receipts match these filters.</td></tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedReceiptIds.includes(p.id)}
                          onChange={() => toggleSelectReceipt(p.id)}
                          className="rounded accent-[#5B47D6]"
                        />
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{p.studentName}</div>
                        <div className="text-xs text-[#6B7185] font-mono">{p.receiptNo}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{humanDate(p.paymentDate)}</div>
                        <div className="text-xs text-[#6B7185]">{p.paymentMethod}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge tone={p.type === 'Refund' ? 'danger' : p.type === 'Partial Payment' ? 'warning' : 'success'}>{p.type}</Badge>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-medium">
                        <span className={p.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {p.amount < 0 ? `-PKR ${Math.abs(p.amount).toLocaleString()}` : `+PKR ${p.amount.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[#6B7185]">{p.reason || (p.type === 'Refund' ? 'Refund' : 'Fee receipt')}</td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-center">
                          <RowActionsMenu
                            actions={[
                              { label: 'Preview', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => setReceipt(p) },
                              { label: 'Send on WhatsApp', icon: <MessageSquare className="w-3.5 h-3.5" />, tone: 'success', disabled: !p.studentPhone, onClick: () => sendReceiptWa(p) },
                              { label: 'Edit', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => openEdit(p) },
                              { label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDelete(p) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t text-[13px] font-medium text-slate-600">Showing {filtered.length} of {payments.length} receipts</div>
        </div>
      </div>

      {/* EDIT RECEIPT MODAL */}
      {editRcpt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setEditRcpt(null)}>
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-heading font-medium text-slate-900 dark:text-white text-base">Edit Receipt - {editRcpt.receiptNo}</h3>
              <button onClick={() => setEditRcpt(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Amount (PKR){editRcpt.amount < 0 ? ' - refund' : ''}</label>
                <input type="number" value={edAmount} onChange={(e) => setEdAmount(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 font-mono font-medium text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Method</label>
                <select value={edMethod} onChange={(e) => setEdMethod(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                  {['Bank Transfer', 'Cash', 'JazzCash', 'Easypaisa', 'Cheque'].map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1">Reference / Note (optional)</label>
                <input type="text" value={edRef} onChange={(e) => setEdRef(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
              </div>
              {edError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl"><span>{edError}</span></div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setEditRcpt(null)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
              <button onClick={handleUpdate} disabled={edSaving} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md disabled:opacity-50">{edSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW / PRINT */}
      {receipt && (
        <>
          <style>{`
            @media print {
              @page { margin: 0; }
              html, body { background: #ffffff !important; }
              body * { visibility: hidden !important; }
              #receipt-print-area, #receipt-print-area * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; padding: 32px !important; }
              #receipt-print-area .no-print { display: none !important; }
            }
          `}</style>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setReceipt(null)}>
            <div id="receipt-print-area" className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 space-y-4 text-slate-900 text-[14px]">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                  <div className="w-11 h-11 rounded-xl bg-[#5B47D6] text-white flex items-center justify-center font-medium text-lg">T</div>
                  <div>
                    <div className="font-medium text-lg leading-tight">Thinkerzz</div>
                    <div className="text-xs text-slate-500 font-semibold">Payment Receipt</div>
                  </div>
                  <div className="ml-auto font-mono font-medium text-sm">{receipt.receiptNo}</div>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[14px] font-semibold">
                  <div className="text-slate-500">Student</div><div className="text-right">{receipt.studentName}</div>
                  <div className="text-slate-500">Date</div><div className="text-right">{humanDate(receipt.paymentDate)}</div>
                  <div className="text-slate-500">Method</div><div className="text-right">{receipt.paymentMethod}</div>
                  <div className="text-slate-500">Type</div><div className="text-right">{receipt.type}</div>
                  <div className="text-slate-500">Amount</div>
                  <div className={`text-right font-mono font-medium ${receipt.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {receipt.amount < 0 ? `-PKR ${Math.abs(receipt.amount).toLocaleString()}` : `PKR ${receipt.amount.toLocaleString()}`}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50 no-print">
                <button onClick={() => sendReceiptWa(receipt)} disabled={!receipt.studentPhone} className="flex-1 px-3 py-2 bg-[#12A150] hover:bg-[#0f8a44] disabled:opacity-40 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5"><MessageSquare className="w-4 h-4" /> Send on WhatsApp</button>
                <button onClick={() => window.print()} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl">Print</button>
                <button onClick={() => setReceipt(null)} className="px-3 py-2 border border-slate-300 font-medium text-xs rounded-xl">Close</button>
              </div>
            </div>
          </div>
        </>
      )}
    </PortalLayout>
  );
}
