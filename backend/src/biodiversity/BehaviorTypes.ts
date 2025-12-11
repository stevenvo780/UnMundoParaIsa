/**
 * BehaviorTypes - Biodiversidad emergente basada en seed
 * Los tipos de comportamiento emergen de los bits del seed, no se asignan explícitamente
 *
 * Concepto: En lugar de tener "tipos de animales" fijos, el comportamiento
 * de cada partícula deriva de su genética (seed).
 */

import { Particle } from "../types";

export type BehaviorType =
  | "forager"
  | "hunter"
  | "nomad"
  | "settler"
  | "guardian"
  | "explorer"
  | "gatherer"
  | "breeder";

export interface BehaviorConfig {
  foodWeight: number;
  waterWeight: number;
  trailWeight: number;
  dangerWeight: number;
  explorationBonus: number;
  metabolismMod: number;
  reproductionMod: number;
  speedMod: number;
  socialRadius: number;
}

export const BEHAVIOR_CONFIGS: Record<BehaviorType, BehaviorConfig> = {
  forager: {
    foodWeight: 1.2,
    waterWeight: 0.8,
    trailWeight: 0.3,
    dangerWeight: -2.0,
    explorationBonus: 0.2,
    metabolismMod: 1.0,
    reproductionMod: 1.0,
    speedMod: 1.0,
    socialRadius: 5,
  },
  hunter: {
    foodWeight: 0.5,
    waterWeight: 0.3,
    trailWeight: 0.8,
    dangerWeight: 0.5,
    explorationBonus: 0.3,
    metabolismMod: 1.3,
    reproductionMod: 0.8,
    speedMod: 1.4,
    socialRadius: 8,
  },
  nomad: {
    foodWeight: 0.8,
    waterWeight: 1.0,
    trailWeight: -0.5,
    dangerWeight: -1.0,
    explorationBonus: 0.8,
    metabolismMod: 0.9,
    reproductionMod: 0.6,
    speedMod: 1.2,
    socialRadius: 3,
  },
  settler: {
    foodWeight: 1.0,
    waterWeight: 1.0,
    trailWeight: 0.7,
    dangerWeight: -2.5,
    explorationBonus: -0.3,
    metabolismMod: 0.8,
    reproductionMod: 1.3,
    speedMod: 0.8,
    socialRadius: 7,
  },
  guardian: {
    foodWeight: 0.6,
    waterWeight: 0.6,
    trailWeight: 0.5,
    dangerWeight: 1.5,
    explorationBonus: 0.0,
    metabolismMod: 1.2,
    reproductionMod: 0.7,
    speedMod: 1.1,
    socialRadius: 10,
  },
  explorer: {
    foodWeight: 0.7,
    waterWeight: 0.7,
    trailWeight: -0.8,
    dangerWeight: 0.0,
    explorationBonus: 1.2,
    metabolismMod: 1.1,
    reproductionMod: 0.5,
    speedMod: 1.3,
    socialRadius: 2,
  },
  gatherer: {
    foodWeight: 1.5,
    waterWeight: 1.2,
    trailWeight: 0.2,
    dangerWeight: -2.0,
    explorationBonus: 0.1,
    metabolismMod: 0.7,
    reproductionMod: 1.1,
    speedMod: 0.9,
    socialRadius: 4,
  },
  breeder: {
    foodWeight: 1.3,
    waterWeight: 1.0,
    trailWeight: 0.6,
    dangerWeight: -2.5,
    explorationBonus: 0.0,
    metabolismMod: 1.4,
    reproductionMod: 2.0,
    speedMod: 0.7,
    socialRadius: 6,
  },
};

/**
 * Obtener tipo de comportamiento desde seed
 * Los primeros 3 bits determinan el tipo base (8 comportamientos)
 */
export function getBehaviorType(seed: number): BehaviorType {
  const bits = seed & 0x07;

  const types: BehaviorType[] = [
    "forager",
    "hunter",
    "nomad",
    "settler",
    "guardian",
    "explorer",
    "gatherer",
    "breeder",
  ];

  return types[bits];
}

/**
 * Obtener configuración de comportamiento para una partícula
 */
export function getParticleBehavior(particle: Particle): BehaviorConfig {
  const type = getBehaviorType(particle.seed);
  return BEHAVIOR_CONFIGS[type];
}

/**
 * Obtener color distintivo para visualización
 */
export function getBehaviorColor(type: BehaviorType): number {
  const colors: Record<BehaviorType, number> = {
    forager: 0x4caf50,
    hunter: 0xf44336,
    nomad: 0xff9800,
    settler: 0x2196f3,
    guardian: 0x9c27b0,
    explorer: 0xffeb3b,
    gatherer: 0x795548,
    breeder: 0xe91e63,
  };
  return colors[type];
}

/**
 * Obtener nombre en español para UI
 */
export function getBehaviorName(type: BehaviorType): string {
  const names: Record<BehaviorType, string> = {
    forager: "Recolector",
    hunter: "Cazador",
    nomad: "Nómada",
    settler: "Colono",
    guardian: "Guardián",
    explorer: "Explorador",
    gatherer: "Cosechador",
    breeder: "Criador",
  };
  return names[type];
}

export interface BiodiversityStats {
  total: number;
  byType: Record<BehaviorType, number>;
  dominantType: BehaviorType;
  diversityIndex: number;
}

/**
 * Calcular estadísticas de biodiversidad de un conjunto de partículas
 */
export function calculateBiodiversity(
  particles: Particle[],
): BiodiversityStats {
  const alive = particles.filter((p) => p.alive);
  const counts: Record<BehaviorType, number> = {
    forager: 0,
    hunter: 0,
    nomad: 0,
    settler: 0,
    guardian: 0,
    explorer: 0,
    gatherer: 0,
    breeder: 0,
  };

  for (const p of alive) {
    const type = getBehaviorType(p.seed);
    counts[type]++;
  }

  let maxCount = 0;
  let dominant: BehaviorType = "forager";
  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type as BehaviorType;
    }
  }

  const total = alive.length;
  let shannonIndex = 0;
  if (total > 0) {
    for (const count of Object.values(counts)) {
      if (count > 0) {
        const p = count / total;
        shannonIndex -= p * Math.log(p);
      }
    }

    const maxEntropy = Math.log(8);
    shannonIndex = shannonIndex / maxEntropy;
  }

  return {
    total: alive.length,
    byType: counts,
    dominantType: dominant,
    diversityIndex: shannonIndex,
  };
}

/**
 * Modificar pesos de gradiente según comportamiento
 */
export function applyBehaviorWeights(
  particle: Particle,
  baseWeights: {
    food: number;
    water: number;
    trail: number;
    danger: number;
    cost: number;
  },
): {
  food: number;
  water: number;
  trail: number;
  danger: number;
  cost: number;
  exploration: number;
} {
  const behavior = getParticleBehavior(particle);

  return {
    food: baseWeights.food * behavior.foodWeight,
    water: baseWeights.water * behavior.waterWeight,
    trail: baseWeights.trail * behavior.trailWeight,
    danger: baseWeights.danger * behavior.dangerWeight,
    cost: baseWeights.cost,
    exploration: behavior.explorationBonus,
  };
}
