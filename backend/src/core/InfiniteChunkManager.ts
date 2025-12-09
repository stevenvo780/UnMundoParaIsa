/**
 * InfiniteChunkManager - Gestiona chunks dinámicos para mundo infinito
 * Genera chunks bajo demanda, soporta coordenadas negativas
 *
 * Genera biomas realistas usando:
 * - Temperature: gradiente climático
 * - Moisture: humedad del terreno
 * - Elevation: altitud
 * - Continentality: distancia a masas de agua
 */

import { Chunk, CHUNK_SIZE } from "./Chunk.js";
import {
  FieldType,
  ChunkCoord,
  ChunkSnapshot,
  ViewportData,
} from "../types.js";
import { createNoise2D, NoiseFunction2D } from "simplex-noise";
import { BiomeResolver, BiomeType } from "./BiomeResolver.js";

function alea(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const BIOME_NOISE_SCALES = {
  temperature: { scale: 0.006, octaves: 3, persistence: 0.5 },
  moisture: { scale: 0.008, octaves: 3, persistence: 0.6 },
  elevation: { scale: 0.004, octaves: 4, persistence: 0.45 },
  continentality: { scale: 0.003, octaves: 2, persistence: 0.4 },
} as const;

export interface InfiniteChunkManagerConfig {
  activationRadius: number;
  unloadRadius: number;
  maxCachedChunks: number;
  sleepTimeout: number;
  seed: number;
}

const DEFAULT_CONFIG: InfiniteChunkManagerConfig = {
  activationRadius: 4,
  unloadRadius: 8,
  maxCachedChunks: 256,
  sleepTimeout: 30000,
  seed: 42,
};

/**
 * InfiniteChunkManager - Mundo infinito con chunks dinámicos
 */
export class InfiniteChunkManager {
  readonly config: InfiniteChunkManagerConfig;

  private chunks: Map<string, Chunk> = new Map();
  private activeChunks: Set<string> = new Set();
  private chunkAccessTimes: Map<string, number> = new Map();

  private foodNoise: NoiseFunction2D;
  private waterNoise: NoiseFunction2D;
  private treeNoise: NoiseFunction2D;
  private stoneNoise: NoiseFunction2D;

  private temperatureNoise: NoiseFunction2D;
  private moistureNoise: NoiseFunction2D;
  private elevationNoise: NoiseFunction2D;
  private continentalityNoise: NoiseFunction2D;

  private riverNoise: NoiseFunction2D;
  private riverNoise2: NoiseFunction2D;

  private biomeResolver: BiomeResolver;

  private focusCenters: Array<{ x: number; y: number; priority: number }> = [];

  private onChunkGenerated?: (chunk: ChunkSnapshot) => void;
  private onChunkUnloaded?: (cx: number, cy: number) => void;

  constructor(config: Partial<InfiniteChunkManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const prng = alea(this.config.seed);
    this.foodNoise = createNoise2D(prng);
    this.waterNoise = createNoise2D(alea(this.config.seed + 1));
    this.treeNoise = createNoise2D(alea(this.config.seed + 2));
    this.stoneNoise = createNoise2D(alea(this.config.seed + 3));

    this.temperatureNoise = createNoise2D(alea(this.config.seed + 100));
    this.moistureNoise = createNoise2D(alea(this.config.seed + 101));
    this.elevationNoise = createNoise2D(alea(this.config.seed + 102));
    this.continentalityNoise = createNoise2D(alea(this.config.seed + 103));

    this.riverNoise = createNoise2D(alea(this.config.seed + 200));
    this.riverNoise2 = createNoise2D(alea(this.config.seed + 201));

    this.biomeResolver = new BiomeResolver();

    console.log(
      `[InfiniteChunkManager] Initialized with seed ${this.config.seed}, biome generation enabled`,
    );
  }

  /**
   * Clave única para chunk (soporta negativos)
   */
  private keyFor(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /**
   * Parsear clave a coordenadas
   */
  private parseKey(key: string): ChunkCoord {
    const [cx, cy] = key.split(",").map(Number);
    return { cx, cy };
  }

  /**
   * Obtener o crear chunk
   */
  getOrCreateChunk(cx: number, cy: number): Chunk {
    const key = this.keyFor(cx, cy);
    let chunk = this.chunks.get(key);

    if (!chunk) {
      chunk = new Chunk(cx, cy);
      this.chunks.set(key, chunk);
      console.log(`[InfiniteChunkManager] Created chunk at (${cx}, ${cy})`);
    }

    this.chunkAccessTimes.set(key, Date.now());
    return chunk;
  }

  /**
   * Obtener chunk existente
   */
  getChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(this.keyFor(cx, cy));
  }

  /**
   * Obtener chunk por coordenadas del mundo
   */
  getChunkAt(worldX: number, worldY: number): Chunk | undefined {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    return this.getChunk(cx, cy);
  }

  /**
   * Obtener o crear chunk por coordenadas del mundo
   */
  getOrCreateChunkAt(worldX: number, worldY: number): Chunk {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    return this.getOrCreateChunk(cx, cy);
  }

  /**
   * Calcular ruido fractal con octavas (FBM - Fractal Brownian Motion)
   */
  private fractalNoise(
    noise: NoiseFunction2D,
    x: number,
    y: number,
    scale: number,
    octaves: number,
    persistence: number,
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * (0.5 + 0.5 * noise(x * frequency, y * frequency));
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }

  /**
   * Detectar si un punto está en un río usando "ridged noise"
   * Los ríos aparecen como líneas donde el ruido cruza un umbral
   *
   * @returns Valor 0-1 indicando proximidad a río (1 = en el río)
   */
  private getRiverValue(x: number, y: number, elevation: number): number {
    if (elevation > 0.65 || elevation < 0.15) {
      return 0;
    }

    const RIVER_SCALE = 0.003;
    const RIVER_SCALE_2 = 0.006;

    const n1 = this.riverNoise(x * RIVER_SCALE, y * RIVER_SCALE);
    const n2 = this.riverNoise2(x * RIVER_SCALE_2, y * RIVER_SCALE_2);

    const combined = (n1 + n2 * 0.5) / 1.5;

    const ridge = 1 - Math.abs(combined);

    const RIVER_THRESHOLD = 0.85;

    if (ridge > RIVER_THRESHOLD) {
      return (ridge - RIVER_THRESHOLD) / (1 - RIVER_THRESHOLD);
    }

    return 0;
  }

  /**
   * Generar terreno procedural para un chunk con biomas realistas
   */
  private generateTerrain(chunk: Chunk): void {
    if (chunk.state === "dormant") {
      chunk.activate();
    }

    const worldX = chunk.worldX;
    const worldY = chunk.worldY;

    const biomes: BiomeType[] = new Array<BiomeType>(CHUNK_SIZE * CHUNK_SIZE);

    const FOOD_SCALE = 0.02;
    const WATER_SCALE = 0.006;
    const TREE_SCALE = 0.03;
    const STONE_SCALE = 0.01;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = worldX + lx;
        const gy = worldY + ly;

        const temp = this.fractalNoise(
          this.temperatureNoise,
          gx,
          gy,
          BIOME_NOISE_SCALES.temperature.scale,
          BIOME_NOISE_SCALES.temperature.octaves,
          BIOME_NOISE_SCALES.temperature.persistence,
        );

        const moisture = this.fractalNoise(
          this.moistureNoise,
          gx,
          gy,
          BIOME_NOISE_SCALES.moisture.scale,
          BIOME_NOISE_SCALES.moisture.octaves,
          BIOME_NOISE_SCALES.moisture.persistence,
        );

        const elevation = this.fractalNoise(
          this.elevationNoise,
          gx,
          gy,
          BIOME_NOISE_SCALES.elevation.scale,
          BIOME_NOISE_SCALES.elevation.octaves,
          BIOME_NOISE_SCALES.elevation.persistence,
        );

        const continentality = this.fractalNoise(
          this.continentalityNoise,
          gx,
          gy,
          BIOME_NOISE_SCALES.continentality.scale,
          BIOME_NOISE_SCALES.continentality.octaves,
          BIOME_NOISE_SCALES.continentality.persistence,
        );

        let biome = this.biomeResolver.resolveBiome(
          temp,
          moisture,
          elevation,
          continentality,
        );

        const riverValue = this.getRiverValue(gx, gy, elevation);
        if (riverValue > 0.3) {
          biome = BiomeType.RIVER;
        }

        biomes[ly * CHUNK_SIZE + lx] = biome;

        chunk.setBiome(lx, ly, biome);

        const biomeConfig = this.biomeResolver.getBiomeConfig(biome);

        let food = 0.5 + 0.5 * this.foodNoise(gx * FOOD_SCALE, gy * FOOD_SCALE);
        food +=
          0.25 *
          (0.5 +
            0.5 * this.foodNoise(gx * FOOD_SCALE * 2, gy * FOOD_SCALE * 2));
        food = Math.min(1, Math.max(0, food / 1.25));

        if (biome === BiomeType.FOREST || biome === BiomeType.GRASSLAND) {
          food *= 1.2;
        } else if (biome === BiomeType.DESERT || biome === BiomeType.MOUNTAIN) {
          food *= 0.3;
        } else if (
          biome === BiomeType.OCEAN ||
          biome === BiomeType.LAKE ||
          biome === BiomeType.RIVER
        ) {
          food = 0;
        } else if (biome === BiomeType.SWAMP || biome === BiomeType.WETLAND) {
          food *= 0.8;
        }
        chunk.setValue("food", lx, ly, Math.min(1, food * 0.5));

        let water =
          0.5 + 0.5 * this.waterNoise(gx * WATER_SCALE, gy * WATER_SCALE);
        water = Math.pow(water, 2);

        if (
          biome === BiomeType.OCEAN ||
          biome === BiomeType.LAKE ||
          biome === BiomeType.RIVER
        ) {
          chunk.setValue("water", lx, ly, 1.0);
        } else if (biome === BiomeType.SWAMP || biome === BiomeType.WETLAND) {
          chunk.setValue("water", lx, ly, 0.7 + water * 0.3);
        } else if (biome === BiomeType.BEACH) {
          chunk.setValue("water", lx, ly, water > 0.5 ? 0.4 : 0);
        } else if (water > 0.6) {
          chunk.setValue("water", lx, ly, (water - 0.6) * 2.5);
        }

        const treePotential = this.treeNoise(gx * TREE_SCALE, gy * TREE_SCALE);
        const treeDensity = biomeConfig?.density.trees ?? 0;

        if (treeDensity > 0 && treePotential > 1 - treeDensity) {
          chunk.setValue(
            "trees",
            lx,
            ly,
            (treePotential - (1 - treeDensity)) * (1 / treeDensity),
          );
        }

        const stone =
          0.5 + 0.5 * this.stoneNoise(gx * STONE_SCALE, gy * STONE_SCALE);
        if (stone > 0.7 && water < 0.3) {
          chunk.setValue("stone", lx, ly, (stone - 0.7) * 3.33);
        }
      }
    }
  }

  /**
   * Activar y generar chunk si es necesario
   */
  ensureChunkActive(cx: number, cy: number): Chunk {
    const chunk = this.getOrCreateChunk(cx, cy);

    if (chunk.state === "dormant") {
      chunk.activate();
      this.generateTerrain(chunk);
      this.activeChunks.add(this.keyFor(cx, cy));

      if (this.onChunkGenerated) {
        this.onChunkGenerated(this.serializeChunk(chunk, true));
      }
    }

    return chunk;
  }

  /**
   * Actualizar desde viewport - retorna solo chunks NUEVOS
   */
  updateFromViewport(viewport: ViewportData): ChunkSnapshot[] {
    const newChunks: ChunkSnapshot[] = [];

    const halfW = viewport.width / viewport.zoom / 2;
    const halfH = viewport.height / viewport.zoom / 2;

    const minX = viewport.centerX - halfW;
    const maxX = viewport.centerX + halfW;
    const minY = viewport.centerY - halfH;
    const maxY = viewport.centerY + halfH;

    const minCX = Math.floor(minX / CHUNK_SIZE) - 1;
    const maxCX = Math.ceil(maxX / CHUNK_SIZE) + 1;
    const minCY = Math.floor(minY / CHUNK_SIZE) - 1;
    const maxCY = Math.ceil(maxY / CHUNK_SIZE) + 1;

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = this.keyFor(cx, cy);
        const chunk = this.getChunk(cx, cy);

        if (!chunk || chunk.state === "dormant") {
          const newChunk = this.ensureChunkActive(cx, cy);
          newChunks.push(this.serializeChunk(newChunk, true));
        }

        this.chunkAccessTimes.set(key, Date.now());
      }
    }

    this.focusCenters = [
      { x: viewport.centerX, y: viewport.centerY, priority: 1 },
    ];

    return newChunks;
  }

  /**
   * Obtener TODOS los chunks visibles en un viewport (para envío inicial)
   */
  getChunksForViewport(viewport: ViewportData): ChunkSnapshot[] {
    const visibleChunks: ChunkSnapshot[] = [];

    const halfW = viewport.width / viewport.zoom / 2;
    const halfH = viewport.height / viewport.zoom / 2;

    const minX = viewport.centerX - halfW;
    const maxX = viewport.centerX + halfW;
    const minY = viewport.centerY - halfH;
    const maxY = viewport.centerY + halfH;

    const minCX = Math.floor(minX / CHUNK_SIZE) - 1;
    const maxCX = Math.ceil(maxX / CHUNK_SIZE) + 1;
    const minCY = Math.floor(minY / CHUNK_SIZE) - 1;
    const maxCY = Math.ceil(maxY / CHUNK_SIZE) + 1;

    console.log(
      `[InfiniteChunkManager] getChunksForViewport: cx ${minCX}-${maxCX}, cy ${minCY}-${maxCY}`,
    );

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const chunk = this.ensureChunkActive(cx, cy);
        visibleChunks.push(this.serializeChunk(chunk, false));
        this.chunkAccessTimes.set(this.keyFor(cx, cy), Date.now());
      }
    }

    return visibleChunks;
  }

  /**
   * Actualizar desde posición de partículas (agentes generan chunks)
   */
  updateFromParticles(
    particles: Array<{ x: number; y: number; alive: boolean }>,
  ): ChunkSnapshot[] {
    const newChunks: ChunkSnapshot[] = [];
    const particleChunks = new Set<string>();

    for (const p of particles) {
      if (!p.alive) continue;

      const cx = Math.floor(p.x / CHUNK_SIZE);
      const cy = Math.floor(p.y / CHUNK_SIZE);
      const key = this.keyFor(cx, cy);

      if (!particleChunks.has(key)) {
        particleChunks.add(key);

        const chunk = this.getChunk(cx, cy);
        if (!chunk || chunk.state === "dormant") {
          const newChunk = this.ensureChunkActive(cx, cy);
          newChunks.push(this.serializeChunk(newChunk, true));
        }

        this.chunkAccessTimes.set(key, Date.now());

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const adjChunk = this.getChunk(cx + dx, cy + dy);

            if (!adjChunk || adjChunk.state === "dormant") {
              const newAdjChunk = this.ensureChunkActive(cx + dx, cy + dy);
              newChunks.push(this.serializeChunk(newAdjChunk, true));
            }
          }
        }
      }
    }

    return newChunks;
  }

  /**
   * Limpiar chunks antiguos
   */
  cleanup(): string[] {
    const now = Date.now();
    const unloaded: string[] = [];

    if (this.chunks.size > this.config.maxCachedChunks) {
      const sortedByAge = [...this.chunkAccessTimes.entries()].sort(
        (a, b) => a[1] - b[1],
      );

      const toRemove = sortedByAge.slice(
        0,
        this.chunks.size - this.config.maxCachedChunks,
      );

      for (const [key] of toRemove) {
        const chunk = this.chunks.get(key);
        if (chunk) {
          chunk.sleep();
          this.chunks.delete(key);
          this.activeChunks.delete(key);
          this.chunkAccessTimes.delete(key);
          unloaded.push(key);

          const { cx, cy } = this.parseKey(key);
          if (this.onChunkUnloaded) {
            this.onChunkUnloaded(cx, cy);
          }
        }
      }
    }

    for (const [key, lastAccess] of this.chunkAccessTimes) {
      if (now - lastAccess > this.config.sleepTimeout) {
        const chunk = this.chunks.get(key);
        if (chunk && chunk.state !== "dormant") {
          chunk.sleep();
          this.activeChunks.delete(key);
        }
      }
    }

    return unloaded;
  }

  /**
   * Serializar chunk para envío
   */
  serializeChunk(chunk: Chunk, generated: boolean = false): ChunkSnapshot {
    const fields: Partial<Record<FieldType, ArrayBuffer>> = {};

    const activeFields: FieldType[] = ["food", "water", "trees", "stone"];
    for (const type of activeFields) {
      const field = chunk.getField(type);
      if (field) {
        const buffer = field.getBuffer();
        fields[type] = new ArrayBuffer(buffer.byteLength);
        new Float32Array(fields[type] as ArrayBuffer).set(buffer);
      }
    }

    let biomesBuffer: ArrayBuffer | undefined;
    const biomes = chunk.getBiomes();
    if (biomes) {
      biomesBuffer = new ArrayBuffer(biomes.byteLength);
      new Uint8Array(biomesBuffer).set(biomes);
    }

    return {
      cx: chunk.cx,
      cy: chunk.cy,
      worldX: chunk.worldX,
      worldY: chunk.worldY,
      size: CHUNK_SIZE,
      fields,
      biomes: biomesBuffer,
      generated,
    };
  }

  /**
   * Obtener chunks para enviar (los que están activos y renderizados)
   */
  getActiveChunkSnapshots(): ChunkSnapshot[] {
    const snapshots: ChunkSnapshot[] = [];

    for (const key of this.activeChunks) {
      const chunk = this.chunks.get(key);
      if (chunk && chunk.state !== "dormant") {
        snapshots.push(this.serializeChunk(chunk));
      }
    }

    return snapshots;
  }

  /**
   * Obtener valor de campo en coordenadas del mundo
   */
  getValue(type: FieldType, worldX: number, worldY: number): number {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);

    if (!chunk || chunk.state === "dormant") {
      return 0;
    }

    const localX = worldX - chunk.worldX;
    const localY = worldY - chunk.worldY;
    return chunk.getValue(type, localX, localY);
  }

  /**
   * Establecer valor de campo
   */
  setValue(
    type: FieldType,
    worldX: number,
    worldY: number,
    value: number,
  ): void {
    const chunk = this.getOrCreateChunkAt(worldX, worldY);
    if (chunk.state === "dormant") {
      this.ensureChunkActive(chunk.cx, chunk.cy);
    }

    const localX = worldX - chunk.worldX;
    const localY = worldY - chunk.worldY;
    chunk.setValue(type, localX, localY, value);
  }

  /**
   * Paso de simulación (solo chunks activos)
   */
  step(): void {
    for (const key of this.activeChunks) {
      const chunk = this.chunks.get(key);
      if (!chunk || chunk.state === "dormant") continue;

      chunk.diffuseDecayStep();
      if (chunk.state === "hyper") {
        chunk.growthStep();
      }
    }
  }

  /**
   * Estadísticas
   */
  getStats(): { total: number; active: number; dormant: number } {
    let active = 0;
    let dormant = 0;

    for (const chunk of this.chunks.values()) {
      if (chunk.state === "dormant") dormant++;
      else active++;
    }

    return { total: this.chunks.size, active, dormant };
  }

  /**
   * Registrar callbacks
   */
  onChunkGeneratedCallback(callback: (chunk: ChunkSnapshot) => void): void {
    this.onChunkGenerated = callback;
  }

  onChunkUnloadedCallback(callback: (cx: number, cy: number) => void): void {
    this.onChunkUnloaded = callback;
  }

  /**
   * Obtener límites actuales del mundo (chunks cargados)
   */
  getWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minCX = Infinity,
      maxCX = -Infinity;
    let minCY = Infinity,
      maxCY = -Infinity;

    for (const key of this.chunks.keys()) {
      const { cx, cy } = this.parseKey(key);
      if (cx < minCX) minCX = cx;
      if (cx > maxCX) maxCX = cx;
      if (cy < minCY) minCY = cy;
      if (cy > maxCY) maxCY = cy;
    }

    if (minCX === Infinity) {
      return { minX: 0, minY: 0, maxX: CHUNK_SIZE, maxY: CHUNK_SIZE };
    }

    return {
      minX: minCX * CHUNK_SIZE,
      minY: minCY * CHUNK_SIZE,
      maxX: (maxCX + 1) * CHUNK_SIZE,
      maxY: (maxCY + 1) * CHUNK_SIZE,
    };
  }
}
