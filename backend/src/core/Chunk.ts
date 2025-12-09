/**
 * Chunk - Región 64x64 del mundo con sus propios campos locales
 * Permite activación/desactivación por proximidad (LOD)
 */

import { Field } from './Field.js';
import { FieldType, FieldConfig, DEFAULT_FIELD_CONFIGS, WORLD } from '../types.js';
import { BiomeType } from './BiomeResolver.js';

export const CHUNK_SIZE = 64;

export interface ChunkCoord {
  cx: number;  // Chunk X (0, 1, 2, ...)
  cy: number;  // Chunk Y
}

export type ChunkState = 'dormant' | 'active' | 'hyper';

/**
 * Chunk - Subdivisión del mundo
 */
export class Chunk {
  readonly cx: number;
  readonly cy: number;
  readonly worldX: number;  // Posición en coordenadas del mundo
  readonly worldY: number;
  
  private fields: Map<FieldType, Field> = new Map();
  private _state: ChunkState = 'dormant';
  private lastActiveTime = 0;
  
  // Array de biomas para cada tile del chunk
  private _biomes: Uint8Array | null = null;
  
  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
    this.worldX = cx * CHUNK_SIZE;
    this.worldY = cy * CHUNK_SIZE;
  }
  
  /**
   * Estado del chunk
   */
  get state(): ChunkState {
    return this._state;
  }
  
  /**
   * Obtener bioma en coordenadas locales
   */
  getBiome(localX: number, localY: number): BiomeType {
    if (!this._biomes) return BiomeType.GRASSLAND;
    const index = localY * CHUNK_SIZE + localX;
    return Object.values(BiomeType)[this._biomes[index]] as BiomeType;
  }
  
  /**
   * Establecer bioma en coordenadas locales
   */
  setBiome(localX: number, localY: number, biome: BiomeType): void {
    if (!this._biomes) {
      this._biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    }
    const index = localY * CHUNK_SIZE + localX;
    const biomeIndex = Object.values(BiomeType).indexOf(biome);
    this._biomes[index] = biomeIndex >= 0 ? biomeIndex : 0;
  }
  
  /**
   * Obtener array completo de biomas (para serialización)
   */
  getBiomes(): Uint8Array | null {
    return this._biomes;
  }
  
  /**
   * Establecer array de biomas (para deserialización)
   */
  setBiomes(biomes: Uint8Array): void {
    this._biomes = biomes;
  }
  
  /**
   * Activar chunk - crear campos si no existen
   */
  activate(): void {
    if (this._state !== 'dormant') return;
    
    // Crear campos para este chunk
    const fieldTypes: FieldType[] = [
      'food', 'water', 'cost', 'danger', 'trees', 'stone',
      'trail0', 'trail1', 'trail2', 'trail3',
      'population', 'labor'
    ];
    
    for (const type of fieldTypes) {
      const config = DEFAULT_FIELD_CONFIGS[type];
      const field = new Field(CHUNK_SIZE, CHUNK_SIZE, config);
      this.fields.set(type, field);
    }
    
    this._state = 'active';
    this.lastActiveTime = Date.now();
  }
  
  /**
   * Poner chunk en modo hyper (actualización más frecuente)
   */
  setHyper(): void {
    if (this._state === 'dormant') {
      this.activate();
    }
    this._state = 'hyper';
    this.lastActiveTime = Date.now();
  }
  
  /**
   * Dormir chunk - liberar memoria
   */
  sleep(): void {
    if (this._state === 'dormant') return;
    
    // Guardar estado comprimido si es necesario antes de dormir
    // Por ahora solo limpiamos
    this.fields.clear();
    this._state = 'dormant';
  }
  
  /**
   * Obtener un campo del chunk
   */
  getField(type: FieldType): Field | undefined {
    return this.fields.get(type);
  }
  
  /**
   * Obtener valor de campo en coordenadas locales del chunk
   */
  getValue(type: FieldType, localX: number, localY: number): number {
    const field = this.fields.get(type);
    return field ? field.get(localX, localY) : 0;
  }
  
  /**
   * Establecer valor de campo
   */
  setValue(type: FieldType, localX: number, localY: number, value: number): void {
    const field = this.fields.get(type);
    if (field) {
      field.set(localX, localY, value);
    }
  }
  
  /**
   * Añadir valor a campo
   */
  addValue(type: FieldType, localX: number, localY: number, delta: number): void {
    const field = this.fields.get(type);
    if (field) {
      field.add(localX, localY, delta);
    }
  }
  
  /**
   * Paso de difusión para todos los campos
   */
  diffuseDecayStep(): void {
    if (this._state === 'dormant') return;
    
    for (const field of this.fields.values()) {
      field.diffuseDecayStep();
    }
  }
  
  /**
   * Paso de crecimiento para recursos
   */
  growthStep(): void {
    if (this._state === 'dormant') return;
    
    this.getField('food')?.growthStep();
    this.getField('trees')?.growthStep();
  }
  
  /**
   * Verificar si un punto está dentro de este chunk
   */
  contains(worldX: number, worldY: number): boolean {
    return (
      worldX >= this.worldX &&
      worldX < this.worldX + CHUNK_SIZE &&
      worldY >= this.worldY &&
      worldY < this.worldY + CHUNK_SIZE
    );
  }
  
  /**
   * Convertir coordenadas del mundo a locales del chunk
   */
  toLocal(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.worldX,
      y: worldY - this.worldY,
    };
  }
  
  /**
   * Obtener tiempo desde última activación
   */
  getIdleTime(): number {
    return Date.now() - this.lastActiveTime;
  }
  
  /**
   * Serializar para persistencia
   */
  serialize(): ChunkData {
    const fields: Partial<Record<FieldType, Float32Array>> = {};
    
    for (const [type, field] of this.fields) {
      fields[type] = field.getBuffer();
    }
    
    return {
      cx: this.cx,
      cy: this.cy,
      state: this._state,
      fields,
    };
  }
  
  /**
   * Deserializar desde datos
   */
  static deserialize(data: ChunkData): Chunk {
    const chunk = new Chunk(data.cx, data.cy);
    
    if (data.state !== 'dormant') {
      chunk.activate();
      
      for (const [type, buffer] of Object.entries(data.fields)) {
        const field = chunk.getField(type as FieldType);
        if (field && buffer) {
          field.getBuffer().set(buffer);
        }
      }
      
      chunk._state = data.state;
    }
    
    return chunk;
  }
}

export interface ChunkData {
  cx: number;
  cy: number;
  state: ChunkState;
  fields: Partial<Record<FieldType, Float32Array>>;
}
