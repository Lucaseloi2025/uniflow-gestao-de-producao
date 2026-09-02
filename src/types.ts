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
  in_progress?: boolean;
  quantidade_boa?: number;
  quantidade_perdida?: number;
  pendencia_reposicao?: number;
  quantidade_pedido?: number;
  calculation_type?: 'por_pedido' | 'por_peca' | 'por_lote';
}

export interface OrderStageProgress {
  order_id: number;
  stage_id: number;
  quantidade_pedido: number;
  quantidade_boa: number;
  quantidade_perdida: number;
  pendencia_reposicao: number;
  finished: boolean;
}

export interface OrderLossLog {
  id?: number;
  order_id: number;
  stage_id: number;
  stage_name?: string;
  user_id: number;
  user_name?: string;
  quantidade_perdida: number;
  motivo: string;
  motivo_detalhe?: string;
  etapa_reentrada_id: number;
  etapa_reentrada_name?: string;
  created_at: string;
}

export interface LossReasonSetting {
  id?: number;
  motivo: string;
  etapa_reentrada_id: number;
  etapa_reentrada_name?: string;
}

export interface SectorLossItem {
  stage_id: number;
  stage_name: string;
  quantidade_perdida: number;
  pct_total: number;
  pedidos_afetados: number;
}

export interface ReasonLossItem {
  motivo: string;
  stage_name: string;
  quantidade_perdida: number;
  pct_total: number;
}

export interface OrderImpactItem {
  order_id: number;
  order_number: string;
  client_name: string;
  quantidade_perdida: number;
  lead_time_com_perda_horas: number;
  lead_time_medio_sem_perda_horas: number;
  atraso_adicional_horas: number;
}

export interface LossReportData {
  summary: {
    total_perdido: number;
    pct_perda: number;
    total_pedidos_com_perda: number;
    impacto_prazo_horas: number;
  };
  perdas_por_setor: SectorLossItem[];
  perdas_por_motivo: ReasonLossItem[];
  impacto_pedidos: OrderImpactItem[];
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
  current_operator?: string | null;
  dtf_complete?: boolean;
  dtf_location?: string;
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
  average_time_seconds?: number;
  ideal_time?: number;
  real_average_time?: number;
  execution_count?: number;
  calculation_type: 'por_pedido' | 'por_peca' | 'por_lote';
  meta_diaria?: number | null;
}

export interface CollaboratorStageGoal {
  id?: number;
  user_id: number;
  stage_id: number;
  meta_diaria: number;
  created_at?: string;
  updated_at?: string;
  user_name?: string;
  stage_name?: string;
}

export interface StageExecution {
  id: number;
  order_id: number;
  order_number?: string;
  client_name?: string;
  product_type?: string;
  stage_id: number;
  stage_name?: string;
  user_id: number;
  user_name?: string;
  start_time: string;
  end_time?: string;
  total_time_seconds: number;
  current_session_seconds?: number;
  status: 'Em andamento' | 'Pausado' | 'Finalizado';
  accumulated_pause_seconds?: number;
  is_paused?: boolean;
  pauses?: any[];
  average_time_seconds?: number;
  ideal_time?: number;
  real_average_time?: number;
  execution_count?: number;
  calculation_type?: 'por_pedido' | 'por_peca' | 'por_lote';
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
  metrics: {
    activeOrders: number;
    activePieces: number;
    overdueOrders: number;
    todayFinalizedPieces: number;
    avgLeadTimeSeconds: number;
    meta_custo_por_peca?: number;
  };
  bottlenecks: {
    stage_name: string;
    count: number;
  }[];
  atRiskOrders: {
    id: number;
    order_number: string;
    client_name: string;
    deadline: string;
    status: string;
    urgency: "Atrasado" | "Risco";
  }[];
  productivity: {
    collaborator: string;
    orders_count: number;
    pieces_count: number;
    avg_time_per_piece: number;
  }[];
}

export interface OperationalStep {
  hora: string;
  order_number: string;
  client_name: string;
  stage_name: string;
  user_name: string;
  duration_seconds: number;
  finished_at: string;
  pecas: number;
}

export interface OrderProgress {
  order_number: string;
  client_name: string;
  status: string;
  deadline: string;
  etapas_concluidas: number;
  total_etapas: number;
  proxima_etapa: string | null;
}

export interface FinishedOrder {
  order_number: string;
  client_name: string;
  pecas: number;
  completed_at: string;
  lead_time_horas: number;
  no_prazo: boolean;
}

export interface CollaboratorProductivity {
  user_id: number;
  user_name: string;
  etapas: number;
  pecas: number;
  tempo_total_segundos: number;
}

export interface OperationalReportData {
  producao_dia: OperationalStep[];
  progresso_pedidos: OrderProgress[];
  pedidos_concluidos: FinishedOrder[];
  produtividade_colaboradores: CollaboratorProductivity[];
}

export interface PeriodStats {
  real: number;
  target: number | null;
  pct: number | null;
  status: 'verde' | 'amarelo' | 'vermelho' | 'sem_meta';
}

export interface CollaboratorGoalRow {
  user_id: number;
  user_name: string;
  stage_id: number;
  stage_name: string;
  calculation_type: 'por_pedido' | 'por_peca' | 'por_lote';
  meta_diaria: number | null;
  is_custom: boolean;
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

export interface SectorGoalRow {
  stage_id: number;
  stage_name: string;
  calculation_type: 'por_pedido' | 'por_peca' | 'por_lote';
  meta_diaria: number | null;
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

export interface GoalsProductivityResponse {
  collaborators: CollaboratorGoalRow[];
  sectors: SectorGoalRow[];
}

/** @deprecated Use GoalsProductivityResponse instead */
export interface ProductivityPeriod {
  name: string;
  today: number;
  week: number;
  month: number;
}

