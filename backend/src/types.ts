/**
 * Tipos compartidos entre backend y frontend
 * Un Mundo Para Isa - Sistema de Agentes Emergentes
 */

// ============================================
// Constantes del mundo
// ============================================

export const WORLD = {
  WIDTH: 512,
  HEIGHT: 512,
  CHUNK_SIZE: 64,
  TICK_MS: 50,  // 20 ticks por segundo
} as const;

// ============================================
// Tipos de campos
// ============================================

export type FieldType = 
  | 'food'
  | 'water'
  | 'cost'
  | 'danger'
  | 'trees'
  | 'stone'
  | 'trail0'  // Canal de firma 0
  | 'trail1'  // Canal de firma 1
  | 'trail2'  // Canal de firma 2
  | 'trail3'  // Canal de firma 3
  | 'population'
  | 'labor';

// ============================================
// Configuración de campos
// ============================================

export interface FieldConfig {
  diffusion: number;    // 0-1: qué tan rápido se expande
  decay: number;        // 0-1: qué tan rápido desaparece
  maxValue: number;     // Valor máximo permitido
  growthRate?: number;  // Para recursos regenerables
  growthCap?: number;   // Límite de crecimiento
}

export const DEFAULT_FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  food:       { diffusion: 0.01, decay: 0.001, maxValue: 1.0, growthRate: 0.02, growthCap: 0.8 },
  water:      { diffusion: 0.05, decay: 0.0001, maxValue: 1.0 },
  cost:       { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  danger:     { diffusion: 0.1, decay: 0.05, maxValue: 1.0 },
  trees:      { diffusion: 0.005, decay: 0.0001, maxValue: 1.0, growthRate: 0.01, growthCap: 0.9 },
  stone:      { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  trail0:     { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  trail1:     { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  trail2:     { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  trail3:     { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  population: { diffusion: 0.0, decay: 1.0, maxValue: 100 },
  labor:      { diffusion: 0.05, decay: 0.2, maxValue: 10.0 },
};

// ============================================
// Partículas (agentes)
// ============================================

export interface Particle {
  id: number;
  x: number;
  y: number;
  energy: number;           // 0-1: energía vital
  seed: number;             // Semilla genética (define comportamiento)
  alive: boolean;
}

// ============================================
// Configuración de simulación
// ============================================

export interface LifecycleConfig {
  baseMetabolism: number;        // Consumo de energía por tick
  movementCost: number;          // Coste de moverse
  reproductionThreshold: number; // Energía necesaria para reproducirse
  reproductionCost: number;      // Energía gastada al reproducirse
  consumptionEfficiency: number; // Eficiencia al consumir recursos
  mutationRate: number;          // Probabilidad de mutar cada bit del seed
}

export interface GradientWeights {
  food: number;
  water: number;
  trail: number;
  danger: number;
  cost: number;
  crowding: number;  // Peso negativo para evitar zonas densas (population)
  exploration: number; // Bonus por explorar zonas nuevas (bajo trail)
}

export interface SimulationConfig {
  worldWidth: number;
  worldHeight: number;
  tickMs: number;
  seed: number;
  lifecycle: LifecycleConfig;
  weights: GradientWeights;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  worldWidth: WORLD.WIDTH,
  worldHeight: WORLD.HEIGHT,
  tickMs: WORLD.TICK_MS,
  seed: 42,
  lifecycle: {
    baseMetabolism: 0.002,
    movementCost: 0.001,
    reproductionThreshold: 0.8,
    reproductionCost: 0.4,
    consumptionEfficiency: 0.7,
    mutationRate: 0.01,
  },
  weights: {
    food: 1.0,
    water: 0.5,
    trail: 0.2,     // Reducido para menos agrupamiento
    danger: -2.0,
    cost: -0.5,
    crowding: -0.8, // Evitar zonas densas (fuerte presión de dispersión)
    exploration: 0.4, // Bonus por zonas nuevas (bajo trail)
  },
};

// ============================================
// Métricas
// ============================================

export interface SimulationMetrics {
  tick: number;
  tickTimeMs: number;
  particleCount: number;
  totalDensity: number;
  activeChunks: number;
  fieldAverages: Record<FieldType, number>;
  births: number;
  deaths: number;
}

// ============================================
// Utilidades
// ============================================

/**
 * Convertir coordenadas 2D a índice linear
 */
export function idx(x: number, y: number, width: number = WORLD.WIDTH): number {
  return y * width + x;
}

/**
 * Convertir índice linear a coordenadas 2D
 */
export function fromIdx(i: number, width: number = WORLD.WIDTH): { x: number; y: number } {
  return {
    x: i % width,
    y: Math.floor(i / width),
  };
}

// ============================================
// Mensajes WebSocket
// ============================================

export type ServerMessageType = 
  | 'init'
  | 'tick'
  | 'metrics'
  | 'field_update'
  | 'particles_update'
  | 'chunk_data'      // Datos de chunks generados
  | 'chunk_unload'    // Notificar que chunk fue descargado
  | 'error';

export type ClientMessageType = 
  | 'start'
  | 'pause'
  | 'resume'
  | 'reset'
  | 'set_config'
  | 'spawn_particles'
  | 'subscribe_field'
  | 'request_chunks'       // Solicitar chunks por viewport
  | 'viewport_update';      // Actualizar posición/zoom de cámara

export interface ServerMessage {
  type: ServerMessageType;
  tick?: number;
  particles?: Particle[];
  fields?: Partial<Record<FieldType, ArrayBuffer>>;
  metrics?: SimulationMetrics;
  config?: SimulationConfig;
  error?: string;
  chunks?: ChunkSnapshot[];  // Datos de chunks
}

export interface ClientMessage {
  type: ClientMessageType;
  config?: Partial<SimulationConfig>;
  spawn?: { x: number; y: number; count: number };
  subscribeFields?: FieldType[];
  viewport?: ViewportData;    // Datos de viewport para chunks
  chunkRequests?: ChunkCoord[]; // Chunks específicos a solicitar
}

// ============================================
// Chunks dinámicos
// ============================================

export interface ChunkCoord {
  cx: number;  // Coordenada X del chunk (puede ser negativa)
  cy: number;  // Coordenada Y del chunk (puede ser negativa)
}

export interface ViewportData {
  centerX: number;  // Centro del viewport en coordenadas mundo
  centerY: number;
  zoom: number;     // Nivel de zoom (1 = normal)
  width: number;    // Ancho del viewport en pixels
  height: number;   // Alto del viewport en pixels
}

export interface ChunkSnapshot {
  cx: number;
  cy: number;
  worldX: number;
  worldY: number;
  size: number;
  fields: Partial<Record<FieldType, ArrayBuffer>>;
  generated: boolean;  // true si se acaba de generar
}

export interface FieldSnapshot {
  type: FieldType;
  width: number;
  height: number;
  data: Float32Array;
}

export interface WorldState {
  tick: number;
  particles: Particle[];
  fields: Record<FieldType, Float32Array>;
}
