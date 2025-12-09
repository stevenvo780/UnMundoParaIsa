/**
 * StructureManager - Sistema de estructuras emergentes
 * 
 * Las estructuras emergen naturalmente cuando:
 * 1. Alto trail (caminos frecuentados) indica actividad
 * 2. Partículas con alta energía depositan materiales
 * 3. Las estructuras dan protección/beneficios
 */

import { FieldType } from '../types.js';

// Tipos de estructuras que pueden emerger
export enum StructureType {
  CAMP = 'camp',           // Campamento básico (trail alto)
  SHELTER = 'shelter',     // Refugio (trail + recursos)
  SETTLEMENT = 'settlement', // Asentamiento (múltiples refugios)
  STORAGE = 'storage',     // Almacén (cerca de comida)
  WATCHTOWER = 'watchtower', // Torre de vigilancia (elevación alta)
}

export interface Structure {
  id: number;
  type: StructureType;
  x: number;
  y: number;
  health: number;         // 0-1: condición
  level: number;          // 1-3: nivel de desarrollo
  createdTick: number;
  lastUsedTick: number;
  builders: number[];     // IDs de partículas que contribuyeron
}

export interface StructureConfig {
  // Umbrales para crear estructuras
  campTrailThreshold: number;      // Trail mínimo para camp
  shelterTrailThreshold: number;   // Trail mínimo para shelter
  shelterFoodThreshold: number;    // Food mínimo para shelter
  
  // Decaimiento
  decayRate: number;               // Decaimiento por tick sin uso
  useBonus: number;                // Restauración por uso
  
  // Límites
  maxStructuresPerChunk: number;
  minDistanceBetween: number;      // Distancia mínima entre estructuras
}

const DEFAULT_CONFIG: StructureConfig = {
  campTrailThreshold: 0.12,       // Reducido para crear camps más fácil
  shelterTrailThreshold: 0.25,    // Reducido para shelters más frecuentes
  shelterFoodThreshold: 0.2,      // Reducido
  decayRate: 0.0005,              // Decaen más lento
  useBonus: 0.02,
  maxStructuresPerChunk: 6,       // Más estructuras por chunk
  minDistanceBetween: 15,         // Más cercanas permitidas
};

/**
 * StructureManager - Gestiona estructuras emergentes
 */
export class StructureManager {
  private structures: Map<number, Structure> = new Map();
  private structureIdCounter = 0;
  private config: StructureConfig;
  
  // Índice espacial simple para búsqueda rápida
  private spatialIndex: Map<string, Set<number>> = new Map();
  
  constructor(config: Partial<StructureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Clave espacial para indexación por celda de 32x32
   */
  private getSpatialKey(x: number, y: number): string {
    const cx = Math.floor(x / 32);
    const cy = Math.floor(y / 32);
    return `${cx},${cy}`;
  }
  
  /**
   * Intentar crear estructura en una posición
   * Llamar cuando una partícula con alta energía está en zona de alto trail
   */
  tryCreateStructure(
    x: number,
    y: number,
    trail: number,
    food: number,
    energy: number,
    particleId: number,
    tick: number,
  ): Structure | null {
    // Necesita energía alta para construir
    if (energy < 0.6) return null;
    
    // Verificar si ya hay estructura cerca
    if (this.hasStructureNear(x, y, this.config.minDistanceBetween)) {
      // Si hay estructura cerca, "usarla" en lugar de crear nueva
      const nearby = this.getNearbyStructures(x, y, this.config.minDistanceBetween);
      if (nearby.length > 0) {
        this.useStructure(nearby[0].id, tick);
      }
      return null;
    }
    
    // Determinar tipo de estructura según condiciones
    let type: StructureType | null = null;
    
    if (trail >= this.config.shelterTrailThreshold && food >= this.config.shelterFoodThreshold) {
      type = StructureType.SHELTER;
    } else if (trail >= this.config.campTrailThreshold) {
      type = StructureType.CAMP;
    }
    
    if (!type) return null;
    
    // Verificar límite por chunk
    const key = this.getSpatialKey(x, y);
    const existing = this.spatialIndex.get(key);
    if (existing && existing.size >= this.config.maxStructuresPerChunk) {
      return null;
    }
    
    // Crear estructura
    const structure: Structure = {
      id: this.structureIdCounter++,
      type,
      x,
      y,
      health: 0.5,  // Empieza a medio construir
      level: 1,
      createdTick: tick,
      lastUsedTick: tick,
      builders: [particleId],
    };
    
    this.structures.set(structure.id, structure);
    
    // Agregar al índice espacial
    if (!this.spatialIndex.has(key)) {
      this.spatialIndex.set(key, new Set());
    }
    this.spatialIndex.get(key)!.add(structure.id);
    
    console.log(`[Structure] Created ${type} at (${x},${y}) by particle ${particleId}`);
    
    return structure;
  }
  
  /**
   * Verificar si hay estructura cerca
   */
  hasStructureNear(x: number, y: number, radius: number): boolean {
    return this.getNearbyStructures(x, y, radius).length > 0;
  }
  
  /**
   * Obtener estructuras cercanas
   */
  getNearbyStructures(x: number, y: number, radius: number): Structure[] {
    const nearby: Structure[] = [];
    const radiusSq = radius * radius;
    
    // Buscar en celdas cercanas
    const cellRadius = Math.ceil(radius / 32) + 1;
    const baseCx = Math.floor(x / 32);
    const baseCy = Math.floor(y / 32);
    
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = `${baseCx + dx},${baseCy + dy}`;
        const ids = this.spatialIndex.get(key);
        if (!ids) continue;
        
        for (const id of ids) {
          const s = this.structures.get(id);
          if (!s) continue;
          
          const distSq = (s.x - x) ** 2 + (s.y - y) ** 2;
          if (distSq <= radiusSq) {
            nearby.push(s);
          }
        }
      }
    }
    
