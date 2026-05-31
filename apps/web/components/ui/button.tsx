import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wider font-mono transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50',
          // Variant classes
          variant === 'default' && 'bg-amber-500 text-slate-950 hover:bg-amber-400 border border-amber-600 shadow-md shadow-amber-500/10',
          variant === 'destructive' && 'bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 shadow-md shadow-rose-500/5',
          variant === 'outline' && 'bg-transparent border border-white/10 text-slate-300 hover:text-white hover:bg-white/5',
          variant === 'secondary' && 'bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800',
          variant === 'ghost' && 'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-white/5',
          variant === 'link' && 'bg-transparent text-amber-500 hover:underline normal-case p-0 h-auto',
          // Size classes
          size === 'default' && 'h-9 px-4 py-2',
          size === 'sm' && 'h-8 rounded-md px-3 text-[10px]',
          size === 'lg' && 'h-10 rounded-md px-6 text-sm',
          size === 'icon' && 'h-9 w-9 p-0',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
