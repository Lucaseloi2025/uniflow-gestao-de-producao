import React from 'react';
import { LayoutDashboard, ClipboardList, Package, Scissors, Users, BarChart3, Target, Settings, LogOut, Menu, X, Activity, DollarSign, FileText, User as UserIcon, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { SidebarItem } from './ui/SidebarItem';

export const Sidebar = ({
  activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, currentUser, cortePendingBadgeCount, handleLogout
}: any) => {
  return (
    <>
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white p-6 flex flex-col gap-8 transition-transform duration-300 lg:relative lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
              <Package size={18} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">ComfortPro</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {/* PCP MODULE */}
          {(currentUser?.role === 'Admin' || currentUser?.role === 'PCP') && (
            <>
              <div className="mt-4 mb-2 px-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">MÓDULO PCP</div>
              <SidebarItem
                icon={Target}
                label="Painel PCP"
                active={activeTab === 'pcp-dashboard'}
                onClick={() => { setActiveTab('pcp-dashboard'); setIsMobileMenuOpen(false); }}
              />
              <SidebarItem
                icon={ClipboardList}
                label="Necessidades"
                active={activeTab === 'pcp-necessidades'}
                onClick={() => { setActiveTab('pcp-necessidades'); setIsMobileMenuOpen(false); }}
              />
              <SidebarItem
                icon={Activity}
                label="Prioridades"
                active={activeTab === 'pcp-prioridades'}
                onClick={() => { setActiveTab('pcp-prioridades'); setIsMobileMenuOpen(false); }}
              />
              <SidebarItem
                icon={AlertTriangle}
                label="Bloqueados"
                active={activeTab === 'pcp-bloqueados'}
                onClick={() => { setActiveTab('pcp-bloqueados'); setIsMobileMenuOpen(false); }}
              />
              <SidebarItem
                icon={Settings}
                label="Config PCP"
                active={activeTab === 'pcp-settings'}
                onClick={() => { setActiveTab('pcp-settings'); setIsMobileMenuOpen(false); }}
              />
              <div className="mt-4 mb-2 px-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">PRODUÇÃO</div>
            </>
          )}
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={ClipboardList}
            label="Kanban"
            active={activeTab === 'kanban'}
            onClick={() => { setActiveTab('kanban'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={Package}
            label="Pedidos"
            active={activeTab === 'orders'}
            onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
          />
          <SidebarItem
            icon={Scissors}
            label="Central de Corte"
            active={activeTab === 'cutting'}
            onClick={() => { setActiveTab('cutting'); setIsMobileMenuOpen(false); }}
            badge={cortePendingBadgeCount > 0 ? cortePendingBadgeCount : undefined}
          />
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Users}
              label="Colaboradores"
              active={activeTab === 'collaborators'}
              onClick={() => { setActiveTab('collaborators'); setIsMobileMenuOpen(false); }}
            />
          )}
          <SidebarItem
            icon={FileText}
            label="Relatórios"
            active={activeTab === 'reports'}
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
          />
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Activity}
              label="Monitor"
              active={activeTab === 'monitor'}
              onClick={() => { setActiveTab('monitor'); setIsMobileMenuOpen(false); }}
            />
          )}
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={DollarSign}
              label="Custos"
              active={activeTab === 'costs'}
              onClick={() => { setActiveTab('costs'); setIsMobileMenuOpen(false); }}
            />
          )}
          {currentUser?.role === 'Admin' && (
            <SidebarItem
              icon={Settings}
              label="Configurações"
              active={activeTab === 'settings'}
              onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
            />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
              <UserIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser?.name || '---'}</p>
              <p className="text-xs text-zinc-500 truncate">{currentUser?.role || '---'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={16} />
            Sair da Conta
          </button>
        </div>
      </aside>
    </>
  );
};



