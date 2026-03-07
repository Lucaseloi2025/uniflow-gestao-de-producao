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
  status: 'Entrada' | 'Em Produção' | 'Finalização' | 'Entregue' | 'Cancelado';
  observations: string;
  art_url?: string;
  art_urls?: string[];
  total_time_seconds: number;
  estimated_time_seconds: number;
  required_stages?: number[];
  stages_status: StageStatus[];
  num_colors?: number;
  deleted_at?: string | null;
  cancelled_at?: string | null;
}

export interface OrderHistory {
  id: number;
  order_id: number;
  usuario: string;
  acao: 'criou' | 'editou' | 'cancelou' | 'excluiu' | 'restaurou';
  antes: any;
  depois: any;
  created_at: string;
}

export interface StageForecast {
  stageId: number;
  stageName: string;
  startDate: string;
  endDate: string;
  queueDays: number;
  execDays: number;
}

export interface OrderForecast {
  orderId: number;
  orderNumber: string;
  clientName: string;
  quantity: number;
  printType: string;
  productType: string;
  deadline: string;
  predictedDate: string;
  riskIndex: number;
  riskLevel: 'safe' | 'warning' | 'danger';
  bottleneckStage: string | null;
  stageForecasts: StageForecast[];
}

export interface OrderTemplate {
  id: number;
  name: string;
  product_type: 'Dry Fit' | 'Algodão' | 'Poliamida';
  print_type: 'Silk' | 'DTF' | 'Sublimação';
  quantity: number;
  observations: string;
  required_stages: number[];
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
  order_number?: string;
  stage_id: number;
  stage_name?: string;
  user_id: number;
  user_name?: string;
  start_time: string;
  end_time?: string;
  total_time_seconds: number;
  status: 'Em andamento' | 'Pausado' | 'Finalizado';
  accumulated_pause_seconds?: number;
  is_paused?: boolean;
}

export interface DeliveryReportData {
  entregues_hoje: number;
  entregues_periodo: number;
  taxa_no_prazo_percent: number;
  lead_time_medio_dias: number;
  cumprimento_meta_percent: number;
  grafico: {
    data: string;
    pedidos: number;
    pecas: number;
    meta_pedidos: number;
    meta_pecas: number;
  }[];
  atrasados: {
    id: number;
    order_number: string;
    client_name: string;
    product_type: string;
    deadline: string;
    dias_atraso: number;
  }[];
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
      meta_diaria_pedidos: number;
      meta_diaria_pecas: number;
    };
    avgTimePerPieceSeconds: number;
    capacidadeDiariaPecas: number;
    capacidadeMensalPecas: number;
    totalPecasVendidasMes: number;
    percentualOcupacao: number;
  };
}

export interface OperationalStep {
  hora: string;
  pedido: string;
  cliente: string;
  etapa: string;
  colaborador: string;
  pecas: number;
}

export interface OrderProgress {
  pedido: string;
  cliente: string;
  etapa_atual: string;
  etapas_dia: string;
}

export interface FinishedOrder {
  pedido: string;
  cliente: string;
  pecas: number;
  lead_time: string;
}

export interface CollaboratorProductivity {
  colaborador: string;
  etapas: number;
  pecas: number;
}

export interface OperationalReportData {
  executions: OperationalStep[];
  progress: OrderProgress[];
  finished: FinishedOrder[];
  productivity: CollaboratorProductivity[];
}