    return nearby;
  }
  
  /**
   * Marcar estructura como usada (previene decay)
   */
  useStructure(id: number, tick: number): void {
    const s = this.structures.get(id);
    if (!s) return;
    
    s.lastUsedTick = tick;
    s.health = Math.min(1, s.health + this.config.useBonus);
  }
  
  /**
   * Contribuir a construcción de estructura
   */
  contributeToStructure(id: number, particleId: number, amount: number = 0.05): void {
    const s = this.structures.get(id);
    if (!s) return;
    
    s.health = Math.min(1, s.health + amount);
    
    if (!s.builders.includes(particleId)) {
      s.builders.push(particleId);
    }
    
    // Subir de nivel si tiene suficiente health y contribuidores
    if (s.health >= 0.9 && s.builders.length >= 3 && s.level < 3) {
      s.level++;
      console.log(`[Structure] ${s.type} at (${s.x},${s.y}) upgraded to level ${s.level}`);
    }
  }
  
  /**
   * Actualizar todas las estructuras (decaimiento)
   */
  update(tick: number): void {
    const toRemove: number[] = [];
    
    for (const [id, s] of this.structures) {
      // Decaimiento si no se usa
      const ticksSinceUse = tick - s.lastUsedTick;
      if (ticksSinceUse > 50) {
        s.health -= this.config.decayRate * Math.min(ticksSinceUse / 100, 2);
      }
      
      // Eliminar si salud muy baja
      if (s.health <= 0) {
        toRemove.push(id);
      }
    }
    
    // Eliminar estructuras destruidas
    for (const id of toRemove) {
      const s = this.structures.get(id);
      if (s) {
        console.log(`[Structure] ${s.type} at (${s.x},${s.y}) destroyed`);
        const key = this.getSpatialKey(s.x, s.y);
        this.spatialIndex.get(key)?.delete(id);
        this.structures.delete(id);
      }
    }
  }
  
  /**
   * Obtener beneficio de protección para una partícula
   * Las partículas cerca de estructuras gastan menos energía
   */
  getProtectionBonus(x: number, y: number): number {
    const nearby = this.getNearbyStructures(x, y, 10);
    if (nearby.length === 0) return 0;
    
    // Mejor estructura cercana
    let bestBonus = 0;
    for (const s of nearby) {
      const dist = Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2);
      const distFactor = 1 - (dist / 10);
      
      let typeBonus = 0;
      switch (s.type) {
        case StructureType.CAMP: typeBonus = 0.1; break;
        case StructureType.SHELTER: typeBonus = 0.3; break;
        case StructureType.SETTLEMENT: typeBonus = 0.5; break;
        default: typeBonus = 0.05;
      }
      
      const bonus = typeBonus * distFactor * s.health * s.level;
      if (bonus > bestBonus) bestBonus = bonus;
    }
    
    return bestBonus;
  }
  
  /**
   * Serializar estructuras para enviar al cliente
   */
  getStructuresForClient(): Array<{
    id: number;
    type: string;
    x: number;
    y: number;
    level: number;
    health: number;
  }> {
    return Array.from(this.structures.values()).map(s => ({
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      level: s.level,
      health: s.health,
    }));
  }
  
  /**
   * Estadísticas
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const s of this.structures.values()) {
      byType[s.type] = (byType[s.type] || 0) + 1;
    }
    return { total: this.structures.size, byType };
  }
}
