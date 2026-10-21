import React from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Package,
  PackageCheck, 
  ListOrdered,
  Users,
  Settings, 
  BarChart3, 
  LogOut,
  User as UserIcon,
  X
} from 'lucide-react';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-900'}`}
  >
    <div className="flex items-center gap-3">
      <Icon size={18} className={active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} />
      <span className="font-bold text-[13px] tracking-wide">{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
        {badge}
      </span>
    )}
  </button>
);

export const Sidebar = ({ 
  activeTab, 
  setActiveTab, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  currentUser,
  handleLogout
}: any) => {
  return (
    <div className={`fixed lg:static inset-y-0 left-0 w-64 h-full shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 z-[150] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-indigo-950">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <PackageCheck size={20} className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">ComfortPro</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">PRODUÇÃO</div>
        
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={activeTab === 'dashboard'}
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
        />

        <SidebarItem
          icon={ListOrdered}
          label="Minha Fila"
          active={activeTab === 'minha-fila'}
          onClick={() => { setActiveTab('minha-fila'); setIsMobileMenuOpen(false); }}
        />

        <SidebarItem
          icon={ClipboardList}
          label="Fluxo Kanban"
          active={activeTab === 'kanban'}
          onClick={() => { setActiveTab('kanban'); setIsMobileMenuOpen(false); }}
        />
        
        <SidebarItem
          icon={Package}
          label="Pedidos (Entrada)"
          active={activeTab === 'orders'}
          onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
        />

        <div className="mt-8 mb-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">GERENCIAL</div>

        {currentUser?.role === 'Administrador' && (
          <SidebarItem
            icon={Users}
            label="Colaboradores"
            active={activeTab === 'collaborators'}
            onClick={() => { setActiveTab('collaborators'); setIsMobileMenuOpen(false); }}
          />
        )}

        <SidebarItem
          icon={BarChart3}
          label="Relatórios"
          active={activeTab === 'reports'}
          onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
        />

        <div className="mt-8 mb-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">SISTEMA</div>
        
        <SidebarItem
          icon={Settings}
          label="Configurações"
          active={activeTab === 'settings'}
          onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
        />
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <UserIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.name || '---'}</p>
            <p className="text-[11px] text-slate-500 truncate">{currentUser?.role || '---'}</p>
          </div>
        </div>
        {handleLogout && (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            Sair da Conta
          </button>
        )}
      </div>
    </div>
  );
};
