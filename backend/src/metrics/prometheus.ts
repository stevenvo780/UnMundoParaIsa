/**
 * Prometheus Metrics - Sistema de métricas para monitoreo
 * Un Mundo Para Isa
 */

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// Crear registro de métricas
export const metricsRegistry = new Registry();

// Recolectar métricas por defecto de Node.js
collectDefaultMetrics({ register: metricsRegistry });

// ============================================
// Métricas de Simulación
// ============================================

// Contador de ticks procesados
export const ticksTotal = new Counter({
  name: 'simulation_ticks_total',
  help: 'Total de ticks de simulación procesados',
  registers: [metricsRegistry],
});

// Gauge de partículas activas
export const particlesActive = new Gauge({
  name: 'simulation_particles_active',
  help: 'Número de partículas vivas en la simulación',
  registers: [metricsRegistry],
});

// Gauge de energía promedio
export const energyAverage = new Gauge({
  name: 'simulation_energy_average',
  help: 'Energía promedio de las partículas',
  registers: [metricsRegistry],
});

// Contadores de nacimientos y muertes
export const birthsTotal = new Counter({
  name: 'simulation_births_total',
  help: 'Total de nacimientos en la simulación',
  registers: [metricsRegistry],
});

export const deathsTotal = new Counter({
  name: 'simulation_deaths_total',
  help: 'Total de muertes en la simulación',
  registers: [metricsRegistry],
});

// Histograma de tiempo de tick
export const tickDuration = new Histogram({
  name: 'simulation_tick_duration_ms',
  help: 'Duración de cada tick en milisegundos',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

// ============================================
// Métricas de Chunks
// ============================================

export const chunksActive = new Gauge({
  name: 'world_chunks_active',
  help: 'Número de chunks activos en memoria',
  registers: [metricsRegistry],
});

export const chunksCached = new Gauge({
  name: 'world_chunks_cached',
  help: 'Número de chunks en caché',
  registers: [metricsRegistry],
});

export const chunksGenerated = new Counter({
  name: 'world_chunks_generated_total',
  help: 'Total de chunks generados',
  registers: [metricsRegistry],
});

// ============================================
// Métricas de WebSocket
// ============================================

export const wsConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Conexiones WebSocket activas',
  registers: [metricsRegistry],
});

export const wsMessagesReceived = new Counter({
  name: 'websocket_messages_received_total',
  help: 'Total de mensajes WebSocket recibidos',
  registers: [metricsRegistry],
});

export const wsMessagesSent = new Counter({
  name: 'websocket_messages_sent_total',
  help: 'Total de mensajes WebSocket enviados',
  registers: [metricsRegistry],
});

// ============================================
// Métricas de Estructuras
// ============================================

export const structuresTotal = new Gauge({
  name: 'simulation_structures_total',
  help: 'Total de estructuras construidas',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// ============================================
// Métricas de Scheduler
// ============================================

export const schedulerTasksRun = new Counter({
  name: 'scheduler_tasks_run_total',
  help: 'Total de tareas ejecutadas por el scheduler',
  labelNames: ['rate'],
  registers: [metricsRegistry],
});

export const schedulerBudgetUsed = new Gauge({
  name: 'scheduler_budget_used_ratio',
  help: 'Ratio del presupuesto de tiempo usado (0-1)',
  registers: [metricsRegistry],
});

// ============================================
// Helper para actualizar métricas desde World
// ============================================

export interface SimulationMetricsData {
  tick: number;
  particles: number;
  avgEnergy: number;
  births: number;
  deaths: number;
  tickTimeMs: number;
  chunksActive?: number;
  chunksCached?: number;
  structures?: Record<string, number>;
  schedulerBudget?: number;
  schedulerTasks?: { fast: number; medium: number; slow: number };
}

export function updateSimulationMetrics(data: SimulationMetricsData): void {
  ticksTotal.inc();
  particlesActive.set(data.particles);
  energyAverage.set(data.avgEnergy);
  
  if (data.births > 0) birthsTotal.inc(data.births);
  if (data.deaths > 0) deathsTotal.inc(data.deaths);
  
  tickDuration.observe(data.tickTimeMs);
  
  if (data.chunksActive !== undefined) chunksActive.set(data.chunksActive);
  if (data.chunksCached !== undefined) chunksCached.set(data.chunksCached);
  
  if (data.structures) {
    for (const [type, count] of Object.entries(data.structures)) {
      structuresTotal.labels(type).set(count);
    }
  }
  
  if (data.schedulerBudget !== undefined) {
    schedulerBudgetUsed.set(data.schedulerBudget);
  }
  
  if (data.schedulerTasks) {
    // Los contadores se incrementan, no se resetean
  }
}

/**
 * Obtener métricas en formato Prometheus
 */
export async function getMetrics(): Promise<string> {
  return await metricsRegistry.metrics();
}
