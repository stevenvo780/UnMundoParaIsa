/**
 * Field - Clase base para campos Float32Array con doble buffer
 * Implementa difusión, decay y crecimiento logístico
 */

import { FieldConfig, idx } from "../types";
import { GPUComputeBridge } from "../gpu/GPUComputeBridge";

const gpuBridge = GPUComputeBridge.getInstance();

export class Field {
  readonly width: number;
  readonly height: number;
  readonly size: number;

  private current: Float32Array;
  private next: Float32Array;

  readonly config: FieldConfig;

  constructor(width: number, height: number, config: FieldConfig) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.config = config;

    this.current = Field.createSharedArray(this.size);
    this.next = Field.createSharedArray(this.size);
  }

  private static createSharedArray(size: number): Float32Array {
    const buffer = new SharedArrayBuffer(
      size * Float32Array.BYTES_PER_ELEMENT,
    );
    return new Float32Array(buffer);
  }

  /**
   * Obtener valor en posición
   */
  get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return 0;
    }
    return this.current[idx(x, y, this.width)];
  }

  /**
   * Establecer valor en posición
   */
  set(x: number, y: number, value: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    this.current[idx(x, y, this.width)] = Math.max(
      0,
      Math.min(this.config.maxValue, value),
    );
  }

  /**
   * Añadir al valor existente
   */
  add(x: number, y: number, delta: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }
    const i = idx(x, y, this.width);
    this.current[i] = Math.max(
      0,
      Math.min(this.config.maxValue, this.current[i] + delta),
    );
  }

  /**
   * Llenar con un valor
   */
  fill(value: number): void {
    this.current.fill(value);
  }

  /**
   * Obtener buffer actual (solo lectura)
   */
  getBuffer(): Float32Array {
    return this.current;
  }

  /**
   * Obtener suma total del campo
   */
  getSum(): number {
    let sum = 0;
    for (let i = 0; i < this.size; i++) {
      sum += this.current[i];
    }
    return sum;
  }

  /**
   * Obtener promedio del campo
   */
  getAverage(): number {
    return this.getSum() / this.size;
  }

  /**
   * Obtener máximo del campo
   */
  getMax(): number {
    let max = -Infinity;
    for (let i = 0; i < this.size; i++) {
      if (this.current[i] > max) max = this.current[i];
    }
    return max;
  }

  /**
   * Paso de difusión - expande valores a vecinos
   * Usa kernel de difusión 3x3 con peso central
   */
  diffuseStep(): void {
    const { diffusion } = this.config;
    if (diffusion === 0) return;

    const w = this.width;
    const h = this.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const center = this.current[i];

        let sum = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += this.current[ny * w + nx];
              count++;
            }
          }
        }

        const avg = count > 0 ? sum / count : 0;
        this.next[i] = center + diffusion * (avg - center);
      }
    }
  }

  /**
   * Paso de decay - reduce valores gradualmente
   */
  decayStep(): void {
    const { decay } = this.config;
    if (decay === 0) return;

    for (let i = 0; i < this.size; i++) {
      this.next[i] = this.next[i] * (1 - decay);
    }
  }

  /**
   * Paso de crecimiento logístico
   */
  growthStep(): void {
    const { growthRate, growthCap } = this.config;
    if (!growthRate || !growthCap) return;

    for (let i = 0; i < this.size; i++) {
      const v = this.current[i];

      const growth = growthRate * v * (1 - v / growthCap);
      this.current[i] = Math.max(0, Math.min(this.config.maxValue, v + growth));
    }
  }

  /**
   * Paso combinado de difusión y decay
   */
  diffuseDecayStep(): void {
    if (
      this.config.diffusion > 0 ||
      this.config.decay > 0
    ) {
      const usedGPU = gpuBridge.tryDiffuseDecay({
        width: this.width,
        height: this.height,
        diffusion: this.config.diffusion,
        decay: this.config.decay,
        maxValue: this.config.maxValue,
        input: this.current.buffer as SharedArrayBuffer,
        output: this.next.buffer as SharedArrayBuffer,
      });

      if (usedGPU) {
        this.swap();
        return;
      }
    }

    this.next.set(this.current);

    this.diffuseStep();
    this.decayStep();

    this.swap();
  }

  /**
   * Intercambiar buffers
   */
  swap(): void {
    const tmp = this.current;
    this.current = this.next;
    this.next = tmp;
  }

  /**
   * Inicializar con ruido simple
   */
  initWithNoise(baseValue: number, amplitude: number, seed: number): void {
    const rng = this.createRNG(seed);

    for (let i = 0; i < this.size; i++) {
      const noise = (rng() - 0.5) * 2 * amplitude;
      this.current[i] = Math.max(
        0,
        Math.min(this.config.maxValue, baseValue + noise),
      );
    }

    if (this.config.diffusion > 0) {
      for (let pass = 0; pass < 3; pass++) {
        this.diffuseStep();
        this.swap();
      }
    }
  }

  /**
   * Inicializar con oases (zonas de alta concentración)
   */
  initWithOases(
    oases: Array<{ x: number; y: number; radius: number; value: number }>,
  ): void {
    for (const oasis of oases) {
      this.addOasis(oasis.x, oasis.y, oasis.radius, oasis.value);
    }
  }

  /**
   * Añadir un oasis al campo
   */
  addOasis(cx: number, cy: number, radius: number, value: number): void {
    const r2 = radius * radius;

    for (
      let y = Math.max(0, Math.floor(cy - radius));
      y < Math.min(this.height, Math.ceil(cy + radius));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(cx - radius));
        x < Math.min(this.width, Math.ceil(cx + radius));
        x++
      ) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;

        if (d2 <= r2) {
          const factor = 1 - Math.sqrt(d2) / radius;
          const i = y * this.width + x;
          const newVal = value * factor;
          if (newVal > this.current[i]) {
            this.current[i] = newVal;
          }
        }
      }
    }
  }

  /**
   * Crear RNG simple con seed
   */
  private createRNG(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Obtener snapshot para serialización
   */
  getSnapshot(): { width: number; height: number; data: Float32Array } {
    return {
      width: this.width,
      height: this.height,
      data: new Float32Array(this.current),
    };
  }
}
