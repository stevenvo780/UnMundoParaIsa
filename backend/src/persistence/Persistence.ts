/**
 * Persistence - Sistema de guardado/carga emergente
 * Serializa solo lo esencial, el resto se reconstruye
 */

import { Particle } from '../types.js';
import { Quest } from '../quests/EmergentQuests.js';

// ============================================
// Tipos
// ============================================

export interface MinimalParticle {
  x: number;
  y: number;
  e: number;    // energy (abreviado)
  s: number;    // seed
}

export interface SaveData {
  version: string;
  timestamp: number;
  tick: number;
  
  // Estado mínimo
  particles: MinimalParticle[];
  
  // Progreso narrativo
  discoveredArtifacts: string[];
  completedQuests: string[];
  unlockedDialogues: string[];
  
  // Comunidades persistentes
  communities: {
    id: number;
    cx: number;
    cy: number;
    pop: number;
    age: number;
  }[];
  
  // Estadísticas globales
  stats: {
    totalBirths: number;
    totalDeaths: number;
    totalDays: number;
    peakPopulation: number;
    exploredArea: number;
  };
  
  // Configuración del usuario
  config?: {
    seed?: number;
    tickMs?: number;
  };
  
  // Checksum para integridad
  checksum: string;
}

export interface PersistenceConfig {
  autoSaveInterval: number;   // Ticks entre auto-saves
  maxSaveSlots: number;
  compressionEnabled: boolean;
}

const DEFAULT_CONFIG: PersistenceConfig = {
  autoSaveInterval: 6000,     // ~5 minutos a 20 tps
  maxSaveSlots: 5,
  compressionEnabled: true,
};

// ============================================
// Serialización
// ============================================

/**
 * Comprimir partículas a formato mínimo
 */
export function serializeParticles(particles: Particle[]): MinimalParticle[] {
  return particles
    .filter(p => p.alive)
    .map(p => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      e: Math.round(p.energy * 100) / 100,
      s: p.seed,
    }));
}

/**
 * Reconstruir partículas desde formato mínimo
 */
export function deserializeParticles(data: MinimalParticle[], startId: number): Particle[] {
  return data.map((p, i) => ({
    id: startId + i,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    energy: p.e,
    seed: p.s,
    alive: true,
  }));
}

/**
 * Calcular checksum simple
 */
function calculateChecksum(data: Omit<SaveData, 'checksum'>): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verificar checksum
 */
function verifyChecksum(data: SaveData): boolean {
  const { checksum, ...rest } = data;
  return calculateChecksum(rest) === checksum;
}

// ============================================
// PersistenceManager
// ============================================

export class PersistenceManager {
  private config: PersistenceConfig;
  private lastAutoSave = 0;
  private saveHistory: SaveData[] = [];
  
  // Estadísticas acumuladas
  private totalBirths = 0;
  private totalDeaths = 0;
  private peakPopulation = 0;
  private exploredCells = new Set<string>();
  
  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Actualizar estadísticas
   */
  updateStats(births: number, deaths: number, population: number): void {
    this.totalBirths += births;
    this.totalDeaths += deaths;
    this.peakPopulation = Math.max(this.peakPopulation, population);
  }
  
  /**
   * Marcar celda como explorada
   */
  markExplored(x: number, y: number): void {
    const key = `${Math.floor(x / 8)},${Math.floor(y / 8)}`;
    this.exploredCells.add(key);
  }
  
  /**
   * Crear SaveData
   */
  createSaveData(
    tick: number,
    particles: Particle[],
    discoveredArtifacts: string[],
    completedQuests: Quest[],
    communities: { id: number; centerX: number; centerY: number; population: number; age: number }[],
    dayLength: number,
    config?: { seed?: number; tickMs?: number }
  ): SaveData {
    const dataWithoutChecksum = {
      version: '1.0.0',
      timestamp: Date.now(),
      tick,
      particles: serializeParticles(particles),
      discoveredArtifacts,
      completedQuests: completedQuests.map(q => q.id),
      unlockedDialogues: [],
      communities: communities.map(c => ({
        id: c.id,
        cx: Math.round(c.centerX),
        cy: Math.round(c.centerY),
        pop: c.population,
        age: c.age,
      })),
      stats: {
        totalBirths: this.totalBirths,
        totalDeaths: this.totalDeaths,
        totalDays: Math.floor(tick / dayLength),
        peakPopulation: this.peakPopulation,
        exploredArea: this.exploredCells.size,
      },
      config,
    };
    
    return {
      ...dataWithoutChecksum,
      checksum: calculateChecksum(dataWithoutChecksum),
    };
  }
  
