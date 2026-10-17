export type OperationStatus =
  | 'AGUARDANDO'
  | 'LIBERADA'
  | 'EM_ANDAMENTO'
  | 'PAUSADA'
  | 'PARCIAL'
  | 'BLOQUEADA'
  | 'CONCLUIDA'
  | 'CANCELADA';

export type UserRole =
  | 'Admin'
  | 'Administrador'
  | 'PCP'
  | 'Supervisor'
  | 'Operador'
  | 'Produção'
  | 'Comercial'
  | 'Visualização';

export type PermissionAction =
  | 'manage_users'
  | 'manage_pcp'
  | 'override_priority'
  | 'block_unblock_order'
  | 'override_concurrent_session'
  | 'execute_operation'
  | 'edit_commercial_order'
  | 'view_reports'
  | 'reopen_stage';

export const ALLOWED_OPERATION_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  AGUARDANDO: ['LIBERADA', 'BLOQUEADA', 'CANCELADA'],
  LIBERADA: ['EM_ANDAMENTO', 'BLOQUEADA', 'CANCELADA', 'CONCLUIDA'],
  EM_ANDAMENTO: ['PAUSADA', 'PARCIAL', 'CONCLUIDA', 'BLOQUEADA', 'CANCELADA'],
  PAUSADA: ['EM_ANDAMENTO', 'PARCIAL', 'CONCLUIDA', 'BLOQUEADA', 'CANCELADA'],
  PARCIAL: ['EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'BLOQUEADA', 'CANCELADA'],
  BLOQUEADA: ['AGUARDANDO', 'LIBERADA', 'PARCIAL', 'PAUSADA', 'CANCELADA'],
  CONCLUIDA: ['LIBERADA', 'PARCIAL', 'EM_ANDAMENTO'], // Apenas via reabertura autorizada
  CANCELADA: ['AGUARDANDO', 'LIBERADA'], // Apenas via restauração autorizada
};

export function canTransitionOperationStatus(
  from: OperationStatus,
  to: OperationStatus,
  allowReopenOverride = false
): { allowed: boolean; reason?: string } {
  if (from === to) return { allowed: true };
  if (from === 'CONCLUIDA' && !allowReopenOverride) {
    return {
      allowed: false,
      reason: 'Operação já CONCLUÍDA não pode mudar de status sem reabertura formal autorizada.',
    };
  }
  const allowedTargets = ALLOWED_OPERATION_TRANSITIONS[from] || [];
  if (!allowedTargets.includes(to)) {
    return {
      allowed: false,
      reason: `Transição inválida de status da operação: ${from} -> ${to}.`,
    };
  }
  return { allowed: true };
}

export interface ResolveOperationStatusInput {
  isCancelled?: boolean;
  isBlocked?: boolean;
  finished?: boolean;
  activeExecutionStatus?: 'Em andamento' | 'Pausado' | 'Finalizado' | null;
  quantidadePedido: number;
  quantidadeRecebida?: number;
  quantidadeBoa: number;
  pendenciaReposicao?: number;
  isFirstStageInRoute: boolean;
  previousStageFinished: boolean;
  previousStageTransferredQty?: number;
  calculationType?: 'por_peca' | 'por_pedido' | 'por_lote';
}

export function resolveOperationStatus(input: ResolveOperationStatusInput): OperationStatus {
  if (input.isCancelled) return 'CANCELADA';
  if (input.isBlocked) return 'BLOQUEADA';

  const targetQty = Math.max(0, Number(input.quantidadePedido) || 0);
  const goodQty = Math.max(0, Number(input.quantidadeBoa) || 0);
  const replQty = Math.max(0, Number(input.pendenciaReposicao) || 0);
  const calcType = input.calculationType || 'por_peca';

  if (input.activeExecutionStatus === 'Em andamento') {
    return 'EM_ANDAMENTO';
  }
  if (input.activeExecutionStatus === 'Pausado') {
    return 'PAUSADA';
  }

  if (calcType === 'por_pedido') {
    if (input.finished) return 'CONCLUIDA';
  } else {
    if (input.finished && replQty === 0 && (targetQty === 0 || goodQty >= targetQty)) {
      return 'CONCLUIDA';
    }
    if (targetQty > 0 && goodQty >= targetQty && replQty === 0) {
      return 'CONCLUIDA';
    }
  }

  if (goodQty > 0 && (goodQty < targetQty || replQty > 0)) {
    return 'PARCIAL';
  }

  const receivedFromPrev = Math.max(0, Number(input.previousStageTransferredQty) || 0);
  const explicitlyReceived = Math.max(0, Number(input.quantidadeRecebida) || 0);
  const canStart =
    input.isFirstStageInRoute ||
    input.previousStageFinished ||
    receivedFromPrev > 0 ||
    explicitlyReceived > 0;

  return canStart ? 'LIBERADA' : 'AGUARDANDO';
}

