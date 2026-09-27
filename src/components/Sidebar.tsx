import React from 'react';
import { 
  LayoutDashboard, 
  Scissors, 
  ClipboardList, 
  Shirt, 
  PackageCheck, 
  Settings, 
  BarChart3, 
  LogOut 
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
  cortePendingBadgeCount = 0 
}: any) => {
  return (
    <div className={`absolute lg:static inset-y-0 left-0 w-64 h-full shrink-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 z-[150] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <div className="flex items-center gap-2 text-indigo-950">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <PackageCheck size={20} className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">ComfortPro</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="mb-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">PRODUÇÃO LINHA</div>
        
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={activeTab === 'dashboard'}
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
        />
        
        <SidebarItem
          icon={ClipboardList}
          label="1. Pedidos (Entrada)"
          active={activeTab === 'orders'}
          onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
        />
        
        <SidebarItem
          icon={Scissors}
          label="2. Corte"
          active={activeTab === 'cutting'}
          badge={cortePendingBadgeCount}
          onClick={() => { setActiveTab('cutting'); setIsMobileMenuOpen(false); }}
        />
        
        <SidebarItem
          icon={Shirt}
          label="3. Costura"
          active={activeTab === 'costura'}
          onClick={() => { setActiveTab('costura'); setIsMobileMenuOpen(false); }}
        />
        
                <SidebarItem
          icon={PackageCheck}
          label="4. Conferência (Separação)"
          active={activeTab === 'conferencia'}
          onClick={() => { setActiveTab('conferencia'); setIsMobileMenuOpen(false); }}
        />

        <SidebarItem
          icon={PackageCheck}
          label="5. Estamparia e Expedição"
          active={activeTab === 'estamparia'}
          onClick={() => { setActiveTab('estamparia'); setIsMobileMenuOpen(false); }}
        />

        <SidebarItem
          icon={PackageCheck}
          label="5. Estamparia e Expedição"
          active={activeTab === 'estamparia'}
          onClick={() => { setActiveTab('estamparia'); setIsMobileMenuOpen(false); }}
        />

        <div className="mt-8 mb-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">GERENCIAL</div>

        <SidebarItem
          icon={BarChart3}
          label="Relatórios"
          active={activeTab === 'reports'}
          onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
        />
        
        <SidebarItem
          icon={Settings}
          label="Configurações"
          active={activeTab === 'settings'}
          onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
        />
      </div>
    </div>
  );
};