  /**
   * Verificar si es hora de auto-save
   */
  shouldAutoSave(tick: number): boolean {
    return tick - this.lastAutoSave >= this.config.autoSaveInterval;
  }
  
  /**
   * Registrar auto-save
   */
  registerAutoSave(tick: number): void {
    this.lastAutoSave = tick;
  }
  
  /**
   * Serializar a JSON comprimido
   */
  serialize(data: SaveData): string {
    const json = JSON.stringify(data);
    if (this.config.compressionEnabled) {
      // Compresión simple: eliminar espacios
      return json.replace(/\s+/g, '');
    }
    return json;
  }
  
  /**
   * Deserializar desde JSON
   */
  deserialize(json: string): SaveData | null {
    try {
      const data = JSON.parse(json) as SaveData;
      
      // Verificar checksum
      if (!verifyChecksum(data)) {
        console.error('[Persistence] Checksum inválido');
        return null;
      }
      
      // Verificar versión
      if (!data.version) {
        console.error('[Persistence] Versión no especificada');
        return null;
      }
      
      return data;
    } catch (e) {
      console.error('[Persistence] Error deserializando:', e);
      return null;
    }
  }
  
  /**
   * Calcular tamaño aproximado en bytes
   */
  estimateSize(data: SaveData): number {
    return this.serialize(data).length;
  }
  
  /**
   * Restaurar estadísticas desde SaveData
   */
  restoreStats(data: SaveData): void {
    this.totalBirths = data.stats.totalBirths;
    this.totalDeaths = data.stats.totalDeaths;
    this.peakPopulation = data.stats.peakPopulation;
    // exploredArea no se puede restaurar exactamente, solo el conteo
  }
  
  /**
   * Obtener estadísticas actuales
   */
  getStats(): { totalBirths: number; totalDeaths: number; peakPopulation: number; exploredArea: number } {
    return {
      totalBirths: this.totalBirths,
      totalDeaths: this.totalDeaths,
      peakPopulation: this.peakPopulation,
      exploredArea: this.exploredCells.size,
    };
  }
}

// ============================================
// Utilidades de almacenamiento (Backend - File-based)
// ============================================

import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const SAVE_DIR = process.env.SAVE_DIR || './saves';

/**
 * Guardar en archivo
 */
export function saveToFile(filename: string, data: SaveData): boolean {
  try {
    const filepath = join(SAVE_DIR, `${filename}.json`);
    const json = JSON.stringify(data, null, 2);
    writeFileSync(filepath, json, 'utf-8');
    console.log(`[Persistence] Guardado: ${filepath} (${json.length} bytes)`);
    return true;
  } catch (e) {
    console.error('[Persistence] Error guardando:', e);
    return false;
  }
}

/**
 * Cargar desde archivo
 */
export function loadFromFile(filename: string): SaveData | null {
  try {
    const filepath = join(SAVE_DIR, `${filename}.json`);
    if (!existsSync(filepath)) return null;
    
    const json = readFileSync(filepath, 'utf-8');
    const data = JSON.parse(json) as SaveData;
    
    if (!verifyChecksum(data)) {
      console.error('[Persistence] Checksum inválido');
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('[Persistence] Error cargando:', e);
    return null;
  }
}

/**
 * Listar saves disponibles
 */
export function listSaves(): string[] {
  try {
    if (!existsSync(SAVE_DIR)) return [];
    
    return readdirSync(SAVE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();
  } catch {
    return [];
  }
}
