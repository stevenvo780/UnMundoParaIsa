/**
 * ChunkManager - Gestiona grid de chunks con activación/desactivación dinámica
 */

import { Chunk, CHUNK_SIZE } from "./Chunk.js";
import { FieldType, WORLD, Particle } from "../types.js";

export interface ChunkManagerConfig {
  worldWidth: number;
  worldHeight: number;
  activationRadius: number;
  hyperRadius: number;
  sleepTimeout: number;
}

const DEFAULT_CHUNK_CONFIG: ChunkManagerConfig = {
  worldWidth: WORLD.WIDTH,
  worldHeight: WORLD.HEIGHT,
  activationRadius: 3,
  hyperRadius: 1,
  sleepTimeout: 30000,
};

/**
 * ChunkManager - Controlador de chunks
 */
export class ChunkManager {
  readonly chunksX: number;
  readonly chunksY: number;
  readonly config: ChunkManagerConfig;

  private chunks: Map<string, Chunk> = new Map();
  private activeChunks: Set<string> = new Set();
  private hyperChunks: Set<string> = new Set();

  private focusX = 0;
  private focusY = 0;

  constructor(config: Partial<ChunkManagerConfig> = {}) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
    this.chunksX = Math.ceil(this.config.worldWidth / CHUNK_SIZE);
    this.chunksY = Math.ceil(this.config.worldHeight / CHUNK_SIZE);

    for (let cy = 0; cy < this.chunksY; cy++) {
      for (let cx = 0; cx < this.chunksX; cx++) {
        const key = this.keyFor(cx, cy);
        this.chunks.set(key, new Chunk(cx, cy));
      }
    }

