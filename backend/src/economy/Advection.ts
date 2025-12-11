/**
 * Advection - Flujo de recursos hacia zonas de demanda
 * Implementa R3: F' = F - v·∇F
 */

import { GPUComputeBridge } from "../gpu/GPUComputeBridge";

export interface AdvectionConfig {
  strength: number;
  maxFlow: number;
  viscosity: number;
}

const DEFAULT_ADVECTION_CONFIG: AdvectionConfig = {
  strength: 0.1,
  maxFlow: 0.5,
  viscosity: 0.1,
};

/**
 * Advector - Mueve recursos siguiendo gradientes de demanda
 */
export class Advector {
  readonly width: number;
  readonly height: number;
  readonly config: AdvectionConfig;

  private velocityX: Float32Array;
  private velocityY: Float32Array;
  private gpuOutput?: Float32Array;

  private static gpuBridge = GPUComputeBridge.getInstance();

  private static createSharedArray(size: number): Float32Array {
    const buffer = new SharedArrayBuffer(
      size * Float32Array.BYTES_PER_ELEMENT,
    );
    return new Float32Array(buffer);
  }

  constructor(
    width: number,
    height: number,
    config?: Partial<AdvectionConfig>,
  ) {
    this.width = width;
    this.height = height;
    this.config = { ...DEFAULT_ADVECTION_CONFIG, ...config };

    this.velocityX = Advector.createSharedArray(width * height);
    this.velocityY = Advector.createSharedArray(width * height);
  }

  private ensureGPUOutput(): Float32Array {
    if (!this.gpuOutput) {
      this.gpuOutput = Advector.createSharedArray(this.width * this.height);
    }
    return this.gpuOutput;
  }

  /**
   * Actualizar campo de velocidad desde gradientes de demanda
   * La velocidad apunta hacia donde la demanda es mayor
   */
  updateVelocityFromDemand(
    demandGradientX: Float32Array,
    demandGradientY: Float32Array,
  ): void {
    const { strength, viscosity } = this.config;
    const size = this.width * this.height;

    for (let i = 0; i < size; i++) {
      const targetVx = demandGradientX[i] * strength;
      const targetVy = demandGradientY[i] * strength;

      this.velocityX[i] =
        this.velocityX[i] * viscosity + targetVx * (1 - viscosity);
      this.velocityY[i] =
        this.velocityY[i] * viscosity + targetVy * (1 - viscosity);
    }
  }

  /**
   * Advectar un campo de recursos
   * Semi-Lagrangian: traza hacia atrás y muestrea
   */
  advect(resourceField: Float32Array, dt: number = 1.0): Float32Array {
    if (
      resourceField.buffer instanceof SharedArrayBuffer &&
      this.velocityX.buffer instanceof SharedArrayBuffer &&
      this.velocityY.buffer instanceof SharedArrayBuffer
    ) {
      const output = this.ensureGPUOutput();
      const usedGPU = Advector.gpuBridge.tryAdvectResource({
        width: this.width,
        height: this.height,
        maxFlow: this.config.maxFlow,
        deltaTime: dt,
        resourceInput: resourceField.buffer as SharedArrayBuffer,
        velocityX: this.velocityX.buffer as SharedArrayBuffer,
        velocityY: this.velocityY.buffer as SharedArrayBuffer,
        output: output.buffer as SharedArrayBuffer,
      });

      if (usedGPU) {
        return output;
      }
    }

    return this.advectCPU(resourceField, dt);
  }

  private advectCPU(resourceField: Float32Array, dt: number): Float32Array {
    const { width, height } = this;
    const { maxFlow } = this.config;
    const result = new Float32Array(resourceField.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;

        const vx = Math.max(-maxFlow, Math.min(maxFlow, this.velocityX[i]));
        const vy = Math.max(-maxFlow, Math.min(maxFlow, this.velocityY[i]));

        const srcX = x - vx * dt;
        const srcY = y - vy * dt;

        result[i] = this.sampleBilinear(resourceField, srcX, srcY);
      }
    }

    return result;
  }

  /**
   * Muestreo bilinear
   */
  private sampleBilinear(field: Float32Array, x: number, y: number): number {
    const { width, height } = this;

    x = Math.max(0, Math.min(width - 1.001, x));
    y = Math.max(0, Math.min(height - 1.001, y));

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const fx = x - x0;
    const fy = y - y0;

    const v00 = field[y0 * width + x0];
    const v10 = field[y0 * width + x1];
    const v01 = field[y1 * width + x0];
    const v11 = field[y1 * width + x1];

    const v0 = v00 * (1 - fx) + v10 * fx;
    const v1 = v01 * (1 - fx) + v11 * fx;

    return v0 * (1 - fy) + v1 * fy;
  }

  /**
   * Obtener velocidad en posición
   */
  getVelocity(x: number, y: number): { vx: number; vy: number } {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { vx: 0, vy: 0 };
    }
    const i = y * this.width + x;
    return {
      vx: this.velocityX[i],
      vy: this.velocityY[i],
    };
  }

  /**
   * Obtener magnitud de velocidad promedio
   */
  getAverageSpeed(): number {
    let sum = 0;
    const size = this.width * this.height;

    for (let i = 0; i < size; i++) {
      const vx = this.velocityX[i];
      const vy = this.velocityY[i];
      sum += Math.sqrt(vx * vx + vy * vy);
    }

    return sum / size;
  }

  /**
   * Resetear velocidades
   */
  reset(): void {
    this.velocityX.fill(0);
    this.velocityY.fill(0);
  }

  /**
   * Obtener buffers de velocidad para visualización
   */
  getVelocityBuffers(): { x: Float32Array; y: Float32Array } {
    return {
      x: this.velocityX,
      y: this.velocityY,
    };
  }
}

/**
 * ResourceFlowSystem - Coordina demanda y advección para múltiples recursos
 */
export class ResourceFlowSystem {
  readonly width: number;
  readonly height: number;

  private advectors: Map<string, Advector> = new Map();

  constructor(width: number, height: number, resources: string[]) {
    this.width = width;
    this.height = height;

    for (const resource of resources) {
      this.advectors.set(resource, new Advector(width, height));
    }
  }

  /**
   * Actualizar flujo de un recurso
   */
  updateFlow(
    resource: string,
    demandGradientX: Float32Array,
    demandGradientY: Float32Array,
    resourceField: Float32Array,
  ): Float32Array {
    const advector = this.advectors.get(resource);
    if (!advector) {
      return resourceField;
    }

    advector.updateVelocityFromDemand(demandGradientX, demandGradientY);
    return advector.advect(resourceField);
  }

  /**
   * Obtener estadísticas de flujo
   */
  getFlowStats(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [resource, advector] of this.advectors) {
      result[resource] = advector.getAverageSpeed();
    }
    return result;
  }
}
