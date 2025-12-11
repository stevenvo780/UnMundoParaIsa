/**
 * Thermostats - Controladores homeostáticos para el mundo
 * Mantienen el equilibrio y evitan estados degenerados
 */

export enum ThermostatType {
  POPULATION = "population",
  RESOURCES = "resources",
  ENERGY = "energy",
  TENSION = "tension",
  DIVERSITY = "diversity",
  ACTIVITY = "activity",
}

export enum ThermostatTrend {
  RISING = "rising",
  STABLE = "stable",
  FALLING = "falling",
}

export interface ThermostatReading {
  current: number;
  target: number;
  min: number;
  max: number;
  error: number;
  derivative: number;
  integral: number;
}

export interface ThermostatConfig {
  type: ThermostatType;
  target: number;
  min: number;
  max: number;

  kP: number;
  kI: number;
  kD: number;

  integralMax: number;
  outputMin: number;
  outputMax: number;

  sampleRate: number;
}

const DEFAULT_CONFIGS: Record<ThermostatType, Partial<ThermostatConfig>> = {
  [ThermostatType.POPULATION]: {
    target: 500,
    min: 50,
    max: 2000,
    kP: 0.1,
    kI: 0.01,
    kD: 0.05,
  },
  [ThermostatType.RESOURCES]: {
    target: 0.6,
    min: 0.2,
    max: 1.0,
    kP: 0.2,
    kI: 0.02,
    kD: 0.1,
  },
  [ThermostatType.ENERGY]: {
    target: 50,
    min: 20,
    max: 100,
    kP: 0.15,
    kI: 0.015,
    kD: 0.08,
  },
  [ThermostatType.TENSION]: {
    target: 0.3,
    min: 0.0,
    max: 0.8,
    kP: 0.3,
    kI: 0.03,
    kD: 0.15,
  },
  [ThermostatType.DIVERSITY]: {
    target: 0.7,
    min: 0.3,
    max: 1.0,
    kP: 0.1,
    kI: 0.005,
    kD: 0.05,
  },
  [ThermostatType.ACTIVITY]: {
    target: 0.5,
    min: 0.1,
    max: 1.0,
    kP: 0.2,
    kI: 0.02,
    kD: 0.1,
  },
};

/**
 * Thermostat - Controlador PID para una variable
 */
export class Thermostat {
  readonly type: ThermostatType;
  private config: ThermostatConfig;

  private lastError: number = 0;
  private integral: number = 0;
  private lastValue: number = 0;

  private history: number[] = [];
  private historyMaxLength = 100;

  private ticksSinceSample = 0;
  private output: number = 0;

  constructor(type: ThermostatType, config?: Partial<ThermostatConfig>) {
    this.type = type;

    const defaults = DEFAULT_CONFIGS[type];

    this.config = {
      type,
      target: config?.target ?? defaults.target ?? 0.5,
      min: config?.min ?? defaults.min ?? 0,
      max: config?.max ?? defaults.max ?? 1,
      kP: config?.kP ?? defaults.kP ?? 0.1,
      kI: config?.kI ?? defaults.kI ?? 0.01,
      kD: config?.kD ?? defaults.kD ?? 0.05,
      integralMax: config?.integralMax ?? 10,
      outputMin: config?.outputMin ?? -1,
      outputMax: config?.outputMax ?? 1,
      sampleRate: config?.sampleRate ?? 5,
    };
  }

  /**
   * Actualizar con nuevo valor medido
   */
  update(currentValue: number): number {
    this.ticksSinceSample++;

    if (this.ticksSinceSample < this.config.sampleRate) {
      return this.output;
    }

    this.ticksSinceSample = 0;

    this.history.push(currentValue);
    if (this.history.length > this.historyMaxLength) {
      this.history.shift();
    }

    const error = this.config.target - currentValue;

    const pTerm = this.config.kP * error;

    this.integral += error;
    this.integral = Math.max(
      -this.config.integralMax,
      Math.min(this.config.integralMax, this.integral),
    );
    const iTerm = this.config.kI * this.integral;

    const dTerm = this.config.kD * (error - this.lastError);

    this.output = pTerm + iTerm + dTerm;
    this.output = Math.max(
      this.config.outputMin,
      Math.min(this.config.outputMax, this.output),
    );

    this.lastError = error;
    this.lastValue = currentValue;

    return this.output;
  }

  /**
   * Obtener lectura actual
   */
  getReading(): ThermostatReading {
    const derivative =
      this.history.length >= 2
        ? this.history[this.history.length - 1] -
          this.history[this.history.length - 2]
        : 0;

    return {
      current: this.lastValue,
      target: this.config.target,
      min: this.config.min,
      max: this.config.max,
      error: this.lastError,
      derivative,
      integral: this.integral,
    };
  }

