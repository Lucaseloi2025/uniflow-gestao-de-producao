import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import { formatSeconds, getOrderCuttingQty } from '../lib/utils';
import { calculateExecutionTimes } from '../lib/timerUtils';
import type { StageExecution, Order } from '../types';

interface RunningTaskBannerProps {
  execution: StageExecution;
  onNavigate: () => void;
}

export const RunningTaskBanner = ({ execution, onNavigate }: RunningTaskBannerProps) => {
  const [elapsed, setElapsed] = useState(execution.total_time_seconds);

  useEffect(() => {
    if (execution.is_paused || execution.end_time) return;
    
    setElapsed(execution.total_time_seconds);
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [execution]);

  // Try to find the associated order in the global state if possible, or pass it down.
  // For the banner, we just use the execution's base info.
  let targetTime = 0;
  if (execution.stage_meta_diaria) {
    const dailyGoal = execution.stage_meta_diaria;
    const pieces = execution.calculation_type === 'por_pedido' ? 1 : (execution.order_quantity || 1);
    targetTime = Math.ceil((540 * 60) / dailyGoal) * pieces;
  }

  const isLate = targetTime > 0 && elapsed > targetTime;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      onClick={onNavigate}
      className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer transition-colors text-white px-4 py-3 shadow-lg flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Activity size={20} className="animate-pulse text-indigo-200" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate max-w-[150px] sm:max-w-[300px]">
              {execution.order_number} - {execution.client_name}
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
              {execution.stage_name}
            </span>
          </div>
          <span className="text-xs text-indigo-200 flex items-center gap-1">
            <Clock size={12} />
            {formatSeconds(elapsed)}
            {targetTime > 0 && (
              <span className="opacity-75">
                {' '}/ {formatSeconds(targetTime)}
              </span>
            )}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isLate ? (
          <span className="text-xs bg-rose-500/20 text-rose-200 border border-rose-500/30 px-2 py-1 rounded-lg hidden sm:block">
            Atrasado
          </span>
        ) : (
          <span className="text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 px-2 py-1 rounded-lg hidden sm:block">
            No prazo
          </span>
        )}
        <ChevronRight size={20} className="text-indigo-300" />
      </div>
    </motion.div>
  );
};
