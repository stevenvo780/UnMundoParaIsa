/**
 * LOD (Level of Detail) - Sistema de detalle adaptativo
 * Ajusta la precisión de simulación según distancia/importancia
 */

import { WORLD } from "../types";

export type LODLevel = "high" | "medium" | "low" | "dormant";

export interface LODConfig {
  thresholds: {
    high: number;
    medium: number;
    low: number;
    dormant: number;
  };

  tickRates: {
    high: number;
    medium: number;
    low: number;
    dormant: number;
  };

  fieldResolution: {
    high: number;
    medium: number;
    low: number;
    dormant: number;
  };
}

const DEFAULT_CONFIG: LODConfig = {
  thresholds: {
    high: 128,
    medium: 256,
    low: 512,
    dormant: 1024,
  },
  tickRates: {
    high: 1,
    medium: 3,
    low: 10,
    dormant: 50,
  },
  fieldResolution: {
    high: 1,
    medium: 2,
    low: 4,
    dormant: 8,
  },
};

/**
 * Punto de atención (donde el usuario está mirando)
 */
export interface FocusPoint {
  x: number;
  y: number;
  radius: number;
  weight: number;
}

/**
 * Región con nivel LOD asignado
 */
export interface LODRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  level: LODLevel;
  tickRate: number;
  ticksSinceUpdate: number;
}

/**
 * LODManager - Gestiona niveles de detalle por región
 */
export class LODManager {
  private config: LODConfig;
  private regions: Map<string, LODRegion> = new Map();

  private focusPoints: FocusPoint[] = [];

  private regionSize: number;
  private gridWidth: number;
  private gridHeight: number;

  private levelCache: LODLevel[];
  private cacheValid = false;

  constructor(config?: Partial<LODConfig>, regionSize: number = 64) {
    this.config = {
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...config?.thresholds },
      tickRates: { ...DEFAULT_CONFIG.tickRates, ...config?.tickRates },
      fieldResolution: {
        ...DEFAULT_CONFIG.fieldResolution,
        ...config?.fieldResolution,
      },
    };

    this.regionSize = regionSize;
    this.gridWidth = Math.ceil(WORLD.WIDTH / regionSize);
    this.gridHeight = Math.ceil(WORLD.HEIGHT / regionSize);

    this.levelCache = new Array<LODLevel>(
      this.gridWidth * this.gridHeight,
    ).fill("dormant");

