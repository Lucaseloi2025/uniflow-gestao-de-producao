import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);
