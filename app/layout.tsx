import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Nunito, Jost, Inter, Poppins, Lora } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ui/ThemeContext';
import { RoleProvider } from '@/components/ui/RoleContext';
import { getServerRole } from '@/lib/auth/serverRole';
import { getTypography } from '@/lib/data/typography';
import { fontVar, DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from '@/lib/fonts';

// Curated, admin-selectable font set (Settings → Typography). Nunito + Jost are
// the defaults (headings + body). All variable fonts except Poppins, so each is a
// single small woff2 (latin subset) - kept deliberately lightweight.
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });
const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });

const FONT_VARS = [nunito.variable, jost.variable, inter.variable, poppins.variable, lora.variable].join(' ');

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
  // CSP nonce set by middleware; applied to the one inline boot script below so
  // it runs under the production nonce-based policy.
  const nonce = headers().get('x-nonce') ?? undefined;
  // Admin-chosen fonts (Settings → Typography), applied via CSS variables that
  // globals.css / Tailwind read. Defaults: Nunito headings, Jost body.
  const typography = await getTypography();
  const fontStyle = {
    ['--app-font-heading' as any]: fontVar(typography.headingFont, DEFAULT_HEADING_FONT),
    ['--app-font-body' as any]: fontVar(typography.bodyFont, DEFAULT_BODY_FONT),
  } as React.CSSProperties;
  return (
    <html
      lang="en"
      className={FONT_VARS}
      style={fontStyle}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-[#F6F7FB] text-[#171A2B] transition-colors duration-200">
        {/* Apply the saved global text size before paint (set in Settings). */}
        <script
          nonce={nonce}
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
