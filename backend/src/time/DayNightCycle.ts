/**
 * DayNightCycle - Sistema de ciclo día/noche emergente
 * Afecta comportamiento de partículas y ambiente
 */

import { Particle } from '../types.js';
import { BehaviorType, getBehaviorType } from '../biodiversity/BehaviorTypes.js';

// ============================================
// Tipos
// ============================================

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night' | 'midnight';

export interface DayNightState {
  tick: number;
  dayProgress: number;      // 0-1 donde 0.5 es mediodía
  timeOfDay: TimeOfDay;
  lightLevel: number;       // 0-1
  temperature: number;      // 0-1 (normalizado)
  isDay: boolean;
}

export interface DayNightConfig {
  dayLength: number;        // Ticks por día completo
  dawnStart: number;        // 0-1 del día
  dayStart: number;
  duskStart: number;
  nightStart: number;
  minLight: number;         // Luz mínima (noche)
  maxLight: number;         // Luz máxima (día)
  minTemperature: number;
  maxTemperature: number;
}

const DEFAULT_CONFIG: DayNightConfig = {
  dayLength: 2400,          // 2 minutos de día a 20 ticks/segundo
  dawnStart: 0.20,          // 4:48 AM
  dayStart: 0.30,           // 7:12 AM
  duskStart: 0.70,          // 4:48 PM
  nightStart: 0.85,         // 8:24 PM
  minLight: 0.1,
  maxLight: 1.0,
  minTemperature: 0.2,
  maxTemperature: 0.8,
};

// ============================================
// Modificadores de comportamiento por tiempo
// ============================================

export interface TimeModifiers {
  foodWeight: number;
  waterWeight: number;
  trailWeight: number;      // Social
  dangerWeight: number;
  explorationBonus: number;
  metabolismMod: number;
  activityLevel: number;    // 0-1, cuán activo está
}

const TIME_MODIFIERS: Record<TimeOfDay, TimeModifiers> = {
  dawn: {
    foodWeight: 1.2,
    waterWeight: 1.0,
    trailWeight: 0.5,
    dangerWeight: -1.5,
    explorationBonus: 0.3,
    metabolismMod: 0.9,
    activityLevel: 0.7,
  },
  morning: {
    foodWeight: 1.3,
    waterWeight: 1.1,
    trailWeight: 0.4,
    dangerWeight: -1.8,
    explorationBonus: 0.5,
    metabolismMod: 1.0,
    activityLevel: 0.9,
  },
  noon: {
    foodWeight: 1.0,
    waterWeight: 1.5,       // Más sed al mediodía
    trailWeight: 0.3,
    dangerWeight: -2.0,
    explorationBonus: 0.4,
    metabolismMod: 1.1,
    activityLevel: 0.8,
  },
  afternoon: {
    foodWeight: 1.1,
    waterWeight: 1.2,
    trailWeight: 0.4,
    dangerWeight: -1.8,
    explorationBonus: 0.3,
    metabolismMod: 1.0,
    activityLevel: 0.85,
  },
  dusk: {
    foodWeight: 1.4,        // Buscan comida antes de noche
    waterWeight: 0.8,
    trailWeight: 0.6,       // Más social
    dangerWeight: -1.5,
    explorationBonus: 0.2,
    metabolismMod: 0.95,
    activityLevel: 0.75,
  },
  evening: {
    foodWeight: 1.0,
    waterWeight: 0.7,
    trailWeight: 0.8,       // Muy social
    dangerWeight: -1.3,
    explorationBonus: 0.1,
    metabolismMod: 0.9,
    activityLevel: 0.6,
  },
  night: {
    foodWeight: 0.5,
    waterWeight: 0.5,
    trailWeight: 1.2,       // Muy gregarios
    dangerWeight: -0.8,     // Menos miedo (confusión)
    explorationBonus: -0.2,
    metabolismMod: 0.7,
    activityLevel: 0.3,
  },
  midnight: {
    foodWeight: 0.3,
    waterWeight: 0.3,
    trailWeight: 1.5,       // Máxima socialización
    dangerWeight: -0.5,
    explorationBonus: -0.3,
    metabolismMod: 0.6,
    activityLevel: 0.2,
  },
};

