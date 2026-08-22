// Typography registry. The app is driven by two CSS variables set on <html>:
//   --app-font-heading  (all headings / .font-heading)
//   --app-font-body     (body text / font-sans)
// Each option below maps a stored key to a next/font CSS variable that is loaded
// in app/layout.tsx. Admins pick heading + body fonts in Settings → Typography;
// the choice is stored on orgs.heading_font / orgs.body_font (readable by every
// role) and applied in the root layout. Plain module (no server imports) so both
// the server layout and the client Settings page can import it.

export interface FontOption {
  key: string;
  label: string;
  varName: string; // the CSS variable next/font exposes (must match app/layout.tsx)
  kind: 'sans' | 'serif';
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'jost', label: 'Jost (Futura-style)', varName: '--font-jost', kind: 'sans' },
  { key: 'nunito', label: 'Nunito', varName: '--font-nunito', kind: 'sans' },
  { key: 'inter', label: 'Inter', varName: '--font-inter', kind: 'sans' },
  { key: 'poppins', label: 'Poppins', varName: '--font-poppins', kind: 'sans' },
  { key: 'lora', label: 'Lora (serif)', varName: '--font-lora', kind: 'serif' },
];

export const DEFAULT_HEADING_FONT = 'poppins';
export const DEFAULT_BODY_FONT = 'inter';

/** Resolve a stored key to a CSS `var(--font-xxx)` reference, falling back safely. */
export function fontVar(key: string | null | undefined, fallbackKey: string): string {
  const opt = FONT_OPTIONS.find((o) => o.key === key) ?? FONT_OPTIONS.find((o) => o.key === fallbackKey);
  return opt ? `var(${opt.varName})` : 'ui-sans-serif';
}
