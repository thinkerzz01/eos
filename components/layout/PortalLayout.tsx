'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useRole } from '@/components/ui/RoleContext';
import { UserRole } from '@/components/layout/Sidebar';
import { Lock, X } from 'lucide-react';
import { OnboardStudentModal } from '@/components/students/OnboardStudentModal';

interface PortalLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  allowedRoles?: UserRole[];
}

export function PortalLayout({
  children,
  allowedRoles = ['admin', 'manager', 'teacher', 'student'],
}: PortalLayoutProps) {
  const { role } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const isRoleAllowed = allowedRoles.includes(role);

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#020617] text-[#171A2B] dark:text-slate-100 font-sans grid grid-cols-1 lg:grid-cols-[248px_1fr]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar role={role} />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[248px]">
            <Sidebar role={role} />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-3 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col min-w-0">
        <TopBar
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
          onQuickAdd={(type) => setActiveModal(type)}
        />

        <main className="flex-1 px-4 sm:px-6 md:px-7 py-5 pb-20 w-full max-w-full">
          {!isRoleAllowed ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl text-center space-y-4 max-w-lg mx-auto my-12 shadow-xl">
              <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-slate-100">
                  Access Denied - Role Lock
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                  Your current role (<span className="font-bold capitalize text-slate-800 dark:text-slate-200">{role}</span>) does not have database RLS permissions to view this screen.
                </p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-left border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-mono">
                This screen is not part of the '{role}' role's portal. Database RLS independently blocks access to its data.
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Modal Integration */}
      {activeModal === 'student' && (
        <OnboardStudentModal isOpen={true} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
