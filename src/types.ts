export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Admin' | 'Produção' | 'Comercial';
  hourly_cost: number;
  active: boolean;
}

export interface StageStatus {
  id: number;
  name: string;
  finished: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  client_name: string;
  product_type: 'Dry Fit' | 'Algodão' | 'Poliamida';
  print_type: 'Silk' | 'DTF' | 'Sublimação';
  quantity: number;
  deadline: string;
  status: 'Entrada' | 'Em Produção' | 'Finalização' | 'Entregue';
  observations: string;
  art_url?: string;
  total_time_seconds: number;
  estimated_time_seconds: number;
  stages_status: StageStatus[];
}

export interface OrderTemplate {
  id: number;
  name: string;
  product_type: 'Dry Fit' | 'Algodão' | 'Poliamida';
  print_type: 'Silk' | 'DTF' | 'Sublimação';
  quantity: number;
  observations: string;
}

export interface Stage {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface StageExecution {
  id: number;
  order_id: number;
  stage_id: number;
  stage_name?: string;
  user_id: number;
  user_name?: string;
  start_time: string;
  end_time?: string;
  total_time_seconds: number;
  status: 'Em andamento' | 'Pausado' | 'Finalizado';
}

export interface DashboardStats {
  activeOrders: number;
  avgTimeByPrint: { print_type: string; avg_time: number }[];
  collaboratorRanking: { name: string; total_seconds: number }[];
  bottlenecks: { name: string; avg_time: number }[];
  capacity: {
    config: {
      jornada_horas: number;
      operadores_ativos: number;
      eficiencia_percentual: number;
      dias_uteis_mes: number;
    };
    avgTimePerPieceSeconds: number;
    capacidadeDiariaPecas: number;
    capacidadeMensalPecas: number;
    totalPecasVendidasMes: number;
    percentualOcupacao: number;
  };
}
