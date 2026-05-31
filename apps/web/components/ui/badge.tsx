import * as React from 'react';

import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold font-mono uppercase tracking-wider transition-colors',
        variant === 'default' && 'bg-amber-500 text-slate-950 border border-amber-600',
        variant === 'secondary' && 'bg-slate-800 text-slate-100 border border-white/5',
        variant === 'destructive' && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        variant === 'warning' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        variant === 'info' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        variant === 'outline' && 'text-slate-300 border border-white/10 bg-transparent',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