export interface StageProgressState {
  order_id: number;
  stage_id: number;
  quantidade_pedido: number;
  quantidade_recebida?: number;
  quantidade_boa: number;
  quantidade_perdida: number;
  quantidade_retrabalho?: number;
  quantidade_transferida?: number;
  pendencia_reposicao: number;
  finished: boolean;
  status_operacao?: OperationStatus;
}

export interface PartialProductionInput {
  currentStage: StageProgressState;
  nextStage?: StageProgressState | null;
  incremento_bom: number;
  incremento_perdido?: number;
  incremento_retrabalho?: number;
  transferToNextStage?: boolean;
  calculationType?: 'por_peca' | 'por_pedido' | 'por_lote';
  isFirstStageInRoute?: boolean;
  previousStageFinished?: boolean;
}

export interface PartialProductionResult {
  updatedCurrentStage: StageProgressState & {
    quantidade_recebida: number;
    quantidade_retrabalho: number;
    quantidade_transferida: number;
    saldo_pendente: number;
    status_operacao: OperationStatus;
  };
  updatedNextStage: (StageProgressState & {
    quantidade_recebida: number;
    status_operacao: OperationStatus;
  }) | null;
  transferredDelta: number;
  availableToTransfer: number;
}

/**
 * Calcula apontamento parcial (peças boas, perdas, retrabalho) e transferência formal
 * para a próxima etapa da rota produtiva sem jamais duplicar quantidades já transferidas.
 */
export function calculatePartialProductionAndTransfer(
  input: PartialProductionInput
): PartialProductionResult {
  const {
    currentStage,
    nextStage,
    incremento_bom,
    incremento_perdido = 0,
    incremento_retrabalho = 0,
    transferToNextStage = true,
    calculationType = 'por_peca',
    isFirstStageInRoute = true,
    previousStageFinished = true,
  } = input;

  const incGood = Math.max(0, Number(incremento_bom) || 0);
  const incLost = Math.max(0, Number(incremento_perdido) || 0);
  const incRework = Math.max(0, Number(incremento_retrabalho) || 0);

  const qtyPedido = Math.max(0, Number(currentStage.quantidade_pedido) || 0);
  const prevReceived =
    currentStage.quantidade_recebida !== undefined && currentStage.quantidade_recebida > 0
      ? Number(currentStage.quantidade_recebida)
      : isFirstStageInRoute || previousStageFinished
      ? qtyPedido
      : 0;

  const prevGood = Math.max(0, Number(currentStage.quantidade_boa) || 0);
  const prevLost = Math.max(0, Number(currentStage.quantidade_perdida) || 0);
  const prevRework = Math.max(0, Number(currentStage.quantidade_retrabalho) || 0);
  const prevTransferred = Math.max(0, Number(currentStage.quantidade_transferida) || 0);
  const prevRepl = Math.max(0, Number(currentStage.pendencia_reposicao) || 0);

  // Teto máximo de peças boas é a quantidade do pedido + reposição (ou recebida se maior)
  const maxGoodAllowed = Math.max(qtyPedido + prevRepl, prevReceived);
  const newGood = maxGoodAllowed > 0 ? Math.min(maxGoodAllowed, prevGood + incGood) : prevGood + incGood;
  const newLost = prevLost + incLost;
  const newRework = prevRework + incRework;

  // Se havia pendência de reposição e entrou produção boa além do acumulado, abater
  const newRepl = incGood > 0 && prevRepl > 0 ? Math.max(0, prevRepl - incGood) : prevRepl;

  const effectiveTarget = qtyPedido > 0 ? qtyPedido : prevReceived;
  const saldoPendente = Math.max(0, effectiveTarget - newGood + newRepl);

  const isStageFinished =
    calculationType === 'por_pedido'
      ? newGood > 0 && saldoPendente === 0
      : effectiveTarget > 0 && newGood >= effectiveTarget && newRepl === 0;

  // Cálculo de transferência sem duplicação:
  // Somente a diferença entre o total bom acumulado (limitado ao pedido) e o que já foi transferido pode ir para a próxima etapa.
  const transferableGoodTotal = qtyPedido > 0 ? Math.min(newGood, qtyPedido) : newGood;
  const availableToTransfer = Math.max(0, transferableGoodTotal - prevTransferred);
  const transferredDelta = transferToNextStage && nextStage ? availableToTransfer : 0;
  const newTransferredTotal = prevTransferred + transferredDelta;

  const currentStatus = resolveOperationStatus({
    finished: isStageFinished,
    quantidadePedido: effectiveTarget,
    quantidadeRecebida: prevReceived,
    quantidadeBoa: newGood,
    pendenciaReposicao: newRepl,
    isFirstStageInRoute,
    previousStageFinished,
    calculationType,
  });

  const updatedCurrentStage = {
    ...currentStage,
    quantidade_pedido: qtyPedido,
    quantidade_recebida: prevReceived,
    quantidade_boa: newGood,
    quantidade_perdida: newLost,
    quantidade_retrabalho: newRework,
    quantidade_transferida: newTransferredTotal,
    pendencia_reposicao: newRepl,
    saldo_pendente: saldoPendente,
    finished: isStageFinished,
    status_operacao: currentStatus,
  };

  let updatedNextStage: PartialProductionResult['updatedNextStage'] = null;
  if (nextStage) {
    const prevNextReceived = Math.max(0, Number(nextStage.quantidade_recebida) || 0);
    // Garante que a etapa seguinte nunca receba mais do que o total transferido acumulado nem duplique
    const nextReceived = Math.min(
      Math.max(nextStage.quantidade_pedido || qtyPedido, newTransferredTotal),
      Math.max(prevNextReceived + transferredDelta, newTransferredTotal)
    );
    const nextStatus = resolveOperationStatus({
      finished: nextStage.finished,
      quantidadePedido: nextStage.quantidade_pedido || qtyPedido,
      quantidadeRecebida: nextReceived,
      quantidadeBoa: nextStage.quantidade_boa || 0,
      pendenciaReposicao: nextStage.pendencia_reposicao || 0,
      isFirstStageInRoute: false,
      previousStageFinished: isStageFinished,
      previousStageTransferredQty: nextReceived,
    });

    updatedNextStage = {
      ...nextStage,
      quantidade_pedido: nextStage.quantidade_pedido || qtyPedido,
      quantidade_recebida: nextReceived,
      status_operacao: nextStatus,
    };
  }

  return {
    updatedCurrentStage,
    updatedNextStage,
    transferredDelta,
    availableToTransfer,
  };
}