// Modificadores especiales por tipo de comportamiento y hora
const BEHAVIOR_TIME_BONUSES: Partial<Record<BehaviorType, Partial<Record<TimeOfDay, number>>>> = {
  hunter: {
    dawn: 1.3,              // Cazadores más activos al amanecer
    dusk: 1.2,              // Y al atardecer
    night: 0.8,
  },
  nomad: {
    morning: 1.2,
    afternoon: 1.1,
    night: 0.6,
  },
  settler: {
    noon: 1.1,
    night: 1.2,             // Settlers descansan de noche (eficiencia)
  },
  guardian: {
    night: 1.5,             // Guardianes activos de noche
    midnight: 1.4,
  },
  explorer: {
    morning: 1.3,
    afternoon: 1.2,
    night: 0.5,
  },
};

// ============================================
// DayNightCycle - Gestor del ciclo
// ============================================

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
    const dayProgress = (this.currentTick % this.config.dayLength) / this.config.dayLength;
    const timeOfDay = this.getTimeOfDay(dayProgress);
    
    return {
      tick: this.currentTick,
      dayProgress,
      timeOfDay,
      lightLevel: this.calculateLightLevel(dayProgress),
      temperature: this.calculateTemperature(dayProgress),
      isDay: dayProgress >= this.config.dawnStart && dayProgress < this.config.nightStart,
    };
  }
  
  /**
   * Obtener tiempo del día desde progreso
   */
  private getTimeOfDay(progress: number): TimeOfDay {
    const { dawnStart, dayStart, duskStart, nightStart } = this.config;
    
    if (progress < dawnStart) return 'midnight';
    if (progress < dayStart) return 'dawn';
    if (progress < 0.45) return 'morning';
    if (progress < 0.55) return 'noon';
    if (progress < duskStart) return 'afternoon';
    if (progress < nightStart) return 'dusk';
    if (progress < 0.95) return 'evening';
    return 'night';
  }
  
  /**
   * Calcular nivel de luz (curva sinusoidal suave)
   */
  private calculateLightLevel(progress: number): number {
    const { minLight, maxLight, dawnStart, nightStart } = this.config;
    
    // Usar sinusoide para transición suave
    const dayLength = nightStart - dawnStart;
    const normalized = (progress - dawnStart) / dayLength;
    
    if (normalized < 0 || normalized > 1) {
      return minLight;
    }
    
    // Sinusoide: máximo al mediodía
    const sinValue = Math.sin(normalized * Math.PI);
    return minLight + (maxLight - minLight) * sinValue;
  }
  
  /**
   * Calcular temperatura (desfasada de luz)
   */
  private calculateTemperature(progress: number): number {
    const { minTemperature, maxTemperature } = this.config;
    
    // Temperatura máxima a las 2-3 PM (progress ~0.6)
    const tempPhase = (progress + 0.1) % 1;
    const sinValue = Math.sin(tempPhase * Math.PI);
    
    return minTemperature + (maxTemperature - minTemperature) * Math.max(0, sinValue);
  }
  
  /**
   * Obtener modificadores para una partícula según hora y tipo
   */
  getModifiersForParticle(particle: { seed: number }): TimeModifiers {
    const state = this.getState();
    const baseModifiers = TIME_MODIFIERS[state.timeOfDay];
    const behaviorType = getBehaviorType(particle.seed);
    
    // Aplicar bonus de comportamiento
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
    const dayProgress = (this.currentTick % this.config.dayLength) / this.config.dayLength;
    return Math.floor(dayProgress * 24);
  }
  
  /**
   * Obtener hora formateada
   */
  getTimeString(): string {
    const dayProgress = (this.currentTick % this.config.dayLength) / this.config.dayLength;
    const totalMinutes = Math.floor(dayProgress * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}