  /**
   * Obtener salida actual (sin recalcular)
   */
  getOutput(): number {
    return this.output;
  }

  /**
   * Verificar si está en rango saludable
   */
  isHealthy(): boolean {
    return (
      this.lastValue >= this.config.min && this.lastValue <= this.config.max
    );
  }

  /**
   * Verificar si está en zona crítica
   */
  isCritical(): boolean {
    const range = this.config.max - this.config.min;
    const criticalThreshold = range * 0.1;

    return (
      this.lastValue < this.config.min + criticalThreshold ||
      this.lastValue > this.config.max - criticalThreshold
    );
  }

  /**
   * Obtener tendencia
   */
  getTrend(): ThermostatTrend {
    if (this.history.length < 5) return ThermostatTrend.STABLE;

    const recent = this.history.slice(-5);
    const avgChange = (recent[4] - recent[0]) / 4;

    if (avgChange > 0.01) return ThermostatTrend.RISING;
    if (avgChange < -0.01) return ThermostatTrend.FALLING;
    return ThermostatTrend.STABLE;
  }

  /**
   * Reset estado
   */
  reset(): void {
    this.lastError = 0;
    this.integral = 0;
    this.lastValue = 0;
    this.history = [];
    this.output = 0;
  }

  /**
   * Ajustar target dinámicamente
   */
  setTarget(newTarget: number): void {
    this.config.target = Math.max(
      this.config.min,
      Math.min(this.config.max, newTarget),
    );

    this.integral = 0;
  }

  /**
   * Obtener historia
   */
  getHistory(): number[] {
    return [...this.history];
  }
}

/**
 * ThermostatBank - Gestiona múltiples termostatos
 */
export class ThermostatBank {
  private thermostats: Map<ThermostatType, Thermostat> = new Map();

  constructor(
    configs?: Partial<Record<ThermostatType, Partial<ThermostatConfig>>>,
  ) {
    const types: ThermostatType[] = [
      ThermostatType.POPULATION,
      ThermostatType.RESOURCES,
      ThermostatType.ENERGY,
      ThermostatType.TENSION,
      ThermostatType.DIVERSITY,
      ThermostatType.ACTIVITY,
    ];

    for (const type of types) {
      this.thermostats.set(type, new Thermostat(type, configs?.[type]));
    }
  }

  /**
   * Actualizar un termostato específico
   */
  update(type: ThermostatType, value: number): number {
    const thermostat = this.thermostats.get(type);
    if (!thermostat) return 0;
    return thermostat.update(value);
  }

  /**
   * Actualizar múltiples valores
   */
  updateAll(
    values: Partial<Record<ThermostatType, number>>,
  ): Record<ThermostatType, number> {
    const outputs: Record<string, number> = {};

    for (const [type, value] of Object.entries(values)) {
      const thermostat = this.thermostats.get(type as ThermostatType);
      if (thermostat && typeof value === "number") {
        outputs[type] = thermostat.update(value);
      }
    }

    return outputs as Record<ThermostatType, number>;
  }

  /**
   * Obtener termostato
   */
  get(type: ThermostatType): Thermostat | undefined {
    return this.thermostats.get(type);
  }

  /**
   * Obtener todas las lecturas
   */
  getAllReadings(): Record<ThermostatType, ThermostatReading> {
    const readings: Record<string, ThermostatReading> = {};

    for (const [type, thermostat] of this.thermostats) {
      readings[type] = thermostat.getReading();
    }

    return readings as Record<ThermostatType, ThermostatReading>;
  }

  /**
   * Verificar salud global
   */
  getHealthStatus(): {
    healthy: ThermostatType[];
    unhealthy: ThermostatType[];
    critical: ThermostatType[];
  } {
    const healthy: ThermostatType[] = [];
    const unhealthy: ThermostatType[] = [];
    const critical: ThermostatType[] = [];

    for (const [type, thermostat] of this.thermostats) {
      if (thermostat.isCritical()) {
        critical.push(type);
      } else if (!thermostat.isHealthy()) {
        unhealthy.push(type);
      } else {
        healthy.push(type);
      }
    }

    return { healthy, unhealthy, critical };
  }

