export interface ExecutionActivity {
  user_id: number;
  stage_id: number;
  end_time: string;
  quantity: number;
}

export interface GoalConfig {
  stage_id: number;
  user_id?: number | null;
  meta_diaria: number | null;
}

export const GOAL_THRESHOLDS = {
  GREEN: 1.0,
  YELLOW: 0.7
};

/**
 * Returns the status color/label based on the goal accomplishment percentage.
 */
export function getGoalStatus(percentage: number | null): 'verde' | 'amarelo' | 'vermelho' | 'sem_meta' {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return 'sem_meta';
  }
  if (percentage >= GOAL_THRESHOLDS.GREEN) {
    return 'verde';
  }
  if (percentage >= GOAL_THRESHOLDS.YELLOW) {
    return 'amarelo';
  }
  return 'vermelho';
}

/**
 * Calculates the number of days a collaborator has registered activity (as a proxy for worked days).
 * If no activities are found, it falls back to 1 to avoid division by zero.
 */
export function calculateWorkedDays(
  activities: ExecutionActivity[],
  userId: number,
  startDateStr: string,
  endDateStr: string
): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Filter activities for this user within the date range
  const userActivities = activities.filter(act => {
    if (act.user_id !== userId) return false;
    const actDate = new Date(act.end_time);
    return actDate >= start && actDate <= end;
  });

  if (userActivities.length === 0) {
    return 1; // Fallback proxy: at least 1 day expected/worked to avoid 0 days multiplication
  }

  // Get unique calendar dates (YYYY-MM-DD) of activity
  const activeDates = new Set<string>();
  userActivities.forEach(act => {
    const actDate = new Date(act.end_time);
    // Convert to simple YYYY-MM-DD local format
    const year = actDate.getFullYear();
    const month = String(actDate.getMonth() + 1).padStart(2, '0');
    const day = String(actDate.getDate()).padStart(2, '0');
    activeDates.add(`${year}-${month}-${day}`);
  });

  return activeDates.size;
}

/**
 * Calculates the expected days of work for a given period.
 * Currently, since there is no attendance/shift planning data, we use the active worked days as a proxy
 * to prevent distortion (e.g. penalizing a user who only worked 2 days this week with a 5-day goal).
 * This function is isolated so that a future attendance database can be easily plugged in.
 */
export function getExpectedDaysForPeriod(
  period: 'hoje' | 'semana' | 'mes',
  workedDaysCount: number
): number {
  // Currently, we use the workedDaysCount directly to prevent distortion.
  // In the future, this can query a table of scheduled shifts/presences.
  if (period === 'hoje') {
    return 1;
  }
  return workedDaysCount > 0 ? workedDaysCount : 1;
}

/**
 * Resolves the active goal for a collaborator at a stage.
 * If there is an individual override, it is used. Otherwise, it inherits the stage's default goal.
 */
export function resolveGoal(
  stageGoalDefault: number | null | undefined,
  collaboratorOverrides: GoalConfig[],
  userId: number,
  stageId: number
): number | null {
  const override = collaboratorOverrides.find(
    g => g.user_id === userId && g.stage_id === stageId
  );
  if (override && override.meta_diaria !== null && override.meta_diaria !== undefined) {
    return override.meta_diaria;
  }
  return stageGoalDefault !== undefined ? stageGoalDefault : null;
}
