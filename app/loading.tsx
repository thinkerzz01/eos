// Instant navigation skeleton. Without this, a tab switch froze on the previous
// page until the new (dynamic) server component finished fetching. This Suspense
// fallback shows immediately, so switching tabs feels instant. Matches the portal
// shell (dark sidebar + top bar + content) so there is no jarring flash.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#020617] grid grid-cols-1 lg:grid-cols-[248px_1fr]">
      {/* Sidebar shell (same dark bg as the real sidebar, so it does not flash) */}
      <div className="hidden lg:flex flex-col w-[248px] bg-[#12142A] h-screen sticky top-0 px-[14px] pb-[18px]">
        <div className="py-6 px-2">
          <div className="h-7 w-32 rounded-md bg-white/10" />
        </div>
        <div className="flex-1 space-y-2.5 mt-2">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/5" />
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col min-w-0">
        {/* Top bar shell */}
        <div className="h-16 border-b border-[#EBEDF3] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6">
          <div className="h-5 w-56 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-9 w-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 px-4 sm:px-6 md:px-7 py-5 space-y-4">
          <div className="h-20 rounded-2xl bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 animate-pulse" />
            ))}
          </div>
          <div className="h-80 rounded-2xl bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
