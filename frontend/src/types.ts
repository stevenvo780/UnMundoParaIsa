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
  TICK_MS: 50, // 20 ticks lógicos por segundo
  GRID_SIZE: 64, // Tamaño del grid para campos
  INTERPOLATION_FACTOR: 0.15, // Factor de interpolación para movimiento suave
} as const;

// ============================================
// Tipos de campos
// ============================================

export enum FieldType {
  FOOD = "food",
  WATER = "water",
  COST = "cost",
  DANGER = "danger",
  TREES = "trees",
  STONE = "stone",
  TRAIL0 = "trail0", // Canal de firma 0
  TRAIL1 = "trail1", // Canal de firma 1
  TRAIL2 = "trail2", // Canal de firma 2
  TRAIL3 = "trail3", // Canal de firma 3
  POPULATION = "population",
  LABOR = "labor",
}

// ============================================
// Configuración de campos
// ============================================

export interface FieldConfig {
  diffusion: number; // 0-1: qué tan rápido se expande
  decay: number; // 0-1: qué tan rápido desaparece
  maxValue: number; // Valor máximo permitido
  growthRate?: number; // Para recursos regenerables
  growthCap?: number; // Límite de crecimiento
}

export const DEFAULT_FIELD_CONFIGS: Record<FieldType, FieldConfig> = {
  [FieldType.FOOD]: {
    diffusion: 0.01,
    decay: 0.001,
    maxValue: 1.0,
    growthRate: 0.02,
    growthCap: 0.8,
  },
  [FieldType.WATER]: { diffusion: 0.05, decay: 0.0001, maxValue: 1.0 },
  [FieldType.COST]: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  [FieldType.DANGER]: { diffusion: 0.1, decay: 0.05, maxValue: 1.0 },
  [FieldType.TREES]: {
    diffusion: 0.005,
    decay: 0.0001,
    maxValue: 1.0,
    growthRate: 0.01,
    growthCap: 0.9,
  },
  [FieldType.STONE]: { diffusion: 0.0, decay: 0.0, maxValue: 1.0 },
  [FieldType.TRAIL0]: { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  [FieldType.TRAIL1]: { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  [FieldType.TRAIL2]: { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  [FieldType.TRAIL3]: { diffusion: 0.15, decay: 0.1, maxValue: 1.0 },
  [FieldType.POPULATION]: { diffusion: 0.0, decay: 1.0, maxValue: 100 },
  [FieldType.LABOR]: { diffusion: 0.05, decay: 0.2, maxValue: 10.0 },
};

// ============================================
// Partículas (agentes)
// ============================================

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx?: number; // Velocidad X (para interpolación)
  vy?: number; // Velocidad Y (para interpolación)
  energy: number; // 0-1: energía vital
  seed: number; // Semilla genética (define comportamiento)
  alive: boolean;
  inventory?: Record<string, number>;
  state?: AgentState;
  currentAction?: string;
}

export enum AgentState {
  IDLE = "IDLE",
  GATHERING = "GATHERING",
  WORKING = "WORKING",
  WANDERING = "WANDERING",
  MOVING = "MOVING",
  FLEEING = "FLEEING",
  RESTING = "RESTING",
}

// Estado extendido para interpolación en frontend
export interface ParticleRenderState extends Particle {
  displayX: number; // Posición visual interpolada
  displayY: number;
  prevX: number; // Posición anterior (para interpolación)
  prevY: number;
}

// ============================================
// Configuración de simulación
// ============================================

export interface LifecycleConfig {
  baseMetabolism: number; // Consumo de energía por tick
  movementCost: number; // Coste de moverse
  reproductionThreshold: number; // Energía necesaria para reproducirse
  reproductionCost: number; // Energía gastada al reproducirse
  consumptionEfficiency: number; // Eficiencia al consumir recursos
  mutationRate: number; // Probabilidad de mutar cada bit del seed
}

export interface GradientWeights {
  food: number;
  water: number;
  trail: number;
  danger: number;
  cost: number;
  crowding: number; // Peso negativo para evitar zonas densas (population)
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
    trail: 0.2, // Reducido para menos agrupamiento
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
export function fromIdx(
  i: number,
  width: number = WORLD.WIDTH,
): { x: number; y: number } {
  return {
    x: i % width,
    y: Math.floor(i / width),
  };
}

// ============================================
// Mensajes WebSocket
// ============================================

export enum ServerMessageType {
  INIT = "init",
  TICK = "tick",
  METRICS = "metrics",
  FIELD_UPDATE = "field_update",
  PARTICLES_UPDATE = "particles_update",
  CHUNK_DATA = "chunk_data", // Datos de chunks generados
  CHUNK_UNLOAD = "chunk_unload", // Notificar que chunk fue descargado
  DIALOG = "dialog",
  ERROR = "error",
}

// Removed duplicate ClientMessageType type alias

// Estructura serializada desde el servidor
export interface DialogFragment {
  id: string;
  text: string;
  speaker?: string;
  emotion?: DialogEmotion;
  timestamp: number;
  x: number;
  y: number;
  artifactId?: string;
  characterId?: string;
}

export enum DialogEmotion {
  JOY = "joy",
  NOSTALGIA = "nostalgia",
  LOVE = "love",
  SADNESS = "sadness",
  NEUTRAL = "neutral",
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
}

export interface ServerMessage {
  type: ServerMessageType;
  clientId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: any; // Replace with GameState type
  tick?: number;
  particles?: Particle[];
  fields?: Partial<Record<FieldType, ArrayBuffer>>;
  metrics?: SimulationMetrics;
  config?: SimulationConfig;
  error?: string;
  chunks?: ChunkSnapshot[]; // Datos de chunks
  structures?: StructureData[]; // Estructuras emergentes
  dialog?: DialogFragment;
}

export interface ClientMessage {
  type: ClientMessageType;
  config?: Partial<SimulationConfig>;
  spawn?: { x: number; y: number; count: number };
  subscribeFields?: FieldType[];
  viewport?: ViewportData; // Datos de viewport para chunks
  chunkRequests?: ChunkCoord[]; // Chunks específicos a solicitar
  x?: number;
  y?: number;
}

// ============================================
// Tipos de biomas
// ============================================

export enum BiomeType {
  GRASSLAND = "grassland",
  FOREST = "forest",
  DESERT = "desert",
  TUNDRA = "tundra",
  SWAMP = "swamp",
  WETLAND = "wetland",
  MOUNTAIN = "mountain",
  BEACH = "beach",
  OCEAN = "ocean",
  LAKE = "lake",
  RIVER = "river",
  MYSTICAL = "mystical", // Bosque Místico
  MOUNTAINOUS = "mountainous", // Zona Montañosa
  VILLAGE = "village", // Zona de Pueblo
}

// Colores de biomas para renderizado
export const BIOME_COLORS: Record<BiomeType, number> = {
  [BiomeType.GRASSLAND]: 0x7cb342,
  [BiomeType.FOREST]: 0x2e7d32,
  [BiomeType.DESERT]: 0xd4a574,
  [BiomeType.TUNDRA]: 0xb0bec5,
  [BiomeType.SWAMP]: 0x558b2f,
  [BiomeType.WETLAND]: 0x66bb6a,
  [BiomeType.MOUNTAIN]: 0x78909c,
  [BiomeType.BEACH]: 0xfff59d,
  [BiomeType.OCEAN]: 0x0288d1,
  [BiomeType.LAKE]: 0x4fc3f7,
  [BiomeType.RIVER]: 0x29b6f6,
  [BiomeType.MYSTICAL]: 0x7b1fa2, // Púrpura
  [BiomeType.MOUNTAINOUS]: 0x5d4037, // Marrón oscuro
  [BiomeType.VILLAGE]: 0x8d6e63, // Marrón claro
};

// Array ordenado de biomas para decodificar índices
export const BIOME_ORDER: BiomeType[] = Object.values(BiomeType);

// ============================================
// Chunks dinámicos
// ============================================

export interface ChunkCoord {
  cx: number; // Coordenada X del chunk (puede ser negativa)
  cy: number; // Coordenada Y del chunk (puede ser negativa)
}

export interface ViewportData {
  centerX: number; // Centro del viewport en coordenadas mundo
  centerY: number;
  zoom: number; // Nivel de zoom (1 = normal)
  width: number; // Ancho del viewport en pixels
  height: number; // Alto del viewport en pixels
}

export interface ChunkSnapshot {
  cx: number;
  cy: number;
  worldX: number;
  worldY: number;
  size: number;
  fields: Partial<Record<FieldType, number[]>>;
  biomes?: number[]; // Índices de biomas para cada tile (decodificar con BIOME_ORDER)
  generated: boolean; // true si se acaba de generar
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

// ============================================
// Tipos adicionales para visualización
// ============================================

export interface Community {
  id: number;
  centerX: number;
  centerY: number;
  radius: number;
  population: number;
  dominantSignature: [number, number, number, number];
}

export interface ConflictZone {
  x: number;
  y: number;
  tension: number;
}

export interface Artifact {
  id: number;
  type: string;
  x: number;
  y: number;
  discovered: boolean;
}

export interface Character {
  id: number;
  name: string;
  x: number;
  y: number;
  type: CharacterType;
}

export enum CharacterType {
  CHARACTER = "character",
  HERO = "hero",
}

export interface ExtendedWorldState extends WorldState {
  communities?: Community[];
  conflicts?: ConflictZone[];
  artifacts?: Artifact[];
  characters?: Character[];
  tensionField?: Float32Array;
}
