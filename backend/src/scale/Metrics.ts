/**
 * Metrics.ts - Sistema de Métricas y Dashboard
 *
 * Recopila, agrega y expone métricas del sistema para
 * monitoreo y debugging.
 */

export interface MetricSample {
  value: number;
  timestamp: number;
}

export enum MetricType {
  GAUGE = "gauge",
  COUNTER = "counter",
  HISTOGRAM = "histogram",
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface MetricSnapshot {
  name: string;
  type: MetricType;
  value: number;
  min?: number;
  max?: number;
  avg?: number;
  samples?: number;
  histogram?: HistogramBucket[];
  timestamp: number;
}

export interface DashboardData {
  simulation: {
    tick: number;
    tickTime: number;
    fps: number;
    uptime: number;
  };
  population: {
    total: number;
    births: number;
    deaths: number;
    density: number;
    avgEnergy: number;
    avgAge: number;
  };
  economy: {
    totalFood: number;
    totalWater: number;
    demandSatisfaction: number;
    activeReactions: number;
    carrierEfficiency: number;
  };
  social: {
    communities: number;
    avgTension: number;
    activeConflicts: number;
    largestCommunity: number;
  };
  performance: {
    memoryUsage: number;
    cpuLoad: number;
    wsClients: number;
    msgPerSecond: number;
  };
}

/**
 * Métrica individual con historial
 */
class Metric {
  private samples: MetricSample[] = [];
  private maxSamples: number;
  private definition: MetricDefinition;
  private histogramBuckets?: number[];
  private histogramCounts?: number[];

  constructor(definition: MetricDefinition, maxSamples: number = 100) {
    this.definition = definition;
    this.maxSamples = maxSamples;

    if (definition.type === MetricType.HISTOGRAM) {
      this.histogramBuckets = [
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
      ];
      this.histogramCounts = new Array(this.histogramBuckets.length + 1).fill(
        0,
      );
    }
  }

  record(value: number, timestamp: number = Date.now()): void {
    this.samples.push({ value, timestamp });

    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    if (
      this.definition.type === MetricType.HISTOGRAM &&
      this.histogramBuckets &&
      this.histogramCounts
    ) {
      for (let i = 0; i < this.histogramBuckets.length; i++) {
        if (value <= this.histogramBuckets[i]) {
          this.histogramCounts[i]++;
          return;
        }
      }
      this.histogramCounts[this.histogramCounts.length - 1]++;
    }
  }

  increment(delta: number = 1): void {
    const last =
      this.samples.length > 0 ? this.samples[this.samples.length - 1].value : 0;
    this.record(last + delta);
  }

  getSnapshot(): MetricSnapshot {
    if (this.samples.length === 0) {
      return {
        name: this.definition.name,
        type: this.definition.type,
        value: 0,
        timestamp: Date.now(),
      };
    }

    const values = this.samples.map((s) => s.value);
    const latest = this.samples[this.samples.length - 1];

    const snapshot: MetricSnapshot = {
      name: this.definition.name,
      type: this.definition.type,
      value: latest.value,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      samples: this.samples.length,
      timestamp: latest.timestamp,
    };

    if (
      this.definition.type === MetricType.HISTOGRAM &&
      this.histogramBuckets &&
      this.histogramCounts
    ) {
      snapshot.histogram = this.histogramBuckets.map((le, i) => ({
        le,
        count: this.histogramCounts![i],
      }));
    }

    return snapshot;
  }

  getRecentSamples(count: number = 10): MetricSample[] {
    return this.samples.slice(-count);
  }

  reset(): void {
    this.samples = [];
    if (this.histogramCounts) {
      this.histogramCounts.fill(0);
    }
  }
}

/**
 * Sistema central de métricas
 */
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private startTime: number = Date.now();
  private lastDashboard: DashboardData | null = null;

  constructor() {
    this.registerDefaultMetrics();
  }

  /**
   * Registrar métricas por defecto
   */
  private registerDefaultMetrics(): void {
    this.register({
      name: "simulation.tick",
      type: MetricType.COUNTER,
      description: "Current tick number",
    });
    this.register({
      name: "simulation.tick_time_ms",
      type: MetricType.HISTOGRAM,
      description: "Time per tick in ms",
      unit: "ms",
    });
    this.register({
      name: "simulation.fps",
      type: MetricType.GAUGE,
      description: "Frames per second",
    });

    this.register({
      name: "population.total",
      type: MetricType.GAUGE,
      description: "Total particle count",
    });
    this.register({
      name: "population.births",
      type: MetricType.COUNTER,
      description: "Total births",
    });
    this.register({
      name: "population.deaths",
      type: MetricType.COUNTER,
      description: "Total deaths",
    });
    this.register({
      name: "population.density",
      type: MetricType.GAUGE,
      description: "Particles per chunk",
    });
    this.register({
      name: "population.avg_energy",
      type: MetricType.GAUGE,
      description: "Average energy",
    });
    this.register({
      name: "population.avg_age",
      type: MetricType.GAUGE,
      description: "Average age in ticks",
    });

    this.register({
      name: "economy.total_food",
      type: MetricType.GAUGE,
      description: "Total food in world",
    });
    this.register({
      name: "economy.total_water",
      type: MetricType.GAUGE,
      description: "Total water in world",
    });
    this.register({
      name: "economy.demand_satisfaction",
      type: MetricType.GAUGE,
      description: "Demand satisfaction ratio",
    });
    this.register({
      name: "economy.active_reactions",
      type: MetricType.GAUGE,
      description: "Active reactions count",
    });

    this.register({
      name: "social.communities",
      type: MetricType.GAUGE,
      description: "Number of communities",
    });
    this.register({
      name: "social.avg_tension",
      type: MetricType.GAUGE,
      description: "Average tension level",
    });
    this.register({
      name: "social.active_conflicts",
      type: MetricType.GAUGE,
      description: "Active conflicts",
    });

    this.register({
      name: "performance.memory_mb",
      type: MetricType.GAUGE,
      description: "Memory usage in MB",
      unit: "MB",
    });
    this.register({
      name: "performance.ws_clients",
      type: MetricType.GAUGE,
      description: "WebSocket clients connected",
    });
    this.register({
      name: "performance.msg_per_sec",
      type: MetricType.GAUGE,
      description: "Messages per second",
    });
  }

