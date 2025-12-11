/**
 * DayNightCycle - Sistema de ciclo día/noche emergente
 * Afecta comportamiento de partículas y ambiente
 */

import { BehaviorType, getBehaviorType } from "../biodiversity/BehaviorTypes";

export enum TimeOfDay {
  DAWN = "dawn",
  MORNING = "morning",
  NOON = "noon",
  AFTERNOON = "afternoon",
  DUSK = "dusk",
  EVENING = "evening",
  NIGHT = "night",
  MIDNIGHT = "midnight",
}

export interface DayNightState {
  tick: number;
  dayProgress: number;
  timeOfDay: TimeOfDay;
  lightLevel: number;
  temperature: number;
  isDay: boolean;
}

export interface DayNightConfig {
  dayLength: number;
  dawnStart: number;
  dayStart: number;
  duskStart: number;
  nightStart: number;
  minLight: number;
  maxLight: number;
  minTemperature: number;
  maxTemperature: number;
}

const DEFAULT_CONFIG: DayNightConfig = {
  dayLength: 2400,
  dawnStart: 0.2,
  dayStart: 0.3,
  duskStart: 0.7,
  nightStart: 0.85,
  minLight: 0.1,
  maxLight: 1.0,
  minTemperature: 0.2,
  maxTemperature: 0.8,
};

export interface TimeModifiers {
  foodWeight: number;
  waterWeight: number;
  trailWeight: number;
  dangerWeight: number;
  explorationBonus: number;
  metabolismMod: number;
  activityLevel: number;
}

const TIME_MODIFIERS: Record<TimeOfDay, TimeModifiers> = {
  [TimeOfDay.DAWN]: {
    foodWeight: 1.2,
    waterWeight: 1.0,
    trailWeight: 0.5,
    dangerWeight: -1.5,
    explorationBonus: 0.3,
    metabolismMod: 0.9,
    activityLevel: 0.7,
  },
  [TimeOfDay.MORNING]: {
    foodWeight: 1.3,
    waterWeight: 1.1,
    trailWeight: 0.4,
    dangerWeight: -1.8,
    explorationBonus: 0.5,
    metabolismMod: 1.0,
    activityLevel: 0.9,
  },
  [TimeOfDay.NOON]: {
    foodWeight: 1.0,
    waterWeight: 1.5,
    trailWeight: 0.3,
    dangerWeight: -2.0,
    explorationBonus: 0.4,
    metabolismMod: 1.1,
    activityLevel: 0.8,
  },
  [TimeOfDay.AFTERNOON]: {
    foodWeight: 1.1,
    waterWeight: 1.2,
    trailWeight: 0.4,
    dangerWeight: -1.8,
    explorationBonus: 0.3,
    metabolismMod: 1.0,
    activityLevel: 0.85,
  },
  [TimeOfDay.DUSK]: {
    foodWeight: 1.4,
    waterWeight: 0.8,
    trailWeight: 0.6,
    dangerWeight: -1.5,
    explorationBonus: 0.2,
    metabolismMod: 0.95,
    activityLevel: 0.75,
  },
  [TimeOfDay.EVENING]: {
    foodWeight: 1.0,
    waterWeight: 0.7,
    trailWeight: 0.8,
    dangerWeight: -1.3,
    explorationBonus: 0.1,
    metabolismMod: 0.9,
    activityLevel: 0.6,
  },
  [TimeOfDay.NIGHT]: {
    foodWeight: 0.5,
    waterWeight: 0.5,
    trailWeight: 1.2,
    dangerWeight: -0.8,
    explorationBonus: -0.2,
    metabolismMod: 0.7,
    activityLevel: 0.3,
  },
  [TimeOfDay.MIDNIGHT]: {
    foodWeight: 0.3,
    waterWeight: 0.3,
    trailWeight: 1.5,
    dangerWeight: -0.5,
    explorationBonus: -0.3,
    metabolismMod: 0.6,
    activityLevel: 0.2,
  },
};

const BEHAVIOR_TIME_BONUSES: Partial<
  Record<BehaviorType, Partial<Record<TimeOfDay, number>>>