    console.log(
      `[ChunkManager] Created ${this.chunks.size} chunks (${this.chunksX}x${this.chunksY})`,
    );
  }

  /**
   * Clave única para chunk
   */
  private keyFor(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /**
   * Obtener chunk por coordenadas de chunk
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
   * Convertir coordenadas del mundo a chunk + local
   */
  worldToChunkLocal(
    worldX: number,
    worldY: number,
  ): { chunk: Chunk | undefined; localX: number; localY: number } {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);

    return {
      chunk,
      localX: worldX - cx * CHUNK_SIZE,
      localY: worldY - cy * CHUNK_SIZE,
    };
  }

  /**
   * Obtener valor de campo en coordenadas del mundo
   */
  getValue(type: FieldType, worldX: number, worldY: number): number {
    const { chunk, localX, localY } = this.worldToChunkLocal(worldX, worldY);
    if (!chunk || chunk.state === "dormant") return 0;
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
    const { chunk, localX, localY } = this.worldToChunkLocal(worldX, worldY);
    if (chunk && chunk.state !== "dormant") {
      chunk.setValue(type, localX, localY, value);
    }
  }

  /**
   * Añadir valor a campo
   */
  addValue(
    type: FieldType,
    worldX: number,
    worldY: number,
    delta: number,
  ): void {
    const { chunk, localX, localY } = this.worldToChunkLocal(worldX, worldY);
    if (chunk && chunk.state !== "dormant") {
      chunk.addValue(type, localX, localY, delta);
    }
  }

  /**
   * Actualizar foco de activación
   */
  setFocus(worldX: number, worldY: number): void {
    this.focusX = Math.floor(worldX / CHUNK_SIZE);
    this.focusY = Math.floor(worldY / CHUNK_SIZE);
    this.updateActivation();
  }

  /**
   * Actualizar activación basada en partículas
   */
  updateFromParticles(particles: Particle[]): void {
    if (particles.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const p of particles) {
      if (!p.alive) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const minCX = Math.floor(minX / CHUNK_SIZE);
    const maxCX = Math.floor(maxX / CHUNK_SIZE);
    const minCY = Math.floor(minY / CHUNK_SIZE);
    const maxCY = Math.floor(maxY / CHUNK_SIZE);

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const chunk = this.getChunk(cx, cy);
        if (chunk && chunk.state === "dormant") {
          chunk.activate();
          this.activeChunks.add(this.keyFor(cx, cy));
        }
      }
    }
  }

  /**
   * Actualizar estados de activación
   */
  private updateActivation(): void {
    const { activationRadius, hyperRadius } = this.config;
    const newActive = new Set<string>();
    const newHyper = new Set<string>();

    for (let dy = -activationRadius; dy <= activationRadius; dy++) {
      for (let dx = -activationRadius; dx <= activationRadius; dx++) {
        const cx = this.focusX + dx;
        const cy = this.focusY + dy;

        if (cx < 0 || cx >= this.chunksX || cy < 0 || cy >= this.chunksY)
          continue;

        const key = this.keyFor(cx, cy);
        const chunk = this.chunks.get(key);
        if (!chunk) continue;

        const dist = Math.max(Math.abs(dx), Math.abs(dy));

        if (dist <= hyperRadius) {
          newHyper.add(key);
          newActive.add(key);
          if (chunk.state !== "hyper") {
            chunk.setHyper();
          }
        } else {
          newActive.add(key);
          if (chunk.state === "dormant") {
            chunk.activate();
          }
        }
      }
    }

    for (const key of this.activeChunks) {
      if (!newActive.has(key)) {
        const chunk = this.chunks.get(key);
        if (chunk && chunk.getIdleTime() > this.config.sleepTimeout) {
          chunk.sleep();
        }
      }
    }

    this.activeChunks = newActive;
    this.hyperChunks = newHyper;
  }

  /**
   * Actualizar todos los chunks activos
   */
  step(): void {
    for (const key of this.activeChunks) {
      const chunk = this.chunks.get(key);
      if (!chunk || chunk.state === "dormant") continue;

      if (chunk.state === "hyper") {
        chunk.diffuseDecayStep();
        chunk.growthStep();
      } else {
        chunk.diffuseDecayStep();
      }
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats(): ChunkStats {
    let dormant = 0,
      active = 0,
      hyper = 0;

    for (const chunk of this.chunks.values()) {
      switch (chunk.state) {
        case "dormant":
          dormant++;
          break;
        case "active":
          active++;
          break;
        case "hyper":
          hyper++;
          break;
      }
    }

    return {
      total: this.chunks.size,
      dormant,
      active,
      hyper,
    };
  }

  /**
   * Obtener todos los chunks activos
   */
  getActiveChunks(): Chunk[] {
    const result: Chunk[] = [];
    for (const key of this.activeChunks) {
      const chunk = this.chunks.get(key);
      if (chunk && chunk.state !== "dormant") {
        result.push(chunk);
      }
    }
    return result;
  }

  /**
   * Activar todos los chunks (para inicialización)
   */
  activateAll(): void {
    for (const chunk of this.chunks.values()) {
      chunk.activate();
      this.activeChunks.add(this.keyFor(chunk.cx, chunk.cy));
    }
  }

  /**
   * Inicializar campo con oases en el chunk apropiado
   */
  initWithOases(
    type: FieldType,
    oases: Array<{ x: number; y: number; radius: number; value: number }>,
  ): void {
    for (const oasis of oases) {
      const minCX = Math.floor((oasis.x - oasis.radius) / CHUNK_SIZE);
      const maxCX = Math.floor((oasis.x + oasis.radius) / CHUNK_SIZE);
      const minCY = Math.floor((oasis.y - oasis.radius) / CHUNK_SIZE);
      const maxCY = Math.floor((oasis.y + oasis.radius) / CHUNK_SIZE);

      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const chunk = this.getChunk(cx, cy);
          if (!chunk) continue;

          if (chunk.state === "dormant") {
            chunk.activate();
            this.activeChunks.add(this.keyFor(cx, cy));
          }

          const field = chunk.getField(type);
          if (!field) continue;

          const localOasis = {
            x: oasis.x - cx * CHUNK_SIZE,
            y: oasis.y - cy * CHUNK_SIZE,
            radius: oasis.radius,
            value: oasis.value,
          };
          field.addOasis(
            localOasis.x,
            localOasis.y,
            localOasis.radius,
            localOasis.value,
          );
        }
      }
    }
  }
}

export interface ChunkStats {
  total: number;
  dormant: number;
  active: number;
  hyper: number;
}
