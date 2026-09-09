export interface PauseRecord {
  id?: number;
  execution_id?: number;
  start_pause: string;
  end_pause?: string | null;
  duration_seconds?: number | null;
}

export interface ExecutionRecord {
  id?: number;
  start_time: string;
  end_time?: string | null;
  status: 'Em andamento' | 'Pausado' | 'Finalizado';
  total_time_seconds?: number;
  pauses?: PauseRecord[];
}

export interface CalculatedTimes {
  totalAccumulatedSeconds: number;
  currentSessionSeconds: number;
  isPaused: boolean;
}

/**
 * Calculates standardized time metrics for a stage execution:
 * - `totalAccumulatedSeconds`: total active work time across all completed sessions + current session (if running).
 * - `currentSessionSeconds`: active duration of the current session since last start/resume (0 if paused or finished).
 * - `isPaused`: boolean indicating whether execution is currently paused.
 */
export function calculateExecutionTimes(
  execution: ExecutionRecord,
  pauses: PauseRecord[] = [],
  nowMs: number = Date.now()
): CalculatedTimes {
  if (!execution || !execution.start_time) {
    return { totalAccumulatedSeconds: 0, currentSessionSeconds: 0, isPaused: false };
  }

  const startTimeMs = new Date(execution.start_time).getTime();
  const allPauses = pauses && pauses.length > 0 ? pauses : (execution.pauses || []);

  // Filter completed pauses vs active open pause
  let completedPauseSeconds = 0;
  let openPause: PauseRecord | null = null;
  const completedEndPauseTimes: number[] = [];

  for (const p of allPauses) {
    if (p.duration_seconds !== null && p.duration_seconds !== undefined && p.end_pause) {
      completedPauseSeconds += Math.max(0, p.duration_seconds);
      completedEndPauseTimes.push(new Date(p.end_pause).getTime());
    } else if (p.end_pause === null || p.end_pause === undefined) {
      openPause = p;
    } else if (p.start_pause && p.end_pause) {
      const dur = Math.max(0, Math.floor((new Date(p.end_pause).getTime() - new Date(p.start_pause).getTime()) / 1000));
      completedPauseSeconds += dur;
      completedEndPauseTimes.push(new Date(p.end_pause).getTime());
    }
  }

  const isPaused = execution.status === 'Pausado' || openPause !== null;

  if (execution.status === 'Finalizado') {
    let finalTotal = execution.total_time_seconds;
    if (finalTotal === undefined || finalTotal === null) {
      const endTimeMs = execution.end_time ? new Date(execution.end_time).getTime() : nowMs;
      finalTotal = Math.max(0, Math.floor((endTimeMs - startTimeMs) / 1000) - completedPauseSeconds);
    }
    return {
      totalAccumulatedSeconds: Math.max(0, Math.floor(finalTotal)),
      currentSessionSeconds: 0,
      isPaused: false
    };
  }

  if (isPaused) {
    // If paused, freezing total time at the moment pause started minus completed pauses before it
    const pauseStartMs = openPause && openPause.start_pause
      ? new Date(openPause.start_pause).getTime()
      : nowMs;
    const grossElapsedUpToPause = Math.max(0, Math.floor((pauseStartMs - startTimeMs) / 1000));
    const netTotalAtPause = Math.max(0, grossElapsedUpToPause - completedPauseSeconds);

    return {
      totalAccumulatedSeconds: netTotalAtPause,
      currentSessionSeconds: 0,
      isPaused: true
    };
  }

  // Execution is 'Em andamento'
  const grossElapsed = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));
  const totalAccumulatedSeconds = Math.max(0, grossElapsed - completedPauseSeconds);

  // Determine current session start
  let currentSessionStartMs = startTimeMs;
  if (completedEndPauseTimes.length > 0) {
    const latestEndPauseMs = Math.max(...completedEndPauseTimes);
    if (latestEndPauseMs > startTimeMs) {
      currentSessionStartMs = latestEndPauseMs;
    }
  }

  const currentSessionSeconds = Math.max(0, Math.floor((nowMs - currentSessionStartMs) / 1000));

  return {
    totalAccumulatedSeconds,
    currentSessionSeconds,
    isPaused: false
  };
}
