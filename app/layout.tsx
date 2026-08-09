import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ui/ThemeContext';
import { RoleProvider } from '@/components/ui/RoleContext';
import type { UserRole } from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/server';

// Authoritative role, read server-side from the signed-in user's profile.
// Defaults to 'student' (least privilege) for public pages / no session.
async function getServerRole(): Promise<UserRole> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'student';
    // Use the SECURITY DEFINER helper so role resolution does NOT depend on a
    // per-role RLS read policy on `profiles` (non-admins have none, which made
    // every non-admin fall back to 'student' and land on the student portal).
    const { data: role } = await supabase.rpc('current_user_role');
    return ((role as UserRole) ?? 'student');
  } catch {
    return 'student';
  }
}

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Thinkerzz',
  icons: { icon: '/icon.png', apple: '/icon.png' },
  description:
    'CRM, Scheduling, Booking, CAIE Syllabus, Fees, and Role Portals for Thinkerzz.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerRole();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-[#F6F7FB] text-[#171A2B] transition-colors duration-200">
        <ThemeProvider>
          <RoleProvider role={role}>
            <ToastProvider>{children}</ToastProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
