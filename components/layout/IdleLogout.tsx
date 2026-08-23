'use client';

// Banking-style session security. Signs the user out after a period of true
// inactivity (any mouse/keyboard/scroll/touch resets the timer, so active users
// are never interrupted). Shows a countdown warning first so nobody is logged
// out by surprise, and also signs out if the app is reopened after being idle
// (e.g. tab closed yesterday, reopened today). Mounted in PortalLayout, so it
// only runs on signed-in pages.
//
// Tune these two constants to make it stricter/looser:
import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const IDLE_LIMIT_MS = 15 * 60 * 1000; // total inactivity before sign-out (15 min)
const WARN_BEFORE_MS = 60 * 1000;     // show the "still there?" warning this long before

const TICK_MS = 1000;
const WRITE_THROTTLE_MS = 5 * 1000;
const ACTIVITY_KEY = 'tz_last_activity';

export function IdleLogout() {
  const router = useRouter();
  const signingOut = useRef(false);
  const lastWrite = useRef(0);
  const [warnLeft, setWarnLeft] = useState<number | null>(null); // seconds left, or null = hidden

  const getLast = (): number => {
    try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
  };
  const stamp = useCallback(() => {
    const t = Date.now();
    if (t - lastWrite.current > WRITE_THROTTLE_MS) {
      lastWrite.current = t;
      try { localStorage.setItem(ACTIVITY_KEY, String(t)); } catch {}
    }
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try { await createClient().auth.signOut(); } catch {}
    try { localStorage.removeItem(ACTIVITY_KEY); } catch {}
    router.replace('/login?timeout=1');
    router.refresh();
  }, [router]);

  const staySignedIn = useCallback(() => {
    lastWrite.current = 0; // force an immediate stamp
    stamp();
    setWarnLeft(null);
  }, [stamp]);

  useEffect(() => {
    // On load: if the stored activity is already older than the limit, sign out.
    const last = getLast();
    if (last && Date.now() - last > IDLE_LIMIT_MS) { signOut(); return; }
    stamp();

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, stamp, { passive: true }));

    const iv = setInterval(() => {
      const idle = Date.now() - getLast();
      if (idle >= IDLE_LIMIT_MS) {
        signOut();
      } else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        setWarnLeft(Math.max(1, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
      } else {
        setWarnLeft((prev) => (prev === null ? prev : null));
      }
    }, TICK_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, stamp));
      clearInterval(iv);
    };
  }, [signOut, stamp]);

  if (warnLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-3">
        <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">Still there?</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          For your security you&apos;ll be signed out in <span className="font-medium text-rose-600">{warnLeft}s</span> due to inactivity.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <button
            onClick={() => signOut()}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Sign out now
          </button>
          <button
            onClick={staySignedIn}
            className="px-5 py-2 rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium shadow-sm"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