    this.initializeRegions();
  }

  private initializeRegions(): void {
    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const key = `${gx},${gy}`;
        this.regions.set(key, {
          x: gx * this.regionSize,
          y: gy * this.regionSize,
          width: this.regionSize,
          height: this.regionSize,
          level: "dormant",
          tickRate: this.config.tickRates.dormant,
          ticksSinceUpdate: 0,
        });
      }
    }
  }

  /**
   * Establecer puntos de foco (típicamente posición de cámara)
   */
  setFocusPoints(points: FocusPoint[]): void {
    this.focusPoints = points;
    this.cacheValid = false;
  }

  /**
   * Agregar punto de foco (sin reemplazar existentes)
   */
  addFocusPoint(point: FocusPoint): void {
    this.focusPoints.push(point);
    this.cacheValid = false;
  }

  /**
   * Limpiar puntos de foco
   */
  clearFocusPoints(): void {
    this.focusPoints = [];
    this.cacheValid = false;
  }

  /**
   * Recalcular niveles LOD para todas las regiones
   */
  updateLevels(): void {
    if (this.cacheValid) return;

    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const key = `${gx},${gy}`;
        const region = this.regions.get(key)!;

        const cx = region.x + this.regionSize / 2;
        const cy = region.y + this.regionSize / 2;

        let minDist = Infinity;

        for (const focus of this.focusPoints) {
          const dx = cx - focus.x;
          const dy = cy - focus.y;
          const dist = Math.sqrt(dx * dx + dy * dy) - focus.radius;

          const adjustedDist = dist / focus.weight;
          minDist = Math.min(minDist, adjustedDist);
        }

        const level = this.distanceToLevel(minDist);
        region.level = level;
        region.tickRate = this.config.tickRates[level];

        const idx = gy * this.gridWidth + gx;
        this.levelCache[idx] = level;
      }
    }

    this.cacheValid = true;
  }

  private distanceToLevel(dist: number): LODLevel {
    const t = this.config.thresholds;

    if (dist < t.high) return "high";
    if (dist < t.medium) return "medium";
    if (dist < t.low) return "low";
    return "dormant";
  }

  /**
   * Obtener nivel LOD para una posición world
   */
  getLevelAt(worldX: number, worldY: number): LODLevel {
    if (!this.cacheValid) {
      this.updateLevels();
    }

    const gx = Math.floor(worldX / this.regionSize);
    const gy = Math.floor(worldY / this.regionSize);

    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
      return "dormant";
    }

    return this.levelCache[gy * this.gridWidth + gx];
  }

  /**
   * Verificar si una región debe actualizarse este tick
   */
  shouldUpdate(worldX: number, worldY: number, _currentTick: number): boolean {
    const gx = Math.floor(worldX / this.regionSize);
    const gy = Math.floor(worldY / this.regionSize);
    const key = `${gx},${gy}`;

    const region = this.regions.get(key);
    if (!region) return false;

    region.ticksSinceUpdate++;

    if (region.ticksSinceUpdate >= region.tickRate) {
      region.ticksSinceUpdate = 0;
      return true;
    }

    return false;
  }

  /**
   * Obtener tick rate para una posición
   */
  getTickRateAt(worldX: number, worldY: number): number {
    const level = this.getLevelAt(worldX, worldY);
    return this.config.tickRates[level];
  }

  /**
   * Obtener resolución de campos para una posición
   */
  getFieldResolutionAt(worldX: number, worldY: number): number {
    const level = this.getLevelAt(worldX, worldY);
    return this.config.fieldResolution[level];
  }

  /**
   * Obtener regiones por nivel
   */
  getRegionsByLevel(level: LODLevel): LODRegion[] {
    if (!this.cacheValid) {
      this.updateLevels();
    }

    const result: LODRegion[] = [];

    for (const region of this.regions.values()) {
      if (region.level === level) {
        result.push(region);
      }
    }

    return result;
  }

  /**
   * Obtener regiones que deben actualizarse ahora
   */
  getRegionsToUpdate(): LODRegion[] {
    const result: LODRegion[] = [];

    for (const region of this.regions.values()) {
      if (region.ticksSinceUpdate >= region.tickRate) {
        result.push(region);
      }
    }

    return result;
  }

  /**
   * Tick - actualizar contadores y niveles si necesario
   */
  tick(): void {
    for (const region of this.regions.values()) {
      region.ticksSinceUpdate++;
    }
  }

  /**
   * Forzar recálculo de niveles
   */
  invalidate(): void {
    this.cacheValid = false;
  }

  /**
   * Stats
   */
  getStats(): Record<LODLevel, number> {
    if (!this.cacheValid) {
      this.updateLevels();
    }

    const counts: Record<LODLevel, number> = {
      high: 0,
      medium: 0,
      low: 0,
      dormant: 0,
    };

    for (const region of this.regions.values()) {
      counts[region.level]++;
    }

    return counts;
  }

  /**
   * Debug: obtener mapa visual de niveles
   */
  getDebugMap(): string[][] {
    if (!this.cacheValid) {
      this.updateLevels();
    }

    const map: string[][] = [];
    const symbols: Record<LODLevel, string> = {
      high: "H",
      medium: "M",
      low: "L",
      dormant: ".",
    };

    for (let gy = 0; gy < this.gridHeight; gy++) {
      const row: string[] = [];
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const key = `${gx},${gy}`;
        const region = this.regions.get(key)!;
        row.push(symbols[region.level]);
      }
      map.push(row);
    }

    return map;
  }
}