const ROLE_PERMISSIONS: Record<string, PermissionAction[]> = {
  Admin: [
    'manage_users',
    'manage_pcp',
    'override_priority',
    'block_unblock_order',
    'override_concurrent_session',
    'execute_operation',
    'edit_commercial_order',
    'view_reports',
    'reopen_stage',
  ],
  Administrador: [
    'manage_users',
    'manage_pcp',
    'override_priority',
    'block_unblock_order',
    'override_concurrent_session',
    'execute_operation',
    'edit_commercial_order',
    'view_reports',
    'reopen_stage',
  ],
  PCP: [
    'manage_pcp',
    'override_priority',
    'block_unblock_order',
    'execute_operation',
    'view_reports',
    'reopen_stage',
  ],
  Supervisor: [
    'manage_pcp',
    'override_priority',
    'block_unblock_order',
    'override_concurrent_session',
    'execute_operation',
    'view_reports',
    'reopen_stage',
  ],
  Operador: ['execute_operation'],
  Produção: ['execute_operation'],
  Comercial: ['edit_commercial_order', 'view_reports'],
  Visualização: ['view_reports'],
};

export function normalizeUserRole(rawRole?: string | null): UserRole {
  const r = (rawRole || '').trim();
  if (r === 'Admin' || r === 'Administrador') return 'Admin';
  if (r === 'PCP') return 'PCP';
  if (r === 'Supervisor') return 'Supervisor';
  if (r === 'Comercial') return 'Comercial';
  if (r === 'Visualização' || r === 'Visualizacao') return 'Visualização';
  if (r === 'Operador') return 'Operador';
  return 'Produção';
}

export function hasPermission(rawRole: string | undefined | null, action: PermissionAction): boolean {
  if (!rawRole) return false;
  const normalized = normalizeUserRole(rawRole);
  const perms = ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[rawRole] || [];
  return perms.includes(action);
}

export function canOverrideSingleSession(
  rawRole: string | undefined | null,
  explicitSupervisorOverride?: boolean
): boolean {
  if (!explicitSupervisorOverride) return false;
  return hasPermission(rawRole, 'override_concurrent_session');
}

export function getSaoPauloDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

export function formatSaoPauloTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00';
}
