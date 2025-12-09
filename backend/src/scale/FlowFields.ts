/**
 * FlowFields - Vectores de flujo para navegación eficiente
 * Precomputa direcciones de movimiento hacia objetivos
 */

import { WORLD, FieldConfig } from "../types.js";

export interface FlowVector {
  dx: number;
  dy: number;
  magnitude: number;
}

export type FlowTarget =
  | "food"
  | "water"
  | "shelter"
  | "community"
  | "artifact"
  | "custom";

export interface FlowFieldConfig {
  width: number;
  height: number;
  resolution: number;
  updateRate: number;
  diffuseStrength: number;
}

const DEFAULT_CONFIG: FlowFieldConfig = {
  width: WORLD.WIDTH,
  height: WORLD.HEIGHT,
  resolution: 8,
  updateRate: 10,
  diffuseStrength: 0.25,
};

/**
 * FlowField - Campo de vectores direccionales
 */
export class FlowField {
  readonly name: FlowTarget;
  private config: FlowFieldConfig;

  private gridWidth: number;
  private gridHeight: number;

  private dx: Float32Array;
  private dy: Float32Array;

  private distance: Float32Array;

  private ticksSinceUpdate = 0;
  private dirty = true;

  constructor(name: FlowTarget, config?: Partial<FlowFieldConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.gridWidth = Math.ceil(this.config.width / this.config.resolution);
    this.gridHeight = Math.ceil(this.config.height / this.config.resolution);

    const size = this.gridWidth * this.gridHeight;
    this.dx = new Float32Array(size);
    this.dy = new Float32Array(size);
    this.distance = new Float32Array(size).fill(Infinity);
  }

  /**
   * Establecer objetivos (sources) para el flow field
   * Los vectores fluirán HACIA estos puntos
   */
  setTargets(
    targets: Array<{ x: number; y: number; strength?: number }>,
  ): void {
    this.distance.fill(Infinity);

    for (const target of targets) {
      const gx = Math.floor(target.x / this.config.resolution);
      const gy = Math.floor(target.y / this.config.resolution);

      if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
        const idx = gy * this.gridWidth + gx;
        this.distance[idx] = 0;
      }
    }

