// Shared button. Consolidates the ~40 hand-rolled buttons that each drifted on
// weight/padding/shadow. Forwards every native button prop (onClick, disabled,
// type, form, title, aria-*) so it is a drop-in for an existing <button>. Extra
// layout classes (w-full, flex-1, custom margins) go through `className`.
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const SIZES: Record<Size, string> = {
  md: 'h-[38px] px-4 text-xs',
  sm: 'h-8 px-3 text-xs',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#5B47D6] hover:bg-[#4F3DC7] text-white shadow-sm',
  secondary:
    'bg-white dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = 'Button';
