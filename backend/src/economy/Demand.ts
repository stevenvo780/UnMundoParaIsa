/**
 * Demand - Sistema de campos de demanda
 * Cada recurso genera un campo de demanda basado en población y necesidades
 */

export interface DemandConfig {
  baseNeed: number;
  urgencyMultiplier: number;
  diffusionRadius: number;
  decayRate: number;
}

export const DEFAULT_DEMAND_CONFIGS: Record<string, DemandConfig> = {
  food: {
    baseNeed: 0.1,
    urgencyMultiplier: 3.0,
    diffusionRadius: 10,
    decayRate: 0.1,
  },
  water: {
    baseNeed: 0.05,
    urgencyMultiplier: 4.0,
    diffusionRadius: 15,
    decayRate: 0.08,
  },
  wood: {
    baseNeed: 0.02,
    urgencyMultiplier: 1.5,
    diffusionRadius: 20,
    decayRate: 0.05,
  },
  stone: {
    baseNeed: 0.01,
    urgencyMultiplier: 1.2,
    diffusionRadius: 25,
    decayRate: 0.03,
  },
};

/**
 * Calcular demanda en una celda
 * demand = population * baseNeed * (1 + urgency * scarcity)
 */
export function calculateDemand(
  population: number,
  availableResource: number,
  config: DemandConfig,
): number {
  if (population <= 0) return 0;

  const need = population * config.baseNeed;
  const scarcity = Math.max(0, 1 - availableResource / (need + 0.001));

  const demand = need * (1 + config.urgencyMultiplier * scarcity);

  return Math.min(1.0, demand);
}

/**
 * DemandField - Campo de demanda para un recurso específico
 */
export class DemandField {
  readonly width: number;
  readonly height: number;
  readonly resourceType: string;
  readonly config: DemandConfig;

  private demand: Float32Array;
  private gradient: Float32Array;

  constructor(
    width: number,
    height: number,
    resourceType: string,
    config?: DemandConfig,
  ) {
    this.width = width;
    this.height = height;
    this.resourceType = resourceType;
    this.config =
      config ||
      DEFAULT_DEMAND_CONFIGS[resourceType] ||
      DEFAULT_DEMAND_CONFIGS.food;

    this.demand = new Float32Array(width * height);
    this.gradient = new Float32Array(width * height * 2);
  }

  /**
   * Actualizar campo de demanda desde población y recursos
   */
  update(populationField: Float32Array, resourceField: Float32Array): void {
    const { width, height } = this;
    const { decayRate } = this.config;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;

        const pop = populationField[i];
        const res = resourceField[i];

        const newDemand = calculateDemand(pop, res, this.config);

        this.demand[i] =
          this.demand[i] * (1 - decayRate) + newDemand * decayRate;
      }
    }

    this.diffuse();

    this.calculateGradients();
  }

  /**
   * Difundir demanda a vecinos
   */
  private diffuse(): void {
    const { width, height } = this;
    const temp = new Float32Array(this.demand);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;

        let sum = temp[i] * 0.6;
        sum += temp[i - 1] * 0.1;
        sum += temp[i + 1] * 0.1;
        sum += temp[i - width] * 0.1;
        sum += temp[i + width] * 0.1;

        this.demand[i] = sum;
      }
    }
  }

  /**
   * Calcular gradientes para advección
   */
  private calculateGradients(): void {
    const { width, height } = this;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;

        const gx = (this.demand[i + 1] - this.demand[i - 1]) * 0.5;
        const gy = (this.demand[i + width] - this.demand[i - width]) * 0.5;

        this.gradient[i * 2] = gx;
        this.gradient[i * 2 + 1] = gy;
      }
    }
  }

  /**
   * Obtener demanda en posición
   */
  get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.demand[y * this.width + x];
  }

  /**
   * Obtener gradiente en posición
   */
  getGradient(x: number, y: number): { gx: number; gy: number } {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { gx: 0, gy: 0 };
    }
    const i = (y * this.width + x) * 2;
    return {
      gx: this.gradient[i],
      gy: this.gradient[i + 1],
    };
  }

  /**
   * Obtener buffer de demanda
   */
  getBuffer(): Float32Array {
    return this.demand;
  }

  /**
   * Obtener suma total de demanda
   */
  getTotalDemand(): number {
    let sum = 0;
    for (let i = 0; i < this.demand.length; i++) {
      sum += this.demand[i];
    }
    return sum;
  }
}

/**
 * DemandManager - Gestiona múltiples campos de demanda
 */
export class DemandManager {
  private demands: Map<string, DemandField> = new Map();
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    for (const resource of Object.keys(DEFAULT_DEMAND_CONFIGS)) {
      this.demands.set(resource, new DemandField(width, height, resource));
    }
  }

  /**
   * Obtener campo de demanda
   */
  getDemandField(resource: string): DemandField | undefined {
    return this.demands.get(resource);
  }

  /**
   * Actualizar todas las demandas
   */
  update(
    populationField: Float32Array,
    resourceFields: Map<string, Float32Array>,
  ): void {
    for (const [resource, demandField] of this.demands) {
      const resourceBuffer = resourceFields.get(resource);
      if (resourceBuffer) {
        demandField.update(populationField, resourceBuffer);
      }
    }
  }

  /**
   * Obtener demanda total por recurso
   */
  getTotalDemands(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [resource, field] of this.demands) {
      result[resource] = field.getTotalDemand();
    }
    return result;
  }
}