    this.dirty = true;
  }

  /**
   * Construir desde un campo escalar (valores > threshold son objetivos)
   */
  setFromField(field: Float32Array, threshold: number = 0.5): void {
    this.distance.fill(Infinity);

    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const worldX = gx * this.config.resolution + this.config.resolution / 2;
        const worldY = gy * this.config.resolution + this.config.resolution / 2;

        if (
          worldX >= 0 &&
          worldX < this.config.width &&
          worldY >= 0 &&
          worldY < this.config.height
        ) {
          const fieldIdx =
            Math.floor(worldY) * this.config.width + Math.floor(worldX);

          if (field[fieldIdx] > threshold) {
            const idx = gy * this.gridWidth + gx;
            this.distance[idx] = 0;
          }
        }
      }
    }

    this.dirty = true;
  }

  /**
   * Calcular vectores de flujo (BFS + gradient)
   */
  compute(): void {
    if (!this.dirty) return;

    this.computeDistances();

    this.computeGradients();

    this.dirty = false;
  }

  private computeDistances(): void {
    const queue: number[] = [];

    for (let i = 0; i < this.distance.length; i++) {
      if (this.distance[i] === 0) {
        queue.push(i);
      }
    }

    const dirs = [
      { dx: -1, dy: 0, cost: 1 },
      { dx: 1, dy: 0, cost: 1 },
      { dx: 0, dy: -1, cost: 1 },
      { dx: 0, dy: 1, cost: 1 },
      { dx: -1, dy: -1, cost: 1.414 },
      { dx: 1, dy: -1, cost: 1.414 },
      { dx: -1, dy: 1, cost: 1.414 },
      { dx: 1, dy: 1, cost: 1.414 },
    ];

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const x = idx % this.gridWidth;
      const y = Math.floor(idx / this.gridWidth);
      const dist = this.distance[idx];

      for (const dir of dirs) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;

        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          const nidx = ny * this.gridWidth + nx;
          const newDist = dist + dir.cost;

          if (newDist < this.distance[nidx]) {
            this.distance[nidx] = newDist;
            queue.push(nidx);
          }
        }
      }
    }
  }

  private computeGradients(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const idx = y * this.gridWidth + x;

        if (this.distance[idx] === 0) {
          this.dx[idx] = 0;
          this.dy[idx] = 0;
          continue;
        }

        const left = x > 0 ? this.distance[idx - 1] : Infinity;
        const right =
          x < this.gridWidth - 1 ? this.distance[idx + 1] : Infinity;
        const up = y > 0 ? this.distance[idx - this.gridWidth] : Infinity;
        const down =
          y < this.gridHeight - 1
            ? this.distance[idx + this.gridWidth]
            : Infinity;

        const gdx = left - right;
        const gdy = up - down;

        const len = Math.sqrt(gdx * gdx + gdy * gdy);
        if (len > 0.001) {
          this.dx[idx] = gdx / len;
          this.dy[idx] = gdy / len;
        } else {
          this.dx[idx] = 0;
          this.dy[idx] = 0;
        }
      }
    }
  }

  /**
   * Obtener vector de flujo en posición world
   */
  getAt(worldX: number, worldY: number): FlowVector {
    const gx = Math.floor(worldX / this.config.resolution);
    const gy = Math.floor(worldY / this.config.resolution);

    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
      return { dx: 0, dy: 0, magnitude: 0 };
    }

    const idx = gy * this.gridWidth + gx;
    const dx = this.dx[idx];
    const dy = this.dy[idx];

    return {
      dx,
      dy,
      magnitude: Math.sqrt(dx * dx + dy * dy),
    };
  }

  /**
   * Interpolar vector (bilinear)
   */
  getAtInterpolated(worldX: number, worldY: number): FlowVector {
    const fx = worldX / this.config.resolution;
    const fy = worldY / this.config.resolution;

    const gx0 = Math.floor(fx);
    const gy0 = Math.floor(fy);
    const gx1 = Math.min(gx0 + 1, this.gridWidth - 1);
    const gy1 = Math.min(gy0 + 1, this.gridHeight - 1);

    const tx = fx - gx0;
    const ty = fy - gy0;

    const x0 = Math.max(0, gx0);
    const y0 = Math.max(0, gy0);

    const i00 = y0 * this.gridWidth + x0;
    const i10 = y0 * this.gridWidth + gx1;
    const i01 = gy1 * this.gridWidth + x0;
    const i11 = gy1 * this.gridWidth + gx1;

    const dx =
      this.dx[i00] * (1 - tx) * (1 - ty) +
      this.dx[i10] * tx * (1 - ty) +
      this.dx[i01] * (1 - tx) * ty +
      this.dx[i11] * tx * ty;

    const dy =
      this.dy[i00] * (1 - tx) * (1 - ty) +
      this.dy[i10] * tx * (1 - ty) +
      this.dy[i01] * (1 - tx) * ty +
      this.dy[i11] * tx * ty;

    return {
      dx,
      dy,
      magnitude: Math.sqrt(dx * dx + dy * dy),
    };
  }

  /**
   * Tick - actualiza si necesario
   */
  tick(): boolean {
    this.ticksSinceUpdate++;

    if (this.ticksSinceUpdate >= this.config.updateRate && this.dirty) {
      this.compute();
      this.ticksSinceUpdate = 0;
      return true;
    }

    return false;
  }

  /**
   * Forzar recálculo
   */
  invalidate(): void {
    this.dirty = true;
  }

  /**
   * Stats
   */
  getStats(): { gridWidth: number; gridHeight: number; resolution: number } {
    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      resolution: this.config.resolution,
    };
  }
}

/**
 * FlowFieldManager - Gestiona múltiples flow fields
 */
export class FlowFieldManager {
  private fields: Map<FlowTarget, FlowField> = new Map();
  private config: FlowFieldConfig;

  constructor(config?: Partial<FlowFieldConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Crear o obtener un flow field
   */
  getOrCreate(target: FlowTarget): FlowField {
    if (!this.fields.has(target)) {
      this.fields.set(target, new FlowField(target, this.config));
    }
    return this.fields.get(target)!;
  }

  /**
   * Actualizar todos los flow fields
   */
  tick(): void {
    for (const field of this.fields.values()) {
      field.tick();
    }
  }

  /**
   * Invalidar todos
   */
  invalidateAll(): void {
    for (const field of this.fields.values()) {
      field.invalidate();
    }
  }

  /**
   * Actualizar flow field desde campo escalar
   */
  updateFromField(
    target: FlowTarget,
    scalarField: Float32Array,
    threshold: number = 0.5,
  ): void {
    const flow = this.getOrCreate(target);
    flow.setFromField(scalarField, threshold);
  }

  /**
   * Obtener vector combinado de múltiples flujos
   */
  getCombinedFlow(
    worldX: number,
    worldY: number,
    weights: Partial<Record<FlowTarget, number>>,
  ): FlowVector {
    let totalDx = 0;
    let totalDy = 0;
    let totalWeight = 0;

    for (const [target, weight] of Object.entries(weights)) {
      const field = this.fields.get(target as FlowTarget);
      if (field && weight) {
        const flow = field.getAtInterpolated(worldX, worldY);
        totalDx += flow.dx * weight;
        totalDy += flow.dy * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      totalDx /= totalWeight;
      totalDy /= totalWeight;
    }

    return {
      dx: totalDx,
      dy: totalDy,
      magnitude: Math.sqrt(totalDx * totalDx + totalDy * totalDy),
    };
  }

  /**
   * Lista de flow fields activos
   */
  getActiveFields(): FlowTarget[] {
    return Array.from(this.fields.keys());
  }
}
