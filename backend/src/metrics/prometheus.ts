/**
 * Prometheus Metrics - Sistema de métricas avanzadas para monitoreo
 * Un Mundo Para Isa V4
 * 
 * Métricas inspiradas en V3 pero adaptadas al paradigma emergente:
 * - Emergencia: complejidad, coherencia, adaptabilidad, entropía, autopoiesis
 * - Biodiversidad: tipos de comportamiento, distribución, mutaciones
 * - Social: comunidades, tensión, conflictos, cooperación
 * - Economía: demanda, stockpiles, flujos de energía
 * - Narrativa: artefactos, eventos, personajes notables
 * - Misiones: activas, completadas, tipos
 * - Tiempo: ciclo día/noche, estaciones
 */

import { Registry, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';

// Crear registro de métricas
export const metricsRegistry = new Registry();

// Recolectar métricas por defecto de Node.js
collectDefaultMetrics({ register: metricsRegistry });

// ============================================
// CORE: Métricas de Simulación Base
// ============================================

export const ticksTotal = new Counter({
  name: 'simulation_ticks_total',
  help: 'Total de ticks de simulación procesados',
  registers: [metricsRegistry],
});

export const particlesActive = new Gauge({
  name: 'simulation_particles_active',
  help: 'Número de partículas vivas en la simulación',
  registers: [metricsRegistry],
});

export const energyAverage = new Gauge({
  name: 'simulation_energy_average',
  help: 'Energía promedio de las partículas',
  registers: [metricsRegistry],
});

export const energyTotal = new Gauge({
  name: 'simulation_energy_total',
  help: 'Energía total en el sistema',
  registers: [metricsRegistry],
});

export const energyDistribution = new Histogram({
  name: 'simulation_energy_distribution',
  help: 'Distribución de energía entre partículas',
  buckets: [10, 25, 50, 75, 100, 150, 200, 300, 500, 1000],
  registers: [metricsRegistry],
});

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

export const tickDuration = new Histogram({
  name: 'simulation_tick_duration_ms',
  help: 'Duración de cada tick en milisegundos',
  buckets: [1, 2, 5, 10, 16, 25, 33, 50, 100, 250],
  registers: [metricsRegistry],
});

export const tickDurationSummary = new Summary({
  name: 'simulation_tick_duration_summary',
  help: 'Resumen estadístico de duración de ticks',
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [metricsRegistry],
});

export const worldAge = new Gauge({
  name: 'simulation_world_age_ticks',
  help: 'Edad del mundo en ticks',
  registers: [metricsRegistry],
});

export const simulationSpeed = new Gauge({
  name: 'simulation_speed_tps',
  help: 'Ticks por segundo actuales',
  registers: [metricsRegistry],
});

// ============================================
// EMERGENCIA: Métricas de Comportamiento Emergente
// ============================================

export const emergenceComplexity = new Gauge({
  name: 'emergence_complexity',
  help: 'Índice de complejidad del sistema (variedad de patrones)',
  registers: [metricsRegistry],
});

export const emergenceCoherence = new Gauge({
  name: 'emergence_coherence',
  help: 'Coherencia del sistema (0-1, qué tan organizados están los patrones)',
  registers: [metricsRegistry],
});

export const emergenceAdaptability = new Gauge({
  name: 'emergence_adaptability',
  help: 'Capacidad de adaptación del sistema ante cambios',
  registers: [metricsRegistry],
});

export const emergenceSustainability = new Gauge({
  name: 'emergence_sustainability',
  help: 'Sostenibilidad del ecosistema actual (0-1)',
  registers: [metricsRegistry],
});

export const emergenceEntropy = new Gauge({
  name: 'emergence_entropy',
  help: 'Entropía del sistema (desorden vs orden)',
  registers: [metricsRegistry],
});

export const emergenceAutopoiesis = new Gauge({
  name: 'emergence_autopoiesis',
  help: 'Índice de auto-organización (capacidad del sistema de regenerarse)',
  registers: [metricsRegistry],
});

export const emergenceNovelty = new Gauge({
  name: 'emergence_novelty',
  help: 'Patrones nuevos detectados en ventana reciente',
  registers: [metricsRegistry],
});

export const emergenceStability = new Gauge({
  name: 'emergence_stability',
  help: 'Estabilidad dinámica del sistema',
  registers: [metricsRegistry],
});

// ============================================
// BIODIVERSIDAD: Tipos de Comportamiento
// ============================================

export const behaviorTypeCount = new Gauge({
  name: 'biodiversity_behavior_type_count',
  help: 'Cantidad de partículas por tipo de comportamiento',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const behaviorTypeRatio = new Gauge({
  name: 'biodiversity_behavior_type_ratio',
  help: 'Proporción de cada tipo de comportamiento',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const biodiversityIndex = new Gauge({
  name: 'biodiversity_shannon_index',
  help: 'Índice de Shannon de biodiversidad (mayor = más diverso)',
  registers: [metricsRegistry],
});

export const speciesRichness = new Gauge({
  name: 'biodiversity_species_richness',
  help: 'Número de tipos de comportamiento distintos activos',
  registers: [metricsRegistry],
});

export const dominantSpecies = new Gauge({
  name: 'biodiversity_dominant_species_ratio',
  help: 'Proporción de la especie dominante',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const mutationsTotal = new Counter({
  name: 'biodiversity_mutations_total',
  help: 'Total de mutaciones de comportamiento observadas',
  labelNames: ['from_type', 'to_type'],
  registers: [metricsRegistry],
});

export const extinctionRisk = new Gauge({
  name: 'biodiversity_extinction_risk',
  help: 'Riesgo de extinción por tipo (0-1)',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// ============================================
// SOCIAL: Métricas de Comunidades y Relaciones
// ============================================

export const communitiesTotal = new Gauge({
  name: 'social_communities_total',
  help: 'Número total de comunidades detectadas',
  registers: [metricsRegistry],
});

export const communitySize = new Histogram({
  name: 'social_community_size',
  help: 'Distribución de tamaños de comunidades',
  buckets: [2, 5, 10, 20, 50, 100, 200, 500],
  registers: [metricsRegistry],
});

export const communityStability = new Gauge({
  name: 'social_community_stability',
  help: 'Estabilidad promedio de comunidades (0-1)',
  registers: [metricsRegistry],
});

export const socialCohesion = new Gauge({
  name: 'social_cohesion',
  help: 'Cohesión social global (0-1)',
  registers: [metricsRegistry],
});

export const socialTension = new Gauge({
  name: 'social_tension',
  help: 'Tensión social global (0-1)',
  registers: [metricsRegistry],
});

export const conflictsActive = new Gauge({
  name: 'social_conflicts_active',
  help: 'Conflictos activos entre partículas/comunidades',
  registers: [metricsRegistry],
});

export const conflictsResolved = new Counter({
  name: 'social_conflicts_resolved_total',
  help: 'Total de conflictos resueltos',
  labelNames: ['resolution_type'],
  registers: [metricsRegistry],
});

export const cooperationEvents = new Counter({
  name: 'social_cooperation_events_total',
  help: 'Total de eventos de cooperación',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const relationshipsTotal = new Gauge({
  name: 'social_relationships_total',
  help: 'Número total de relaciones entre partículas',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const groupsFormed = new Counter({
  name: 'social_groups_formed_total',
  help: 'Total de grupos formados',
  registers: [metricsRegistry],
});

export const groupsDissolved = new Counter({
  name: 'social_groups_dissolved_total',
  help: 'Total de grupos disueltos',
  registers: [metricsRegistry],
});

// ============================================
// ECONOMÍA: Flujos de Recursos y Energía
// ============================================

export const resourceDemand = new Gauge({
  name: 'economy_resource_demand',
  help: 'Demanda actual de recursos/energía',
  labelNames: ['resource_type'],
  registers: [metricsRegistry],
});

export const resourceSupply = new Gauge({
  name: 'economy_resource_supply',
  help: 'Oferta actual de recursos/energía',
  labelNames: ['resource_type'],
  registers: [metricsRegistry],
});

export const resourceBalance = new Gauge({
  name: 'economy_resource_balance',
  help: 'Balance oferta-demanda',
  labelNames: ['resource_type'],
  registers: [metricsRegistry],
});

export const energyFlow = new Gauge({
  name: 'economy_energy_flow',
  help: 'Flujo neto de energía por tick',
  registers: [metricsRegistry],
});

export const energyProduction = new Counter({
  name: 'economy_energy_production_total',
  help: 'Total de energía producida (comida, fotosíntesis, etc)',
  labelNames: ['source'],
  registers: [metricsRegistry],
});

export const energyConsumption = new Counter({
  name: 'economy_energy_consumption_total',
  help: 'Total de energía consumida',
  labelNames: ['activity'],
  registers: [metricsRegistry],
});

export const stockpiles = new Gauge({
  name: 'economy_stockpiles',
  help: 'Recursos almacenados',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const tradeEvents = new Counter({
  name: 'economy_trade_events_total',
  help: 'Intercambios de recursos entre partículas',
  registers: [metricsRegistry],
});

export const scarcityIndex = new Gauge({
  name: 'economy_scarcity_index',
  help: 'Índice de escasez global (0=abundancia, 1=escasez extrema)',
  registers: [metricsRegistry],
});

// ============================================
// NARRATIVA: Eventos, Artefactos y Personajes
// ============================================

export const narrativeEventsTotal = new Counter({
  name: 'narrative_events_total',
  help: 'Total de eventos narrativos generados',
  labelNames: ['type', 'severity'],
  registers: [metricsRegistry],
});

export const artifactsDiscovered = new Counter({
  name: 'narrative_artifacts_discovered_total',
  help: 'Total de artefactos descubiertos',
  labelNames: ['rarity'],
  registers: [metricsRegistry],
});

export const artifactsActive = new Gauge({
  name: 'narrative_artifacts_active',
  help: 'Artefactos activos en el mundo',
  registers: [metricsRegistry],
});

export const notableCharacters = new Gauge({
  name: 'narrative_notable_characters',
  help: 'Personajes notables vivos',
  labelNames: ['archetype'],
  registers: [metricsRegistry],
});

export const legendsGenerated = new Counter({
  name: 'narrative_legends_generated_total',
  help: 'Leyendas y mitos generados',
  registers: [metricsRegistry],
});

export const storiesActive = new Gauge({
  name: 'narrative_stories_active',
  help: 'Historias/arcos narrativos en progreso',
  registers: [metricsRegistry],
});

// ============================================
// MISIONES/QUESTS: Sistema de Misiones Emergentes
// ============================================

export const questsActive = new Gauge({
  name: 'quests_active',
  help: 'Misiones activas',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const questsCompleted = new Counter({
  name: 'quests_completed_total',
  help: 'Misiones completadas',
  labelNames: ['type', 'outcome'],
  registers: [metricsRegistry],
});

export const questsFailed = new Counter({
  name: 'quests_failed_total',
  help: 'Misiones fallidas',
  labelNames: ['type', 'reason'],
  registers: [metricsRegistry],
});

export const questsDuration = new Histogram({
  name: 'quests_duration_ticks',
  help: 'Duración de misiones en ticks',
  buckets: [100, 500, 1000, 5000, 10000, 50000],
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const questsProgress = new Gauge({
  name: 'quests_average_progress',
  help: 'Progreso promedio de misiones activas (0-1)',
  registers: [metricsRegistry],
});

// ============================================
// TIEMPO: Ciclo Día/Noche y Estaciones
// ============================================

export const timeOfDay = new Gauge({
  name: 'time_of_day',
  help: 'Hora del día (0=medianoche, 0.5=mediodía)',
  registers: [metricsRegistry],
});

export const dayNumber = new Gauge({
  name: 'time_day_number',
  help: 'Número de día actual',
  registers: [metricsRegistry],
});

export const timePhase = new Gauge({
  name: 'time_phase',
  help: 'Fase del día (0=noche, 1=amanecer, 2=día, 3=atardecer)',
  registers: [metricsRegistry],
});

export const seasonCurrent = new Gauge({
  name: 'time_season',
  help: 'Estación actual (0=primavera, 1=verano, 2=otoño, 3=invierno)',
  registers: [metricsRegistry],
});

export const seasonProgress = new Gauge({
  name: 'time_season_progress',
  help: 'Progreso en la estación actual (0-1)',
  registers: [metricsRegistry],
});

export const lunarPhase = new Gauge({
  name: 'time_lunar_phase',
  help: 'Fase lunar (0=nueva, 0.5=llena)',
  registers: [metricsRegistry],
});

// ============================================
// CAMPOS: Métricas del Sistema de Campos
// ============================================

export const fieldIntensityAvg = new Gauge({
  name: 'fields_intensity_average',
  help: 'Intensidad promedio del campo',
  labelNames: ['field_type'],
  registers: [metricsRegistry],
});

export const fieldIntensityMax = new Gauge({
  name: 'fields_intensity_max',
  help: 'Intensidad máxima del campo',
  labelNames: ['field_type'],
  registers: [metricsRegistry],
});

export const fieldCoverage = new Gauge({
  name: 'fields_coverage_ratio',
  help: 'Cobertura del campo (0-1)',
  labelNames: ['field_type'],
  registers: [metricsRegistry],
});

export const fieldGradientStrength = new Gauge({
  name: 'fields_gradient_strength',
  help: 'Fuerza promedio del gradiente del campo',
  labelNames: ['field_type'],
  registers: [metricsRegistry],
});

export const fieldDecayRate = new Gauge({
  name: 'fields_decay_rate',
  help: 'Tasa de decaimiento del campo',
  labelNames: ['field_type'],
  registers: [metricsRegistry],
});

// ============================================
// CHUNKS: Métricas del Sistema de Chunks
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

export const chunksLoaded = new Counter({
  name: 'world_chunks_loaded_total',
  help: 'Total de chunks cargados desde persistencia',
  registers: [metricsRegistry],
});

export const chunksEvicted = new Counter({
  name: 'world_chunks_evicted_total',
  help: 'Total de chunks evictos de memoria',
  registers: [metricsRegistry],
});

export const chunkDensity = new Histogram({
  name: 'world_chunk_density',
  help: 'Distribución de densidad de partículas por chunk',
  buckets: [1, 5, 10, 25, 50, 100, 200, 500],
  registers: [metricsRegistry],
});

// ============================================
// WEBSOCKET: Métricas de Comunicación
// ============================================

export const wsConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Conexiones WebSocket activas',
  registers: [metricsRegistry],
});

export const wsMessagesReceived = new Counter({
  name: 'websocket_messages_received_total',
  help: 'Total de mensajes WebSocket recibidos',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const wsMessagesSent = new Counter({
  name: 'websocket_messages_sent_total',
  help: 'Total de mensajes WebSocket enviados',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const wsMessageSize = new Histogram({
  name: 'websocket_message_size_bytes',
  help: 'Tamaño de mensajes WebSocket',
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
  labelNames: ['direction'],
  registers: [metricsRegistry],
});

export const wsLatency = new Histogram({
  name: 'websocket_latency_ms',
  help: 'Latencia de comunicación WebSocket',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

// ============================================
// ESTRUCTURAS: Construcciones y Edificios
// ============================================

export const structuresTotal = new Gauge({
  name: 'simulation_structures_total',
  help: 'Total de estructuras construidas',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const structuresBuilt = new Counter({
  name: 'simulation_structures_built_total',
  help: 'Total de estructuras construidas históricamente',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const structuresDestroyed = new Counter({
  name: 'simulation_structures_destroyed_total',
  help: 'Total de estructuras destruidas',
  labelNames: ['type', 'cause'],
  registers: [metricsRegistry],
});

export const structuresHealth = new Gauge({
  name: 'simulation_structures_health_avg',
  help: 'Salud promedio de estructuras (0-1)',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// ============================================
// SCHEDULER: Métricas del Planificador
// ============================================

export const schedulerTasksRun = new Counter({
  name: 'scheduler_tasks_run_total',
  help: 'Total de tareas ejecutadas por el scheduler',
  labelNames: ['rate', 'system'],
  registers: [metricsRegistry],
});

export const schedulerBudgetUsed = new Gauge({
  name: 'scheduler_budget_used_ratio',
  help: 'Ratio del presupuesto de tiempo usado (0-1)',
  registers: [metricsRegistry],
});

export const schedulerTaskDuration = new Histogram({
  name: 'scheduler_task_duration_ms',
  help: 'Duración de tareas del scheduler',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50],
  labelNames: ['system'],
  registers: [metricsRegistry],
});

export const schedulerQueueDepth = new Gauge({
  name: 'scheduler_queue_depth',
  help: 'Profundidad de la cola del scheduler',
  labelNames: ['priority'],
  registers: [metricsRegistry],
});

// ============================================
// PERSISTENCIA: Métricas de Save/Load
// ============================================

export const saveOperations = new Counter({
  name: 'persistence_save_operations_total',
  help: 'Total de operaciones de guardado',
  labelNames: ['type', 'result'],
  registers: [metricsRegistry],
});

export const loadOperations = new Counter({
  name: 'persistence_load_operations_total',
  help: 'Total de operaciones de carga',
  labelNames: ['type', 'result'],
  registers: [metricsRegistry],
});

export const saveDuration = new Histogram({
  name: 'persistence_save_duration_ms',
  help: 'Duración de operaciones de guardado',
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  labelNames: ['type'],
  registers: [metricsRegistry],
});

export const saveSize = new Histogram({
  name: 'persistence_save_size_bytes',
  help: 'Tamaño de archivos de guardado',
  buckets: [1024, 10240, 102400, 1048576, 10485760],
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// ============================================
// Tipos para la actualización de métricas
// ============================================

export interface SimulationMetricsData {
  tick: number;
  particles: number;
  avgEnergy: number;
  totalEnergy: number;
  births: number;
  deaths: number;
  tickTimeMs: number;
  chunksActive?: number;
  chunksCached?: number;
  structures?: Record<string, number>;
  schedulerBudget?: number;
  schedulerTasks?: { fast: number; medium: number; slow: number };
}

export interface EmergenceMetricsData {
  complexity: number;
  coherence: number;
  adaptability: number;
  sustainability: number;
  entropy: number;
  autopoiesis: number;
  novelty: number;
  stability: number;
}

export interface BiodiversityMetricsData {
  behaviorCounts: Record<string, number>;
  shannonIndex: number;
  speciesRichness: number;
  dominantType: string;
  dominantRatio: number;
}

export interface SocialMetricsData {
  communities: number;
  communitySizes: number[];
  communityStability: number;
  cohesion: number;
  tension: number;
  conflictsActive: number;
  relationships: Record<string, number>;
}

export interface EconomyMetricsData {
  energyFlow: number;
  scarcityIndex: number;
  stockpiles: Record<string, number>;
  production: Record<string, number>;
  consumption: Record<string, number>;
}

export interface TimeMetricsData {
  timeOfDay: number;
  dayNumber: number;
  phase: number;
  season: number;
  seasonProgress: number;
  lunarPhase: number;
}

export interface QuestMetricsData {
  active: Record<string, number>;
  progress: number;
}

export interface FieldMetricsData {
  fieldType: string;
  avgIntensity: number;
  maxIntensity: number;
  coverage: number;
  gradientStrength: number;
  decayRate: number;
}

// ============================================
// Funciones de actualización de métricas
// ============================================

export function updateSimulationMetrics(data: SimulationMetricsData): void {
  ticksTotal.inc();
  worldAge.set(data.tick);
  particlesActive.set(data.particles);
  energyAverage.set(data.avgEnergy);
  energyTotal.set(data.totalEnergy);
  
  if (data.births > 0) birthsTotal.inc(data.births);
  if (data.deaths > 0) deathsTotal.inc(data.deaths);
  
  tickDuration.observe(data.tickTimeMs);
  tickDurationSummary.observe(data.tickTimeMs);
  
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
}

export function updateEmergenceMetrics(data: EmergenceMetricsData): void {
  emergenceComplexity.set(data.complexity);
  emergenceCoherence.set(data.coherence);
  emergenceAdaptability.set(data.adaptability);
  emergenceSustainability.set(data.sustainability);
  emergenceEntropy.set(data.entropy);
  emergenceAutopoiesis.set(data.autopoiesis);
  emergenceNovelty.set(data.novelty);
  emergenceStability.set(data.stability);
}

export function updateBiodiversityMetrics(data: BiodiversityMetricsData): void {
  const total = Object.values(data.behaviorCounts).reduce((a, b) => a + b, 0);
  
  for (const [type, count] of Object.entries(data.behaviorCounts)) {
    behaviorTypeCount.labels(type).set(count);
    behaviorTypeRatio.labels(type).set(total > 0 ? count / total : 0);
  }
  
  biodiversityIndex.set(data.shannonIndex);
  speciesRichness.set(data.speciesRichness);
  dominantSpecies.labels(data.dominantType).set(data.dominantRatio);
}

export function updateSocialMetrics(data: SocialMetricsData): void {
  communitiesTotal.set(data.communities);
  
  for (const size of data.communitySizes) {
    communitySize.observe(size);
  }
  
  communityStability.set(data.communityStability);
  socialCohesion.set(data.cohesion);
  socialTension.set(data.tension);
  conflictsActive.set(data.conflictsActive);
  
  for (const [type, count] of Object.entries(data.relationships)) {
    relationshipsTotal.labels(type).set(count);
  }
}

export function updateEconomyMetrics(data: EconomyMetricsData): void {
  energyFlow.set(data.energyFlow);
  scarcityIndex.set(data.scarcityIndex);
  
  for (const [type, amount] of Object.entries(data.stockpiles)) {
    stockpiles.labels(type).set(amount);
  }
}

export function updateTimeMetrics(data: TimeMetricsData): void {
  timeOfDay.set(data.timeOfDay);
  dayNumber.set(data.dayNumber);
  timePhase.set(data.phase);
  seasonCurrent.set(data.season);
  seasonProgress.set(data.seasonProgress);
  lunarPhase.set(data.lunarPhase);
}

export function updateQuestMetrics(data: QuestMetricsData): void {
  for (const [type, count] of Object.entries(data.active)) {
    questsActive.labels(type).set(count);
  }
  questsProgress.set(data.progress);
}

export function updateFieldMetrics(data: FieldMetricsData): void {
  fieldIntensityAvg.labels(data.fieldType).set(data.avgIntensity);
  fieldIntensityMax.labels(data.fieldType).set(data.maxIntensity);
  fieldCoverage.labels(data.fieldType).set(data.coverage);
  fieldGradientStrength.labels(data.fieldType).set(data.gradientStrength);
  fieldDecayRate.labels(data.fieldType).set(data.decayRate);
}

// ============================================
// Helpers para incrementar contadores
// ============================================

export function recordBirth(): void {
  birthsTotal.inc();
}

export function recordDeath(): void {
  deathsTotal.inc();
}

export function recordChunkGenerated(): void {
  chunksGenerated.inc();
}

export function recordChunkLoaded(): void {
  chunksLoaded.inc();
}

export function recordChunkEvicted(): void {
  chunksEvicted.inc();
}

export function recordMutation(fromType: string, toType: string): void {
  mutationsTotal.labels(fromType, toType).inc();
}

export function recordConflictResolved(resolutionType: string): void {
  conflictsResolved.labels(resolutionType).inc();
}

export function recordCooperation(type: string): void {
  cooperationEvents.labels(type).inc();
}

export function recordGroupFormed(): void {
  groupsFormed.inc();
}

export function recordGroupDissolved(): void {
  groupsDissolved.inc();
}

export function recordNarrativeEvent(type: string, severity: string): void {
  narrativeEventsTotal.labels(type, severity).inc();
}

export function recordArtifactDiscovered(rarity: string): void {
  artifactsDiscovered.labels(rarity).inc();
}

export function recordLegendGenerated(): void {
  legendsGenerated.inc();
}

export function recordQuestCompleted(type: string, outcome: string): void {
  questsCompleted.labels(type, outcome).inc();
}

export function recordQuestFailed(type: string, reason: string): void {
  questsFailed.labels(type, reason).inc();
}

export function recordStructureBuilt(type: string): void {
  structuresBuilt.labels(type).inc();
}

export function recordStructureDestroyed(type: string, cause: string): void {
  structuresDestroyed.labels(type, cause).inc();
}

export function recordSaveOperation(type: string, result: string, durationMs: number, sizeBytes: number): void {
  saveOperations.labels(type, result).inc();
  saveDuration.labels(type).observe(durationMs);
  saveSize.labels(type).observe(sizeBytes);
}

export function recordLoadOperation(type: string, result: string): void {
  loadOperations.labels(type, result).inc();
}

export function recordTrade(): void {
  tradeEvents.inc();
}

export function recordWsMessage(direction: 'sent' | 'received', type: string, sizeBytes: number): void {
  if (direction === 'sent') {
    wsMessagesSent.labels(type).inc();
  } else {
    wsMessagesReceived.labels(type).inc();
  }
  wsMessageSize.labels(direction).observe(sizeBytes);
}

export function recordWsLatency(latencyMs: number): void {
  wsLatency.observe(latencyMs);
}

export function recordSchedulerTask(rate: string, system: string, durationMs: number): void {
  schedulerTasksRun.labels(rate, system).inc();
  schedulerTaskDuration.labels(system).observe(durationMs);
}

export function recordEnergyDistribution(energyValues: number[]): void {
  for (const energy of energyValues) {
    energyDistribution.observe(energy);
  }
}

export function recordChunkDensity(density: number): void {
  chunkDensity.observe(density);
}

/**
 * Obtener métricas en formato Prometheus
 */
export async function getMetrics(): Promise<string> {
  return await metricsRegistry.metrics();
}

/**
 * Resetear métricas (para testing)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}
