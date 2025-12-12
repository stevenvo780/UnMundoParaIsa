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

export enum FieldType {
  FOOD = "food",
  WATER = "water",
  COST = "cost",
  DANGER = "danger",
  TREES = "trees",
  STONE = "stone",
  TRAIL0 = "trail0",
  TRAIL1 = "trail1",
  TRAIL2 = "trail2",
  TRAIL3 = "trail3",
  POPULATION = "population",
  LABOR = "labor",
}

export interface FieldConfig {
  diffusion: number;
  decay: number;
  maxValue: number;
  growthRate?: number;
  growthCap?: number;
}

export const DEFAULT_FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  [FieldType.FOOD]: {
    diffusion: 0.03,
    decay: 0.002,
    maxValue: 1.0,
    growthRate: 0.0,
    growthCap: 0.0,
  },
  [FieldType.WATER]: { diffusion: 0.02, decay: 0.001, maxValue: 1.0 },
  [FieldType.COST]: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  [FieldType.DANGER]: { diffusion: 0.1, decay: 0.05, maxValue: 1.0 },
  [FieldType.TREES]: {
    diffusion: 0.0,
    decay: 0.0,
    maxValue: 1.0,
    growthRate: 0.003,
    growthCap: 1.0,
  },
  [FieldType.STONE]: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  [FieldType.TRAIL0]: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  [FieldType.TRAIL1]: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  [FieldType.TRAIL2]: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  [FieldType.TRAIL3]: { diffusion: 0.1, decay: 0.08, maxValue: 1.0 },
  [FieldType.POPULATION]: { diffusion: 0.0, decay: 1.0, maxValue: 100 },
  [FieldType.LABOR]: { diffusion: 0.05, decay: 0.2, maxValue: 10.0 },
};

export enum AgentState {
  IDLE = "idle",
  WANDERING = "wandering",
  GATHERING = "gathering",
  WORKING = "working",
  RESTING = "resting",
  MOVING = "moving",
  FLEEING = "fleeing",
  BUILDING = "building",
}

export interface AgentNeeds {
  shelter: number; // 0..1 (1 = fully sheltered)
  comfort: number; // 0..1
  wealth: number; // 0..1 (perception of resources)
  social: number; // 0..1
}

export interface AgentGoal {
  type: string; // e.g. "BUILD_SHELTER", "GATHER_RESOURCE"
  priority: number;
  targetId?: number;
  targetX?: number;
  targetY?: number;
  data?: Record<string, any>;
}

export interface AgentMemory {
  lastFoodLocation?: { x: number; y: number };
  lastWaterLocation?: { x: number; y: number };
  homeLocation?: { x: number; y: number };
  targetStructureId?: number;
  knownStructures?: number[]; // IDs of structures seen
}

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
  state: AgentState;
  inventory: Record<string, number>;
  memory: AgentMemory;
  currentAction?: string;

  // New emergent properties
  needs?: AgentNeeds;
  currentGoal?: AgentGoal;
  ownedStructureIds?: number[];
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

export enum ServerMessageType {
  INIT = "init",
  TICK = "tick",
  METRICS = "metrics",
  FIELD_UPDATE = "field_update",
  PARTICLES_UPDATE = "particles_update",
  CHUNK_DATA = "chunk_data",
  CHUNK_UNLOAD = "chunk_unload",
  DIALOG = "dialog",
  ERROR = "error",
}

export enum ClientMessageType {
  JOIN = "join",
  LEAVE = "leave",
  INPUT = "input",
  START = "start",
  PAUSE = "pause",
  RESUME = "resume",
  RESET = "reset",
  SET_CONFIG = "set_config",
  SPAWN_ENTITY = "spawn_entity",
  SPAWN_PARTICLES = "spawn_particles",
  SUBSCRIBE_FIELD = "subscribe_field",
  REQUEST_CHUNKS = "request_chunks",
  VIEWPORT_UPDATE = "viewport_update",
}

export interface StructureData {
  id: number;
  type: string;
  x: number;
  y: number;
  level: number;
  health: number;
  ownerId?: number;
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
