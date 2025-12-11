import { Logger } from "../utils/Logger";

/**
 * Scheduler - Sistema de actualización multi-rate
 * FAST: Cada tick (partículas, trails)
 * MEDIUM: Cada 5 ticks (difusión, decay)
 * SLOW: Cada 20 ticks (crecimiento, termostatos)
 */

export const UpdateRate = {
  FAST: "FAST",
  MEDIUM: "MEDIUM",
  SLOW: "SLOW",
} as const;
export type UpdateRate = (typeof UpdateRate)[keyof typeof UpdateRate];

export interface ScheduledTask {
  id: string;
  rate: UpdateRate;
  fn: () => void;
  priority: number;
  budgetMs?: number;
  lastRun?: number;
  avgTime?: number;
}

export interface SchedulerConfig {
  fastInterval: number;
  mediumInterval: number;
  slowInterval: number;
  maxTickBudgetMs: number;
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  fastInterval: 1,
  mediumInterval: 5,
  slowInterval: 20,
  maxTickBudgetMs: 100,
};

/**
 * Scheduler - Orquestador de actualizaciones
 */
export class Scheduler {
  readonly config: SchedulerConfig;

  private tasks: Map<string, ScheduledTask> = new Map();
  private tick = 0;

  private lastTickTime = 0;
  private tickTimes: number[] = [];
  private readonly METRICS_WINDOW = 100;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  /**
   * Registrar una tarea
   */
  register(task: ScheduledTask): void {
    this.tasks.set(task.id, {
      ...task,
      lastRun: 0,
      avgTime: 0,
    });
  }

  /**
   * Desregistrar una tarea
   */
  unregister(id: string): void {
    this.tasks.delete(id);
  }

  /**
   * Ejecutar un tick del scheduler
   */
  step(): SchedulerMetrics {
    const startTime = performance.now();
    const budget = this.config.maxTickBudgetMs;

    let tasksRun = 0;
    let fastRun = 0;
    let mediumRun = 0;
    let slowRun = 0;

    const runFast = this.tick % this.config.fastInterval === 0;
    const runMedium = this.tick % this.config.mediumInterval === 0;
    const runSlow = this.tick % this.config.slowInterval === 0;

    const sortedTasks = Array.from(this.tasks.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const task of sortedTasks) {
      const shouldRun =
        (task.rate === UpdateRate.FAST && runFast) ||
        (task.rate === UpdateRate.MEDIUM && runMedium) ||
        (task.rate === UpdateRate.SLOW && runSlow);

      if (!shouldRun) continue;

      const elapsed = performance.now() - startTime;
      if (elapsed > budget) {
        Logger.warn(
          `[Scheduler] Budget exceeded at tick ${this.tick}, skipping remaining tasks`,
        );
        break;
      }

      const taskStart = performance.now();
      try {
        task.fn();
        tasksRun++;

        if (task.rate === UpdateRate.FAST) fastRun++;
        else if (task.rate === UpdateRate.MEDIUM) mediumRun++;
        else if (task.rate === UpdateRate.SLOW) slowRun++;
      } catch (e) {
        Logger.error(`[Scheduler] Error in task ${task.id}:`, e);
      }
      const taskEnd = performance.now();

      task.lastRun = this.tick;
      const taskTime = taskEnd - taskStart;
      task.avgTime = task.avgTime
        ? task.avgTime * 0.9 + taskTime * 0.1
        : taskTime;
    }

    const endTime = performance.now();
    this.lastTickTime = endTime - startTime;

    this.tickTimes.push(this.lastTickTime);
    if (this.tickTimes.length > this.METRICS_WINDOW) {
      this.tickTimes.shift();
    }

    this.tick++;

    return {
      tick: this.tick,
      tickTimeMs: this.lastTickTime,
      tasksRun,
      fastRun,
      mediumRun,
      slowRun,
      budgetUsed: this.lastTickTime / budget,
    };
  }

  /**
   * Obtener tick actual
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * Obtener tiempo promedio de tick
   */
  getAverageTickTime(): number {
    if (this.tickTimes.length === 0) return 0;
    return this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length;
  }

  /**
   * Obtener percentil de tiempo de tick
   */
  getTickTimePercentile(p: number): number {
    if (this.tickTimes.length === 0) return 0;
    const sorted = [...this.tickTimes].sort((a, b) => a - b);
    const idx = Math.floor((sorted.length * p) / 100);
    return sorted[idx];
  }

  /**
   * Obtener tareas más lentas
   */
  getSlowestTasks(n: number = 5): Array<{ id: string; avgTime: number }> {
    return Array.from(this.tasks.values())
      .filter((t) => t.avgTime !== undefined && t.avgTime > 0)
      .sort((a, b) => (b.avgTime || 0) - (a.avgTime || 0))
      .slice(0, n)
      .map((t) => ({ id: t.id, avgTime: t.avgTime || 0 }));
  }

  /**
   * Resetear scheduler
   */
  reset(): void {
    this.tick = 0;
    this.tickTimes = [];
    for (const task of this.tasks.values()) {
      task.lastRun = 0;
      task.avgTime = 0;
    }
  }

  /**
   * Obtener estadísticas completas
   */
  getStats(): SchedulerStats {
    return {
      tick: this.tick,
      registeredTasks: this.tasks.size,
      avgTickTimeMs: this.getAverageTickTime(),
      p95TickTimeMs: this.getTickTimePercentile(95),
      slowestTasks: this.getSlowestTasks(),
    };
  }
}

export interface SchedulerMetrics {
  tick: number;
  tickTimeMs: number;
  tasksRun: number;
  fastRun: number;
  mediumRun: number;
  slowRun: number;
  budgetUsed: number;
}

export interface SchedulerStats {
  tick: number;
  registeredTasks: number;
  avgTickTimeMs: number;
  p95TickTimeMs: number;
  slowestTasks: Array<{ id: string; avgTime: number }>;
}
