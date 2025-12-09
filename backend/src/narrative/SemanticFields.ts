/**
 * SemanticFields - Campos de emoción: joy, nostalgia, love
 * Derivados de los fragmentos de chat y comportamientos de agentes
 */

import { FieldConfig, WORLD } from "../types.js";

export type SemanticFieldType =
  | "joy"
  | "nostalgia"
  | "love"
  | "wonder"
  | "melancholy";

export interface SemanticFieldConfig extends FieldConfig {
  resonanceDecay: number;
  influenceRadius: number;
  behaviorEffect: number;
}

const SEMANTIC_CONFIGS: Record<SemanticFieldType, SemanticFieldConfig> = {
  joy: {
    diffusion: 0.15,
    decay: 0.08,
    maxValue: 1.0,
    resonanceDecay: 0.05,
    influenceRadius: 8,
    behaviorEffect: 0.3,
  },
  nostalgia: {
    diffusion: 0.05,
    decay: 0.02,
    maxValue: 1.0,
    resonanceDecay: 0.01,
    influenceRadius: 15,
    behaviorEffect: 0.2,
  },
  love: {
    diffusion: 0.1,
    decay: 0.03,
    maxValue: 1.0,
    resonanceDecay: 0.02,
    influenceRadius: 12,
    behaviorEffect: 0.5,
  },
  wonder: {
    diffusion: 0.2,
    decay: 0.1,
    maxValue: 1.0,
    resonanceDecay: 0.08,
    influenceRadius: 10,
    behaviorEffect: 0.25,
  },
  melancholy: {
    diffusion: 0.03,
    decay: 0.01,
    maxValue: 1.0,
    resonanceDecay: 0.005,
    influenceRadius: 20,
    behaviorEffect: 0.15,
  },
};

/**
 * SemanticField - Campo emocional individual
 */
export class SemanticField {
  readonly type: SemanticFieldType;
  readonly width: number;
  readonly height: number;
  readonly config: SemanticFieldConfig;

  private current: Float32Array;
  private next: Float32Array;
  private resonance: Float32Array;

  constructor(type: SemanticFieldType, width: number, height: number) {
    this.type = type;
    this.width = width;
    this.height = height;
    this.config = SEMANTIC_CONFIGS[type];

    const size = width * height;
    this.current = new Float32Array(size);
    this.next = new Float32Array(size);
    this.resonance = new Float32Array(size);
  }

  /**
   * Depositar emoción en posición
   */
  deposit(x: number, y: number, intensity: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const { influenceRadius, maxValue } = this.config;
    const r2 = influenceRadius * influenceRadius;

    for (let dy = -influenceRadius; dy <= influenceRadius; dy++) {
      for (let dx = -influenceRadius; dx <= influenceRadius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;

        const factor = 1 - Math.sqrt(d2) / influenceRadius;
        const i = ny * this.width + nx;

        this.current[i] = Math.min(
          maxValue,
          this.current[i] + intensity * factor,
        );
        this.resonance[i] = Math.min(
          maxValue,
          this.resonance[i] + intensity * factor * 0.5,
        );
      }
    }
  }

  /**
   * Obtener valor en posición
   */
  get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.current[y * this.width + x];
  }

  /**
   * Obtener resonancia en posición
   */
  getResonance(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.resonance[y * this.width + x];
  }

  /**
   * Paso de actualización
   */
  step(): void {
    const { width, height, config } = this;
    const { diffusion, decay, resonanceDecay } = config;

    this.next.set(this.current);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const center = this.current[i];

        let sum = 0;
        sum += this.current[i - 1];
        sum += this.current[i + 1];
        sum += this.current[i - width];
        sum += this.current[i + width];

        const avg = sum / 4;
        this.next[i] = center + diffusion * (avg - center);
      }
    }

    for (let i = 0; i < this.next.length; i++) {
      this.next[i] *= 1 - decay;
      this.resonance[i] *= 1 - resonanceDecay;
    }

    [this.current, this.next] = [this.next, this.current];
  }

  /**
   * Obtener efecto en comportamiento
   */
  getBehaviorEffect(x: number, y: number): number {
    const value = this.get(x, y);
    const resonance = this.getResonance(x, y);
    return (value + resonance * 0.5) * this.config.behaviorEffect;
  }

  /**
   * Obtener buffer
   */
  getBuffer(): Float32Array {
    return this.current;
  }

  /**
   * Obtener estadísticas
   */
  getStats(): { average: number; max: number; totalResonance: number } {
    let sum = 0,
      max = 0,
      resSum = 0;

    for (let i = 0; i < this.current.length; i++) {
      sum += this.current[i];
      if (this.current[i] > max) max = this.current[i];
      resSum += this.resonance[i];
    }

    return {
      average: sum / this.current.length,
      max,
      totalResonance: resSum,
    };
  }
}

/**
 * SemanticFieldManager - Gestiona todos los campos semánticos
 */
export class SemanticFieldManager {
  readonly width: number;
  readonly height: number;

  private fields: Map<SemanticFieldType, SemanticField> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    for (const type of Object.keys(SEMANTIC_CONFIGS) as SemanticFieldType[]) {
      this.fields.set(type, new SemanticField(type, width, height));
    }
  }

  /**
   * Obtener campo por tipo
   */
  getField(type: SemanticFieldType): SemanticField | undefined {
    return this.fields.get(type);
  }

  /**
   * Depositar emoción
   */
  deposit(
    type: SemanticFieldType,
    x: number,
    y: number,
    intensity: number,
  ): void {
    this.fields.get(type)?.deposit(x, y, intensity);
  }

  /**
   * Obtener valor de un campo
   */
  get(type: SemanticFieldType, x: number, y: number): number {
    return this.fields.get(type)?.get(x, y) || 0;
  }

  /**
   * Obtener emoción dominante en posición
   */
  getDominantEmotion(
    x: number,
    y: number,
  ): { type: SemanticFieldType; value: number } | null {
    let maxType: SemanticFieldType | null = null;
    let maxValue = 0;

    for (const [type, field] of this.fields) {
      const value = field.get(x, y);
      if (value > maxValue) {
        maxValue = value;
        maxType = type;
      }
    }

    return maxType ? { type: maxType, value: maxValue } : null;
  }

  /**
   * Actualizar todos los campos
   */
  step(): void {
    for (const field of this.fields.values()) {
      field.step();
    }
  }

  /**
   * Obtener estadísticas de todos los campos
   */
  getStats(): Record<SemanticFieldType, { average: number; max: number }> {
    const result: Record<string, { average: number; max: number }> = {};

    for (const [type, field] of this.fields) {
      const stats = field.getStats();
      result[type] = { average: stats.average, max: stats.max };
    }

    return result as Record<
      SemanticFieldType,
      { average: number; max: number }
    >;
  }
}
