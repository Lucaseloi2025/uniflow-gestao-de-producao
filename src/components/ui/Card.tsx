import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className, ...props }: any) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-zinc-200", className)} {...props}>
    {children}
  </div>
);
