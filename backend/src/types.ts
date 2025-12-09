/**
 * Tipos compartidos entre backend y frontend
 * Un Mundo Para Isa - Sistema de Agentes Emergentes
 */

export const WORLD = {
  WIDTH: 512,
  HEIGHT: 512,
  CHUNK_SIZE: 64,
  TICK_MS: 50,
  MOVEMENT_SUBSTEPS: 4,
  MAX_VELOCITY: 2.0,
  VELOCITY_DAMPING: 0.85,
} as const;

export type FieldType =
  | "food"
  | "water"
  | "cost"
  | "danger"
  | "trees"
  | "stone"
  | "trail0"
  | "trail1"
  | "trail2"
  | "trail3"
  | "population"
  | "labor";

export interface FieldConfig {
  diffusion: number;
  decay: number;
  maxValue: number;
  growthRate?: number;
  growthCap?: number;
}

export const DEFAULT_FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  food: {
    diffusion: 0.03,
    decay: 0.002,
    maxValue: 1.0,
    growthRate: 0.0,
    growthCap: 0.0,
  },
  water: { diffusion: 0.02, decay: 0.001, maxValue: 1.0 },
  cost: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  danger: { diffusion: 0.1, decay: 0.05, maxValue: 1.0 },
  trees: {
    diffusion: 0.0,
    decay: 0.0,
    maxValue: 1.0,
    growthRate: 0.003,
    growthCap: 1.0,
  },
  stone: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  trail0: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  trail1: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  trail2: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  trail3: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  population: { diffusion: 0.0, decay: 1.0, maxValue: 100 },
  labor: { diffusion: 0.05, decay: 0.2, maxValue: 10.0 },
};

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX?: number;
  targetY?: number;
  energy: number;
  seed: number;
  alive: boolean;
  lastReproductionTick?: number;
}

export interface LifecycleConfig {
  baseMetabolism: number;
  movementCost: number;
  reproductionThreshold: number;
  reproductionCost: number;
  consumptionEfficiency: number;
  mutationRate: number;
}

export interface GradientWeights {
  food: number;
  water: number;
  trail: number;
  danger: number;
  cost: number;
  crowding: number;
  exploration: number;
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
    baseMetabolism: 0.001,
    movementCost: 0.0005,
    reproductionThreshold: 0.7,
    reproductionCost: 0.45,
    consumptionEfficiency: 0.7,
    mutationRate: 0.02,
  },
  weights: {
    food: 3.0,
    water: 0.5,
    trail: 0.1,
    danger: -2.0,
    cost: -0.3,
    crowding: -1.5,
    exploration: 0.8,
  },
};

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

/**
 * Convertir coordenadas 2D a índice linear
 */
export function idx(x: number, y: number, width: number = WORLD.WIDTH): number {
  return y * width + x;
}

/**
 * Convertir índice linear a coordenadas 2D
 */
export function fromIdx(
  i: number,
  width: number = WORLD.WIDTH,
): { x: number; y: number } {
  return {
    x: i % width,
    y: Math.floor(i / width),
  };
}

export type ServerMessageType =
  | "init"
  | "tick"
  | "metrics"
  | "field_update"
  | "particles_update"
  | "chunk_data"
  | "chunk_unload"
  | "error";

export type ClientMessageType =
  | "start"
  | "pause"
  | "resume"
  | "reset"
  | "set_config"
  | "spawn_particles"
  | "subscribe_field"
  | "request_chunks"
  | "viewport_update";

export interface StructureData {
  id: number;
  type: string;
  x: number;
  y: number;
  level: number;
  health: number;
}

export interface ServerMessage {
  type: ServerMessageType;
  tick?: number;
  particles?: Particle[];
  fields?: Partial<Record<FieldType, ArrayBuffer>>;
  metrics?: SimulationMetrics;
  config?: SimulationConfig;
  error?: string;
  chunks?: ChunkSnapshot[];
  structures?: StructureData[];
}

export interface ClientMessage {
  type: ClientMessageType;
  config?: Partial<SimulationConfig>;
  spawn?: { x: number; y: number; count: number };
  subscribeFields?: FieldType[];
  viewport?: ViewportData;
  chunkRequests?: ChunkCoord[];
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}

export interface ViewportData {
  centerX: number;
  centerY: number;
  zoom: number;
  width: number;
  height: number;
}

export interface ChunkSnapshot {
  cx: number;
  cy: number;
  worldX: number;
  worldY: number;
  size: number;
  fields: Partial<Record<FieldType, ArrayBuffer>>;
  biomes?: ArrayBuffer;
  generated: boolean;
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
