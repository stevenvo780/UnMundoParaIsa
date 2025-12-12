/**
 * StructureManager - Sistema de estructuras emergentes
 *
 * Las estructuras emergen naturalmente cuando:
 * 1. Alto trail (caminos frecuentados) indica actividad
 * 2. Partículas con alta energía depositan materiales
 * 3. Las estructuras dan protección/beneficios
 */

import { StructureData } from "../types";

export enum StructureType {
  CAMP = "camp",
  SHELTER = "shelter",
  SETTLEMENT = "settlement",
  STORAGE = "storage",
  WATCHTOWER = "watchtower",
  WORKBENCH = "workbench",
  CAMPFIRE = "campfire",
}

export interface Structure {
  id: number;
  type: StructureType;
  x: number;
  y: number;
  health: number;
  level: number;
  createdTick: number;
  lastUsedTick: number;
  builders: number[];
  ownerId?: number;
}

export interface StructureConfig {
  campTrailThreshold: number;
  shelterTrailThreshold: number;
  shelterFoodThreshold: number;

  decayRate: number;
  useBonus: number;

  maxStructuresPerChunk: number;
  minDistanceBetween: number;
}

const DEFAULT_CONFIG: StructureConfig = {
  campTrailThreshold: 0.12,
  shelterTrailThreshold: 0.25,
  shelterFoodThreshold: 0.2,
  decayRate: 0.0005,
  useBonus: 0.02,
  maxStructuresPerChunk: 6,
  minDistanceBetween: 15,
};

/**
 * StructureManager - Gestiona estructuras emergentes
 */
export class StructureManager {
  private structures: Map<number, Structure> = new Map();
  private structureIdCounter = 0;
  private config: StructureConfig;

  private spatialIndex: Map<string, Set<number>> = new Map();

  // Index for ownership
  private ownerIndex: Map<number, Set<number>> = new Map();

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
   * Crear estructura explícitamente (e.g. desde crafting)
   */
  createStructure(
    x: number,
    y: number,
    type: StructureType,
    builderId: number,
    tick: number,
    ownerId?: number,
  ): Structure | null {
    if (this.hasStructureNear(x, y, this.config.minDistanceBetween)) {
      return null;
    }

    const key = this.getSpatialKey(x, y);
    const existing = this.spatialIndex.get(key);
    if (existing && existing.size >= this.config.maxStructuresPerChunk) {
      return null;
    }

    const structure: Structure = {
      id: this.structureIdCounter++,
      type,
      x,
      y,
      health: 1.0, // Construido intencionalmente empieza con salud completa
      level: 1,
      createdTick: tick,
      lastUsedTick: tick,
      builders: [builderId],
      ownerId: ownerId ?? builderId, // Default to builder as owner if not specified
    };

    this.structures.set(structure.id, structure);

    if (!this.spatialIndex.has(key)) {
      this.spatialIndex.set(key, new Set());
    }
    this.spatialIndex.get(key)!.add(structure.id);

    // Update owner index
    if (structure.ownerId !== undefined) {
      if (!this.ownerIndex.has(structure.ownerId)) {
        this.ownerIndex.set(structure.ownerId, new Set());
      }
      this.ownerIndex.get(structure.ownerId)!.add(structure.id);
    }

    return structure;
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
    if (energy < 0.6) return null;

    if (this.hasStructureNear(x, y, this.config.minDistanceBetween)) {
      const nearby = this.getNearbyStructures(
        x,
        y,
        this.config.minDistanceBetween,
      );
      if (nearby.length > 0) {
        this.useStructure(nearby[0].id, tick);
      }
      return null;
    }

    let type: StructureType | null = null;

    if (
      trail >= this.config.shelterTrailThreshold &&
      food >= this.config.shelterFoodThreshold
    ) {
      type = StructureType.SHELTER;
    } else if (trail >= this.config.campTrailThreshold) {
      type = StructureType.CAMP;
    }

    if (!type) return null;

    const key = this.getSpatialKey(x, y);
    const existing = this.spatialIndex.get(key);
    if (existing && existing.size >= this.config.maxStructuresPerChunk) {
      return null;
    }

    const structure: Structure = {
      id: this.structureIdCounter++,
      type,
      x,
      y,
      health: 0.5,
      level: 1,
      createdTick: tick,
      lastUsedTick: tick,
      builders: [particleId],
    };

    this.structures.set(structure.id, structure);

    if (!this.spatialIndex.has(key)) {
      this.spatialIndex.set(key, new Set());
    }
    this.spatialIndex.get(key)!.add(structure.id);

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
  contributeToStructure(
    id: number,
    particleId: number,
    amount: number = 0.05,
  ): void {
    const s = this.structures.get(id);
    if (!s) return;

    s.health = Math.min(1, s.health + amount);

    if (!s.builders.includes(particleId)) {
      s.builders.push(particleId);
    }

    if (s.health >= 0.9 && s.builders.length >= 3 && s.level < 3) {
      s.level++;
    }
  }

  /**
   * Actualizar todas las estructuras (decaimiento)
   */
  update(tick: number): void {
    const toRemove: number[] = [];

    for (const [id, s] of this.structures) {
      const ticksSinceUse = tick - s.lastUsedTick;
      if (ticksSinceUse > 50) {
        s.health -= this.config.decayRate * Math.min(ticksSinceUse / 100, 2);
      }

      if (s.health <= 0) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const s = this.structures.get(id);
      if (s) {
        const key = this.getSpatialKey(s.x, s.y);
        this.spatialIndex.get(key)?.delete(id);

        // Cleanup owner index
        if (s.ownerId !== undefined) {
          this.ownerIndex.get(s.ownerId)?.delete(id);
        }

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

    let bestBonus = 0;
    for (const s of nearby) {
      const dist = Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2);
      const distFactor = 1 - dist / 10;

      let typeBonus = 0;
      switch (s.type) {
        case StructureType.CAMP:
          typeBonus = 0.1;
          break;
        case StructureType.SHELTER:
          typeBonus = 0.3;
          break;
        case StructureType.SETTLEMENT:
          typeBonus = 0.5;
          break;
        default:
          typeBonus = 0.05;
      }

      const bonus = typeBonus * distFactor * s.health * s.level;
      if (bonus > bestBonus) bestBonus = bonus;
    }

    return bestBonus;
  }

  /**
   * Serializar estructuras para enviar al cliente
   */
  getStructuresForClient(): StructureData[] {
    return Array.from(this.structures.values()).map((s) => ({
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      level: s.level,
      health: s.health,
      ownerId: s.ownerId,
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

  /**
   * Obtener estructuras por dueño
   */
  getStructuresByOwner(ownerId: number): Structure[] {
    const ids = this.ownerIndex.get(ownerId);
    if (!ids) return [];

    const results: Structure[] = [];
    for (const id of ids) {
      const s = this.structures.get(id);
      if (s) results.push(s);
    }
    return results;
  }

  /**
   * Asignar dueño a estructura
   */
  assignOwner(structureId: number, ownerId: number): void {
    const s = this.structures.get(structureId);
    if (!s) return;

    // Remove from old owner if exists
    if (s.ownerId !== undefined) {
      this.ownerIndex.get(s.ownerId)?.delete(structureId);
    }

    s.ownerId = ownerId;

    if (!this.ownerIndex.has(ownerId)) {
      this.ownerIndex.set(ownerId, new Set());
    }
    this.ownerIndex.get(ownerId)!.add(structureId);
  }
}
