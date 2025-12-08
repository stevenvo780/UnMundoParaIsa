/**
 * InfiniteChunkManager - Gestiona chunks dinámicos para mundo infinito
 * Genera chunks bajo demanda, soporta coordenadas negativas
 */

import { Chunk, CHUNK_SIZE, ChunkState } from './Chunk.js';
import { FieldType, ChunkCoord, ChunkSnapshot, ViewportData } from '../types.js';
import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

// Alea PRNG simple
function alea(seed: number): () => number {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export interface InfiniteChunkManagerConfig {
  activationRadius: number;     // Radio en chunks para mantener activos
  unloadRadius: number;         // Radio más allá del cual descargar
  maxCachedChunks: number;      // Máximo de chunks en memoria
  sleepTimeout: number;         // ms antes de dormir un chunk inactivo
  seed: number;                 // Semilla para generación procedural
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
  
  // Generadores de ruido para terreno procedural
  private foodNoise: NoiseFunction2D;
  private waterNoise: NoiseFunction2D;
  private treeNoise: NoiseFunction2D;
  private stoneNoise: NoiseFunction2D;
  
  // Centro de activación (viewport o partículas)
  private focusCenters: Array<{ x: number; y: number; priority: number }> = [];
  
  // Callbacks para notificar cambios
  private onChunkGenerated?: (chunk: ChunkSnapshot) => void;
  private onChunkUnloaded?: (cx: number, cy: number) => void;
  
  constructor(config: Partial<InfiniteChunkManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Crear generadores de ruido con semilla determinista
    const prng = alea(this.config.seed);
    this.foodNoise = createNoise2D(prng);
    this.waterNoise = createNoise2D(alea(this.config.seed + 1));
    this.treeNoise = createNoise2D(alea(this.config.seed + 2));
    this.stoneNoise = createNoise2D(alea(this.config.seed + 3));
    
    console.log(`[InfiniteChunkManager] Initialized with seed ${this.config.seed}`);
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
    const [cx, cy] = key.split(',').map(Number);
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
   * Generar terreno procedural para un chunk
   */
  private generateTerrain(chunk: Chunk): void {
    if (chunk.state === 'dormant') {
      chunk.activate();
    }
    
    const worldX = chunk.worldX;
    const worldY = chunk.worldY;
    
    // Escalas de ruido para diferentes características
    const FOOD_SCALE = 0.02;
    const WATER_SCALE = 0.015;
    const TREE_SCALE = 0.03;
    const STONE_SCALE = 0.01;
    
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = worldX + lx;
        const gy = worldY + ly;
        
        // Food: ruido con octavas
        let food = 0.5 + 0.5 * this.foodNoise(gx * FOOD_SCALE, gy * FOOD_SCALE);
        food += 0.25 * (0.5 + 0.5 * this.foodNoise(gx * FOOD_SCALE * 2, gy * FOOD_SCALE * 2));
        food = Math.min(1, Math.max(0, food / 1.25));
        chunk.setValue('food', lx, ly, food * 0.5); // Valor inicial moderado
        
        // Water: zonas más grandes y suaves
        let water = 0.5 + 0.5 * this.waterNoise(gx * WATER_SCALE, gy * WATER_SCALE);
        water = Math.pow(water, 2); // Hacer agua más escasa
        if (water > 0.6) {
          chunk.setValue('water', lx, ly, (water - 0.6) * 2.5);
        }
        
        // Trees: correlacionado con food pero menos frecuente
        const treePotential = this.treeNoise(gx * TREE_SCALE, gy * TREE_SCALE);
        if (treePotential > 0.4 && food > 0.3) {
          chunk.setValue('trees', lx, ly, (treePotential - 0.4) * 1.67);
        }
        
        // Stone: zonas separadas
        const stone = 0.5 + 0.5 * this.stoneNoise(gx * STONE_SCALE, gy * STONE_SCALE);
        if (stone > 0.7 && water < 0.3) {
          chunk.setValue('stone', lx, ly, (stone - 0.7) * 3.33);
        }
      }
    }
  }
  
  /**
   * Activar y generar chunk si es necesario
   */
  ensureChunkActive(cx: number, cy: number): Chunk {
    const chunk = this.getOrCreateChunk(cx, cy);
    
    if (chunk.state === 'dormant') {
      chunk.activate();
      this.generateTerrain(chunk);
      this.activeChunks.add(this.keyFor(cx, cy));
      
      // Notificar generación
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
    
    // Calcular qué chunks son visibles
    const halfW = (viewport.width / viewport.zoom) / 2;
    const halfH = (viewport.height / viewport.zoom) / 2;
    
    const minX = viewport.centerX - halfW;
    const maxX = viewport.centerX + halfW;
    const minY = viewport.centerY - halfH;
    const maxY = viewport.centerY + halfH;
    
    const minCX = Math.floor(minX / CHUNK_SIZE) - 1;
    const maxCX = Math.ceil(maxX / CHUNK_SIZE) + 1;
    const minCY = Math.floor(minY / CHUNK_SIZE) - 1;
    const maxCY = Math.ceil(maxY / CHUNK_SIZE) + 1;
    
    // Activar chunks visibles
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = this.keyFor(cx, cy);
        const chunk = this.getChunk(cx, cy);
        
        if (!chunk || chunk.state === 'dormant') {
          const newChunk = this.ensureChunkActive(cx, cy);
          newChunks.push(this.serializeChunk(newChunk, true));
        }
        
        this.chunkAccessTimes.set(key, Date.now());
      }
    }
    
    // Agregar centro de viewport como foco
    this.focusCenters = [{ x: viewport.centerX, y: viewport.centerY, priority: 1 }];
    
    return newChunks;
  }
  
  /**
   * Obtener TODOS los chunks visibles en un viewport (para envío inicial)
   */
  getChunksForViewport(viewport: ViewportData): ChunkSnapshot[] {
    const visibleChunks: ChunkSnapshot[] = [];
    
    // Calcular qué chunks son visibles
    const halfW = (viewport.width / viewport.zoom) / 2;
    const halfH = (viewport.height / viewport.zoom) / 2;
    
    const minX = viewport.centerX - halfW;
    const maxX = viewport.centerX + halfW;
    const minY = viewport.centerY - halfH;
    const maxY = viewport.centerY + halfH;
    
    const minCX = Math.floor(minX / CHUNK_SIZE) - 1;
    const maxCX = Math.ceil(maxX / CHUNK_SIZE) + 1;
    const minCY = Math.floor(minY / CHUNK_SIZE) - 1;
    const maxCY = Math.ceil(maxY / CHUNK_SIZE) + 1;
    
    console.log(`[InfiniteChunkManager] getChunksForViewport: cx ${minCX}-${maxCX}, cy ${minCY}-${maxCY}`);
    
    // Obtener todos los chunks visibles (generarlos si no existen)
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
  updateFromParticles(particles: Array<{ x: number; y: number; alive: boolean }>): ChunkSnapshot[] {
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
        if (!chunk || chunk.state === 'dormant') {
          const newChunk = this.ensureChunkActive(cx, cy);
          newChunks.push(this.serializeChunk(newChunk, true));
        }
        
        this.chunkAccessTimes.set(key, Date.now());
        
        // También pre-generar chunks adyacentes
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const adjKey = this.keyFor(cx + dx, cy + dy);
            const adjChunk = this.getChunk(cx + dx, cy + dy);
            
            if (!adjChunk || adjChunk.state === 'dormant') {
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
    
    // Limitar por cantidad
    if (this.chunks.size > this.config.maxCachedChunks) {
      const sortedByAge = [...this.chunkAccessTimes.entries()]
        .sort((a, b) => a[1] - b[1]);
      
      const toRemove = sortedByAge.slice(0, this.chunks.size - this.config.maxCachedChunks);
      
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
    
    // También dormir chunks muy antiguos
    for (const [key, lastAccess] of this.chunkAccessTimes) {
      if (now - lastAccess > this.config.sleepTimeout) {
        const chunk = this.chunks.get(key);
        if (chunk && chunk.state !== 'dormant') {
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
    
    // Solo serializar campos activos
    const activeFields: FieldType[] = ['food', 'water', 'trees', 'stone'];
    for (const type of activeFields) {
      const field = chunk.getField(type);
      if (field) {
        const buffer = field.getBuffer();
        fields[type] = new ArrayBuffer(buffer.byteLength);
        new Float32Array(fields[type] as ArrayBuffer).set(buffer);
      }
    }
    
    return {
      cx: chunk.cx,
      cy: chunk.cy,
      worldX: chunk.worldX,
      worldY: chunk.worldY,
      size: CHUNK_SIZE,
      fields,
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
      if (chunk && chunk.state !== 'dormant') {
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
    
    if (!chunk || chunk.state === 'dormant') {
      return 0;
    }
    
    const localX = worldX - chunk.worldX;
    const localY = worldY - chunk.worldY;
    return chunk.getValue(type, localX, localY);
  }
  
  /**
   * Establecer valor de campo
   */
  setValue(type: FieldType, worldX: number, worldY: number, value: number): void {
    const chunk = this.getOrCreateChunkAt(worldX, worldY);
    if (chunk.state === 'dormant') {
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
      if (!chunk || chunk.state === 'dormant') continue;
      
      chunk.diffuseDecayStep();
      if (chunk.state === 'hyper') {
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
      if (chunk.state === 'dormant') dormant++;
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
    let minCX = Infinity, maxCX = -Infinity;
    let minCY = Infinity, maxCY = -Infinity;
    
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
