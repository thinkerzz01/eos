'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  BookOpen,
  GraduationCap,
  Receipt,
  FileText,
  TrendingUp,
  Ticket,
  Megaphone,
  FolderLock,
  Settings,
  ClipboardList,
  DollarSign,
  CreditCard,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export type UserRole = 'admin' | 'manager' | 'teacher' | 'student';

interface SidebarProps {
  role: UserRole;
  counts?: {
    leads?: number;
    demosNeedingTeacher?: number;
    redTickets?: number;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
  allowedRoles: UserRole[];
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

export function Sidebar({ role, counts = {} }: SidebarProps) {
  const pathname = usePathname();

  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Academy',
      items: [
        {
          label: 'Dashboard',
          href: '/',
          icon: LayoutDashboard,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
        {
          label: 'Students',
          href: '/students',
          icon: GraduationCap,
          allowedRoles: ['admin', 'manager', 'teacher'],
        },
        {
          label: 'Teachers',
          href: '/teachers',
          icon: Users,
          allowedRoles: ['admin', 'manager'],
        },
        {
          label: 'Classes',
          href: '/schedule',
          icon: Calendar,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
      ],
    },
    {
      groupLabel: 'Admissions',
      items: [
        {
          label: 'Leads & Demos',
          href: '/leads',
          icon: Users,
          allowedRoles: ['admin', 'manager'],
        },
        {
          label: 'Booking & Schedule',
          href: '/demos',
          icon: UserCheck,
          allowedRoles: ['admin', 'manager'],
        },
        {
          label: 'Marketing',
          href: '/marketing',
          icon: TrendingUp,
          allowedRoles: ['admin', 'manager'],
        },
      ],
    },
    {
      groupLabel: 'Academic',
      items: [
        {
          label: 'Homework',
          href: '/homework',
          icon: FileText,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
        {
          label: 'Assessments',
          href: '/assessments',
          icon: ClipboardList,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
        {
          label: 'Reports',
          href: '/reports',
          icon: TrendingUp,
          allowedRoles: ['admin', 'manager'],
        },
      ],
    },
    {
      groupLabel: 'Finance',
      items: [
        {
          label: 'Payments Ledger',
          href: '/payments',
          icon: DollarSign,
          allowedRoles: ['admin'],
        },
        {
          label: 'Fee Vouchers',
          href: '/vouchers',
          icon: Receipt,
          allowedRoles: ['admin'],
        },
        {
          label: 'Teacher Payouts',
          href: '/teacher-payouts',
          icon: CreditCard,
          allowedRoles: ['admin'],
        },
        {
          label: 'My Fee Vouchers',
          href: '/fees',
          icon: Receipt,
          allowedRoles: ['student'],
        },
      ],
    },
    {
      groupLabel: 'Communication',
      items: [
        {
          label: 'Tickets',
          href: '/tickets',
          icon: Ticket,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
        {
          label: 'Announcements',
          href: '/announcements',
          icon: Megaphone,
          allowedRoles: ['admin', 'manager', 'teacher', 'student'],
        },
        {
          label: 'Email Queue',
          href: '/email-queue',
          icon: Mail,
          allowedRoles: ['admin', 'manager'],
        },
      ],
    },
    {
      groupLabel: 'System',
      items: [
        {
          label: 'Settings',
          href: '/settings',
          icon: Settings,
          allowedRoles: ['admin'],
        },
        {
          label: 'Audit Log',
          href: '/audit-log',
          icon: FolderLock,
          allowedRoles: ['admin'],
        },
      ],
    },
  ];

  return (
    <aside className="w-[248px] bg-[#12142A] text-[#C7CADB] flex flex-col h-screen shrink-0 sticky top-0 px-[14px] pb-[18px] overflow-y-auto z-40 select-none">
      {/* Brand Header with Logo Component */}
      <div className="py-5 px-2">
        <Logo variant="dark" size="md" showTagline={true} />
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 space-y-1">
        {navGroups.map((group, idx) => {
          const visibleItems = group.items.filter((item) =>
            item.allowedRoles.includes(role)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx}>
              <div className="text-xs tracking-[0.13em] uppercase text-[#666C89] px-2.5 pt-3.5 pb-1.5 font-semibold">
                {group.groupLabel}
              </div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-[11px] py-2 rounded-[10px] text-[13.5px] font-medium transition-all mb-[1px] ${
                      isActive
                        ? 'bg-gradient-to-r from-[#5B47D6] to-[#6E5CE6] text-white shadow-[0_6px_16px_rgba(91,71,214,0.4)] font-semibold'
                        : 'text-[#B6BAD0] hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`ml-auto text-xs font-bold px-[7px] py-[1px] rounded-full ${item.badgeColor || 'bg-[#5B47D6] text-white'}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Org Box with Logo Emblem */}
      <div className="mt-auto pt-3">
        <div className="p-3 bg-white/[0.05] rounded-[12px] border border-white/[0.06]">
          <Logo variant="dark" size="sm" showTagline={false} />
          <div className="text-xs text-[#8B8FA8] mt-1 font-medium pl-1">Academic Year 2026</div>
        </div>
      </div>
    </aside>
  );
}