  /**
   * Registrar una nueva métrica
   */
  register(definition: MetricDefinition): void {
    if (!this.metrics.has(definition.name)) {
      this.metrics.set(definition.name, new Metric(definition));
    }
  }

  /**
   * Registrar un valor para una métrica
   */
  record(name: string, value: number): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.record(value);
    }
  }

  /**
   * Incrementar un contador
   */
  increment(name: string, delta: number = 1): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.increment(delta);
    }
  }

  /**
   * Obtener snapshot de una métrica
   */
  getSnapshot(name: string): MetricSnapshot | null {
    const metric = this.metrics.get(name);
    return metric ? metric.getSnapshot() : null;
  }

  /**
   * Obtener todos los snapshots
   */
  getAllSnapshots(): MetricSnapshot[] {
    return Array.from(this.metrics.values()).map((m) => m.getSnapshot());
  }

  /**
   * Actualizar métricas desde estado del mundo
   */
  updateFromWorldState(state: {
    tick: number;
    tickTime: number;
    particleCount: number;
    births: number;
    deaths: number;
    avgEnergy?: number;
    avgAge?: number;
    totalFood?: number;
    totalWater?: number;
    communities?: number;
    avgTension?: number;
    activeConflicts?: number;
    wsClients?: number;
  }): void {
    this.record("simulation.tick", state.tick);
    this.record("simulation.tick_time_ms", state.tickTime);
    this.record("simulation.fps", 1000 / Math.max(1, state.tickTime));

    this.record("population.total", state.particleCount);
    this.increment("population.births", state.births);
    this.increment("population.deaths", state.deaths);

    if (state.avgEnergy !== undefined) {
      this.record("population.avg_energy", state.avgEnergy);
    }
    if (state.avgAge !== undefined) {
      this.record("population.avg_age", state.avgAge);
    }
    if (state.totalFood !== undefined) {
      this.record("economy.total_food", state.totalFood);
    }
    if (state.totalWater !== undefined) {
      this.record("economy.total_water", state.totalWater);
    }
    if (state.communities !== undefined) {
      this.record("social.communities", state.communities);
    }
    if (state.avgTension !== undefined) {
      this.record("social.avg_tension", state.avgTension);
    }
    if (state.activeConflicts !== undefined) {
      this.record("social.active_conflicts", state.activeConflicts);
    }
    if (state.wsClients !== undefined) {
      this.record("performance.ws_clients", state.wsClients);
    }

    if (typeof process !== "undefined" && process.memoryUsage) {
      const mem = process.memoryUsage();
      this.record("performance.memory_mb", mem.heapUsed / 1024 / 1024);
    }
  }

  /**
   * Generar datos de dashboard
   */
  getDashboardData(): DashboardData {
    const getVal = (name: string): number => {
      const snap = this.getSnapshot(name);
      return snap?.value ?? 0;
    };

    const getAvg = (name: string): number => {
      const snap = this.getSnapshot(name);
      return snap?.avg ?? 0;
    };

    this.lastDashboard = {
      simulation: {
        tick: getVal("simulation.tick"),
        tickTime: getAvg("simulation.tick_time_ms"),
        fps: getAvg("simulation.fps"),
        uptime: (Date.now() - this.startTime) / 1000,
      },
      population: {
        total: getVal("population.total"),
        births: getVal("population.births"),
        deaths: getVal("population.deaths"),
        density: getVal("population.density"),
        avgEnergy: getAvg("population.avg_energy"),
        avgAge: getAvg("population.avg_age"),
      },
      economy: {
        totalFood: getVal("economy.total_food"),
        totalWater: getVal("economy.total_water"),
        demandSatisfaction: getVal("economy.demand_satisfaction"),
        activeReactions: getVal("economy.active_reactions"),
        carrierEfficiency: 0,
      },
      social: {
        communities: getVal("social.communities"),
        avgTension: getAvg("social.avg_tension"),
        activeConflicts: getVal("social.active_conflicts"),
        largestCommunity: 0,
      },
      performance: {
        memoryUsage: getVal("performance.memory_mb"),
        cpuLoad: 0,
        wsClients: getVal("performance.ws_clients"),
        msgPerSecond: getVal("performance.msg_per_sec"),
      },
    };

    return this.lastDashboard;
  }

  /**
   * Reset todas las métricas
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
    this.startTime = Date.now();
  }

  /**
   * Exportar métricas en formato Prometheus
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      const snap = metric.getSnapshot();
      const safeName = name.replace(/\./g, "_");

      lines.push(`# HELP ${safeName} Metric ${name}`);
      lines.push(`# TYPE ${safeName} ${snap.type}`);
      lines.push(`${safeName} ${snap.value}`);
    }

    return lines.join("\n");
  }
}

export const metrics = new MetricsCollector();