> = {
  [BehaviorType.HUNTER]: {
    [TimeOfDay.DAWN]: 1.3,
    [TimeOfDay.DUSK]: 1.2,
    [TimeOfDay.NIGHT]: 0.8,
  },
  [BehaviorType.NOMAD]: {
    [TimeOfDay.MORNING]: 1.2,
    [TimeOfDay.AFTERNOON]: 1.1,
    [TimeOfDay.NIGHT]: 0.6,
  },
  [BehaviorType.SETTLER]: {
    [TimeOfDay.NOON]: 1.1,
    [TimeOfDay.NIGHT]: 1.2,
  },
  [BehaviorType.GUARDIAN]: {
    [TimeOfDay.NIGHT]: 1.5,
    [TimeOfDay.MIDNIGHT]: 1.4,
  },
  [BehaviorType.EXPLORER]: {
    [TimeOfDay.MORNING]: 1.3,
    [TimeOfDay.AFTERNOON]: 1.2,
    [TimeOfDay.NIGHT]: 0.5,
  },
};

export class DayNightCycle {
  private config: DayNightConfig;
  private currentTick = 0;

  constructor(config: Partial<DayNightConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Actualizar tick
   */
  update(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Obtener estado actual
   */
  getState(): DayNightState {
    const dayProgress =
      (this.currentTick % this.config.dayLength) / this.config.dayLength;
    const timeOfDay = this.getTimeOfDay(dayProgress);

    return {
      tick: this.currentTick,
      dayProgress,
      timeOfDay,
      lightLevel: this.calculateLightLevel(dayProgress),
      temperature: this.calculateTemperature(dayProgress),
      isDay:
        dayProgress >= this.config.dawnStart &&
        dayProgress < this.config.nightStart,
    };
  }

  /**
   * Obtener tiempo del día desde progreso
   */
  private getTimeOfDay(progress: number): TimeOfDay {
    const { dawnStart, dayStart, duskStart, nightStart } = this.config;

    if (progress < dawnStart) return TimeOfDay.MIDNIGHT;
    if (progress < dayStart) return TimeOfDay.DAWN;
    if (progress < 0.45) return TimeOfDay.MORNING;
    if (progress < 0.55) return TimeOfDay.NOON;
    if (progress < duskStart) return TimeOfDay.AFTERNOON;
    if (progress < nightStart) return TimeOfDay.DUSK;
    if (progress < 0.95) return TimeOfDay.EVENING;
    return TimeOfDay.NIGHT;
  }

  /**
   * Calcular nivel de luz (curva sinusoidal suave)
   */
  private calculateLightLevel(progress: number): number {
    const { minLight, maxLight, dawnStart, nightStart } = this.config;

    const dayLength = nightStart - dawnStart;
    const normalized = (progress - dawnStart) / dayLength;

    if (normalized < 0 || normalized > 1) {
      return minLight;
    }

    const sinValue = Math.sin(normalized * Math.PI);
    return minLight + (maxLight - minLight) * sinValue;
  }

  /**
   * Calcular temperatura (desfasada de luz)
   */
  private calculateTemperature(progress: number): number {
    const { minTemperature, maxTemperature } = this.config;

    const tempPhase = (progress + 0.1) % 1;
    const sinValue = Math.sin(tempPhase * Math.PI);

    return (
      minTemperature + (maxTemperature - minTemperature) * Math.max(0, sinValue)
    );
  }

  /**
   * Obtener modificadores para una partícula según hora y tipo
   */
  getModifiersForParticle(particle: { seed: number }): TimeModifiers {
    const state = this.getState();
    const baseModifiers = TIME_MODIFIERS[state.timeOfDay];
    const behaviorType = getBehaviorType(particle.seed);

    const bonusMap = BEHAVIOR_TIME_BONUSES[behaviorType];
    const bonus = bonusMap?.[state.timeOfDay] ?? 1.0;

    return {
      foodWeight: baseModifiers.foodWeight,
      waterWeight: baseModifiers.waterWeight,
      trailWeight: baseModifiers.trailWeight,
      dangerWeight: baseModifiers.dangerWeight,
      explorationBonus: baseModifiers.explorationBonus,
      metabolismMod: baseModifiers.metabolismMod * bonus,
      activityLevel: baseModifiers.activityLevel * bonus,
    };
  }

  /**
   * Obtener día actual (para UI)
   */
  getCurrentDay(): number {
    return Math.floor(this.currentTick / this.config.dayLength) + 1;
  }

  /**
   * Obtener hora del día en formato 24h
   */
  getHour24(): number {
    const dayProgress =
      (this.currentTick % this.config.dayLength) / this.config.dayLength;
    return Math.floor(dayProgress * 24);
  }

  /**
   * Obtener hora formateada
   */
  getTimeString(): string {
    const dayProgress =
      (this.currentTick % this.config.dayLength) / this.config.dayLength;
    const totalMinutes = Math.floor(dayProgress * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }
}