  /**
   * Obtener acciones correctivas sugeridas
   */
  getSuggestedActions(): Array<{
    type: ThermostatType;
    action: string;
    urgency: number;
  }> {
    const actions: Array<{
      type: ThermostatType;
      action: string;
      urgency: number;
    }> = [];

    for (const [type, thermostat] of this.thermostats) {
      const output = thermostat.getOutput();

      if (Math.abs(output) > 0.5) {
        let action: string;
        let urgency = Math.abs(output);

        if (output > 0) {
          switch (type) {
            case ThermostatType.POPULATION:
              action = "Aumentar fertilidad o reducir mortalidad";
              break;
            case ThermostatType.RESOURCES:
              action = "Incrementar regeneración de recursos";
              break;
            case ThermostatType.ENERGY:
              action = "Mejorar acceso a alimento";
              break;
            case ThermostatType.DIVERSITY:
              action = "Fomentar migración y cruce genético";
              break;
            case ThermostatType.ACTIVITY:
              action = "Incrementar estímulos ambientales";
              break;
            case ThermostatType.TENSION:
              action = "Permitir algo de conflicto saludable";
              break;
            default:
              action = `Incrementar ${type}`;
          }
        } else {
          switch (type) {
            case ThermostatType.POPULATION:
              action = "Limitar reproducción o recursos";
              break;
            case ThermostatType.RESOURCES:
              action = "Incrementar consumo o decay";
              break;
            case ThermostatType.ENERGY:
              action = "Aumentar costo de actividades";
              break;
            case ThermostatType.TENSION:
              action = "Reducir competencia, fomentar cooperación";
              break;
            case ThermostatType.DIVERSITY:
              action = "Dejar que evolución natural reduzca variantes";
              break;
            case ThermostatType.ACTIVITY:
              action = "Reducir estímulos, permitir descanso";
              break;
            default:
              action = `Reducir ${type}`;
          }
        }

        if (thermostat.isCritical()) {
          urgency *= 2;
          action = `¡CRÍTICO! ${action}`;
        }

        actions.push({ type, action, urgency });
      }
    }

    actions.sort((a, b) => b.urgency - a.urgency);

    return actions;
  }

  /**
   * Reset todos los termostatos
   */
  resetAll(): void {
    for (const thermostat of this.thermostats.values()) {
      thermostat.reset();
    }
  }

  /**
   * Stats resumidos
   */
  getStats(): Record<
    ThermostatType,
    { output: number; trend: ThermostatTrend; healthy: boolean }
  > {
    const stats: Record<
      string,
      { output: number; trend: ThermostatTrend; healthy: boolean }
    > = {};

    for (const [type, thermostat] of this.thermostats) {
      stats[type] = {
        output: thermostat.getOutput(),
        trend: thermostat.getTrend(),
        healthy: thermostat.isHealthy(),
      };
    }

    return stats as Record<
      ThermostatType,
      { output: number; trend: ThermostatTrend; healthy: boolean }
    >;
  }
}

/**
 * WorldBalancer - Aplica correcciones de termostatos al mundo
 */
export interface WorldParameters {
  fertilityMultiplier: number;
  mortalityMultiplier: number;
  resourceRegenRate: number;
  consumptionRate: number;
  migrationRate: number;
  conflictThreshold: number;
}

export class WorldBalancer {
  private bank: ThermostatBank;
  private baseParams: WorldParameters;

  constructor(bank: ThermostatBank) {
    this.bank = bank;

    this.baseParams = {
      fertilityMultiplier: 1.0,
      mortalityMultiplier: 1.0,
      resourceRegenRate: 1.0,
      consumptionRate: 1.0,
      migrationRate: 1.0,
      conflictThreshold: 0.5,
    };
  }

  /**
   * Calcular parámetros ajustados
   */
  getAdjustedParameters(): WorldParameters {
    const pop = this.bank.get(ThermostatType.POPULATION)?.getOutput() ?? 0;
    const res = this.bank.get(ThermostatType.RESOURCES)?.getOutput() ?? 0;
    const ten = this.bank.get(ThermostatType.TENSION)?.getOutput() ?? 0;
    const div = this.bank.get(ThermostatType.DIVERSITY)?.getOutput() ?? 0;

    return {
      fertilityMultiplier: this.baseParams.fertilityMultiplier + pop * 0.2,
      mortalityMultiplier: this.baseParams.mortalityMultiplier - pop * 0.1,
      resourceRegenRate: this.baseParams.resourceRegenRate + res * 0.3,
      consumptionRate: this.baseParams.consumptionRate - res * 0.1,
      migrationRate: this.baseParams.migrationRate + div * 0.2,
      conflictThreshold: this.baseParams.conflictThreshold - ten * 0.2,
    };
  }

  /**
   * Establecer parámetros base
   */
  setBaseParameters(params: Partial<WorldParameters>): void {
    this.baseParams = { ...this.baseParams, ...params };
  }
}
