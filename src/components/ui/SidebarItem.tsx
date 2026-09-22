import React from 'react';
import { cn } from '../../lib/utils';

export const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number | string }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
      active 
        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
        : "text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600"
    )}
  >
    {active && (
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
    )}
    <div className="flex items-center gap-3 relative z-10">
      <Icon size={20} className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </div>
    {badge !== undefined && (
      <span className={cn(
        "relative z-10 px-2 py-0.5 rounded-full text-xs font-bold",
        active ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600"
      )}>
        {badge}
      </span>
    )}
  </button>
);

