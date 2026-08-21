import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans, DM_Sans } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ui/ThemeContext';
import { RoleProvider } from '@/components/ui/RoleContext';
import { getServerRole } from '@/lib/auth/serverRole';

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

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dmsans',
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
      className={`${inter.variable} ${plusJakarta.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-[#F6F7FB] text-[#171A2B] transition-colors duration-200">
        {/* Apply the saved global text size before paint (set in Settings). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var s=localStorage.getItem('tz-ui-scale');if(s&&s!=='100')document.documentElement.style.fontSize=s+'%';}catch(e){}",
          }}
        />
        <ThemeProvider>
          <RoleProvider role={role}>
            <ToastProvider>{children}</ToastProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
