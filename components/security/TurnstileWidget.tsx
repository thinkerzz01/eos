'use client';

// Cloudflare Turnstile widget for the public forms. Renders NOTHING unless
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so the forms work unchanged until you
// enable Turnstile in production. When enabled, it produces a token that the
// form passes to the server action, which verifies it (see lib/publicFormGuard).
import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_ID = 'cf-turnstile-script';

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !boxRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => cb.current(token),
        'error-callback': () => cb.current(''),
        'expired-callback': () => cb.current(''),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', render);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* noop */ }
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={boxRef} className="my-2" />;
}
