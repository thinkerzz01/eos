'use client';

// VoucherSlip — the premium, printable Thinkerzz fee-voucher document.
// One shared component used by BOTH the admin Vouchers preview and the student
// Fees "View voucher" modal, so the slip is pixel-identical everywhere.
//
// Layout (top → bottom, nothing after "Need Help?"):
//   1. Header      logo (left) · Fee Voucher + voucher no (right)
//   2. Title       "Fee Voucher" + supporting line
//   3. Summary     Amount To Pay (headline) + Due Date + thank-you note
//   4. Student     two-column labelled info grid
//   5. Payment     Bank Transfer + Mobile Wallet cards with copy buttons
//   6. After pay   Send via WhatsApp / Email Receipt
//   7. Need Help   contact row — the final element (no footer/tagline below)
//
// The voucher number is an internal reference: shown only when `showVoucherId`
// is true (admin), hidden on the student's own voucher & printout.

import React, { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import type { PaymentInfo } from '@/lib/config/paymentInfo';
import {
  FileText,
  CreditCard,
  CalendarDays,
  GraduationCap,
  Users,
  BookOpen,
  CalendarRange,
  Hash,
  Database,
  Landmark,
  Smartphone,
  ShieldCheck,
  Copy,
  Check,
  Send,
  MessageCircle,
  Mail,
  Headphones,
  Phone,
  Globe,
  Printer,
  X,
} from 'lucide-react';

export interface VoucherSlipProps {
  voucherNo: string;
  studentName: string;
  parentName?: string;
  program?: string;
  periodLabel?: string;
  amount: number;
  dueDate: string; // 'YYYY-MM-DD' (formatted for display) or any human string
  status: string; // display-ready, e.g. "Due" / "Paid" / "In Grace"
  paymentInfo?: PaymentInfo | null;
  showVoucherId?: boolean; // admin: show the internal voucher number
  onClose: () => void;
  /** Admin only: wa.me link to send the voucher to the parent. */
  sendToStudentHref?: string;
}

// Academy contact — same env convention used across the app (client-safe).
const ACADEMY_WA = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || '923262324477').replace(/\D/g, '');
const ACADEMY_EMAIL = process.env.NEXT_PUBLIC_ACADEMY_EMAIL || 'info@thinkerzz.com';
const ACADEMY_SITE = process.env.NEXT_PUBLIC_ACADEMY_WEBSITE || 'https://thinkerzz.com';

// "923262324477" -> "+92 326 2324477"
function prettyWa(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('92') && d.length >= 12) return `+92 ${d.slice(2, 5)} ${d.slice(5)}`;
  return `+${d}`;
}
// "https://thinkerzz.com" -> "www.thinkerzz.com"
function prettySite(url: string): string {
  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return host.startsWith('www.') ? host : `www.${host}`;
}
// "2026-10-10" -> "10 October 2026" (falls back to the raw string if not a date).
function prettyDate(ymd: string): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const dt = new Date(`${ymd}T00:00:00+05:00`);
  if (Number.isNaN(dt.getTime())) return ymd;
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

function statusChip(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('paid')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (s.includes('stop')) return 'bg-slate-100 text-slate-600 border border-slate-200';
  // Due / In Grace / overdue → amber
  return 'bg-amber-50 text-amber-700 border border-amber-200';
}

const PRINT_CSS = `
@media print {
  @page { margin: 0; }
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  #voucher-slip-print, #voucher-slip-print * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  #voucher-slip-print {
    position: absolute; left: 0; top: 0; width: 100%;
    max-width: 100% !important; max-height: none !important; overflow: visible !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
  }
}`;

export function VoucherSlip(props: VoucherSlipProps) {
  const {
    voucherNo,
    studentName,
    parentName,
    program,
    periodLabel,
    amount,
    dueDate,
    status,
    paymentInfo,
    showVoucherId = false,
    onClose,
    sendToStudentHref,
  } = props;

  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  const CopyBtn = ({ k, value }: { k: string; value: string }) => (
    <button
      type="button"
      onClick={() => copy(k, value)}
      aria-label="Copy to clipboard"
      title="Copy"
      className="print:hidden shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-[#5B47D6] hover:border-[#5B47D6]/40 hover:bg-[#5B47D6]/[0.05] transition-colors"
    >
      {copied === k ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  // A single label / value line inside a payment-method card.
  const PayRow = ({
    label,
    value,
    mono,
    copyKey,
  }: {
    label: string;
    value: string;
    mono?: boolean;
    copyKey?: string;
  }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 border-t border-slate-100 first:border-t-0">
      <dt className="text-[12.5px] text-slate-500 shrink-0 pt-0.5">{label}</dt>
      <dd className="flex items-start gap-1.5 min-w-0 text-right">
        <span className={`${mono ? 'font-mono text-[12.5px]' : 'font-semibold text-[13px]'} text-[#171A2B] break-all`}>
          {value}
        </span>
        {copyKey && <CopyBtn k={copyKey} value={value} />}
      </dd>
    </div>
  );

  // A single item in the Student Information grid.
  const InfoField = ({
    icon,
    label,
    children,
  }: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#5B47D6]/[0.08] flex items-center justify-center shrink-0 text-[#5B47D6]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] text-slate-500">{label}</div>
        <div className="text-[14px] font-semibold text-[#171A2B] break-words">{children}</div>
      </div>
    </div>
  );

  const hasBank = !!(paymentInfo && (paymentInfo.bankTitle || paymentInfo.bankAccountNo || paymentInfo.bankIban));
  const hasWallet = !!(paymentInfo && paymentInfo.wallet);
  const hasPayment = hasBank || hasWallet;

  const receiptWa = `https://wa.me/${ACADEMY_WA}?text=${encodeURIComponent(
    `Hi Thinkerzz, I have paid my fee voucher${voucherNo ? ` (${voucherNo})` : ''} for ${studentName}. Sharing the payment receipt.`
  )}`;
  const receiptMail = `mailto:${ACADEMY_EMAIL}?subject=${encodeURIComponent(
    `Fee Payment Receipt${voucherNo ? ` — ${voucherNo}` : ''}`
  )}&body=${encodeURIComponent(
    `Hi Thinkerzz,\n\nPlease find my payment receipt attached for ${studentName}.\n\nThank you.`
  )}`;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in overflow-y-auto"
        onClick={onClose}
      >
        <div className="w-full max-w-[840px] my-4" onClick={(e) => e.stopPropagation()}>
          {/* THE VOUCHER DOCUMENT (printable) */}
          <div
            id="voucher-slip-print"
            className="bg-white rounded-[20px] shadow-2xl ring-1 ring-slate-200/70 overflow-hidden max-h-[88vh] overflow-y-auto"
          >
            <div className="p-6 sm:p-8 space-y-7 text-[#171A2B]">
              {/* 1 · HEADER */}
              <div className="flex items-start justify-between gap-4">
                <Logo variant="light" size="lg" />
                <div className="flex items-center gap-2.5 rounded-2xl bg-[#5B47D6]/[0.08] border border-[#5B47D6]/[0.15] px-3.5 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#5B47D6]" />
                  </div>
                  <div className="text-right leading-tight">
                    <div className="text-[13px] font-semibold text-[#5B47D6]">Fee Voucher</div>
                    {showVoucherId && (
                      <div className="font-mono text-[12.5px] text-slate-500">{voucherNo || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2 · DOCUMENT TITLE */}
              <div>
                <h1 className="font-heading font-semibold text-[28px] sm:text-[32px] leading-tight text-[#171A2B]">
                  Fee Voucher
                </h1>
                <p className="text-[14px] text-slate-500 mt-1">Payment for your continued learning journey.</p>
              </div>

              {/* 3 · PAYMENT SUMMARY */}
              <div className="rounded-[20px] bg-[#5B47D6]/[0.06] border border-[#5B47D6]/[0.12] p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex items-center gap-4 md:flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-[#5B47D6]/[0.12] flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6 text-[#5B47D6]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-slate-500">Amount To Pay</div>
                    <div className="font-heading font-bold text-[38px] sm:text-[44px] leading-none text-[#171A2B] tracking-tight">
                      PKR {amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[14px] font-medium text-[#5B47D6]">
                      <CalendarDays className="w-4 h-4" />
                      <span>Due Date: {prettyDate(dueDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:w-[290px] md:shrink-0 rounded-2xl bg-white/70 border border-[#5B47D6]/[0.10] px-4 py-3.5">
                  <GraduationCap className="w-7 h-7 text-[#5B47D6] shrink-0" />
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#171A2B] leading-snug">
                      Thank you for being a part of Thinkerzz!
                    </div>
                    <div className="text-[12.5px] text-slate-500 mt-0.5">Your education matters.</div>
                  </div>
                </div>
              </div>

              {/* 4 · STUDENT INFORMATION */}
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#5B47D6]/[0.08] flex items-center justify-center text-[#5B47D6]">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="font-heading font-semibold text-[16px] text-[#171A2B]">Student Information</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                  <InfoField icon={<GraduationCap className="w-4 h-4" />} label="Student">
                    {studentName || '—'}
                  </InfoField>
                  {parentName ? (
                    <InfoField icon={<Users className="w-4 h-4" />} label="Parent / Guardian">
                      {parentName}
                    </InfoField>
                  ) : null}
                  {program ? (
                    <InfoField icon={<BookOpen className="w-4 h-4" />} label="Program">
                      {program}
                    </InfoField>
                  ) : null}
                  {periodLabel ? (
                    <InfoField icon={<CalendarRange className="w-4 h-4" />} label="Billing Period">
                      {periodLabel}
                    </InfoField>
                  ) : null}
                  {showVoucherId ? (
                    <InfoField icon={<Hash className="w-4 h-4" />} label="Voucher Number">
                      <span className="font-mono">{voucherNo || '—'}</span>
                    </InfoField>
                  ) : null}
                  <InfoField icon={<Database className="w-4 h-4" />} label="Voucher Status">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold ${statusChip(status)}`}>
                      {status}
                    </span>
                  </InfoField>
                </div>
              </section>

              {/* 5 · PAYMENT METHODS */}
              {hasPayment && (
                <section>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#5B47D6]/[0.08] flex items-center justify-center text-[#5B47D6]">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <h2 className="font-heading font-semibold text-[16px] text-[#171A2B]">Payment Methods</h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Secure Payment</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hasBank && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-[#5B47D6]/10 flex items-center justify-center shrink-0">
                            <Landmark className="w-4 h-4 text-[#5B47D6]" />
                          </div>
                          <div>
                            <div className="font-semibold text-[14.5px] text-[#171A2B]">Bank Transfer</div>
                            <div className="text-[12px] text-slate-500">Transfer to the following bank account.</div>
                          </div>
                        </div>
                        <dl>
                          {paymentInfo?.bankTitle && (
                            <PayRow label="Account Title" value={paymentInfo.bankTitle} copyKey="bank-title" />
                          )}
                          {paymentInfo?.bankAccountNo && (
                            <PayRow label="Account Number" value={paymentInfo.bankAccountNo} mono copyKey="bank-acct" />
                          )}
                          {paymentInfo?.bankIban && (
                            <PayRow label="IBAN" value={paymentInfo.bankIban} mono copyKey="bank-iban" />
                          )}
                        </dl>
                      </div>
                    )}

                    {hasWallet && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-[14.5px] text-[#171A2B]">JazzCash / Mobile Wallet</div>
                            <div className="text-[12px] text-slate-500">Send payment via mobile wallet.</div>
                          </div>
                        </div>
                        <dl>
                          <PayRow label="Wallet" value={paymentInfo!.wallet as string} mono copyKey="wallet" />
                        </dl>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 6 · AFTER PAYMENT */}
              <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-start gap-3 md:flex-1">
                  <div className="w-10 h-10 rounded-xl bg-[#5B47D6]/10 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-[#5B47D6]" />
                  </div>
                  <div>
                    <div className="font-semibold text-[15px] text-[#171A2B]">After Payment</div>
                    <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">
                      Please send your payment receipt to Thinkerzz via WhatsApp or email after completing the payment.
                      This helps us update your record quickly.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 md:w-[210px] md:shrink-0">
                  <a
                    href={receiptWa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold px-4 py-2.5 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Send via WhatsApp
                  </a>
                  <a
                    href={receiptMail}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#5B47D6]/30 text-[#5B47D6] hover:bg-[#5B47D6]/5 text-[13px] font-semibold px-4 py-2.5 transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Email Receipt
                  </a>
                </div>
              </section>

              {/* 7 · NEED HELP — the final element (nothing below this) */}
              <section className="border-t border-slate-200 pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <div className="flex items-center gap-3 sm:flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#5B47D6]/[0.08] flex items-center justify-center shrink-0 text-[#5B47D6]">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[14.5px] text-[#171A2B]">Need Help?</div>
                      <div className="text-[12.5px] text-slate-500">If you have any questions, feel free to contact us.</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-slate-600">
                    <a href={`https://wa.me/${ACADEMY_WA}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#5B47D6]">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> {prettyWa(ACADEMY_WA)}
                    </a>
                    <a href={`mailto:${ACADEMY_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-[#5B47D6]">
                      <Mail className="w-3.5 h-3.5 text-[#5B47D6]" /> {ACADEMY_EMAIL}
                    </a>
                    <a href={ACADEMY_SITE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-[#5B47D6]">
                      <Globe className="w-3.5 h-3.5 text-[#5B47D6]" /> {prettySite(ACADEMY_SITE)}
                    </a>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* MODAL CONTROLS (never printed — outside the print container) */}
          <div className="print:hidden mt-3 flex flex-wrap items-center justify-end gap-2">
            {sendToStudentHref && (
              <a
                href={sendToStudentHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold px-4 py-2.5 shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> Send to Student
              </a>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold px-4 py-2.5 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print Voucher
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[13px] font-semibold px-4 py-2.5 shadow-sm"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
