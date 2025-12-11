/**
 * Animal configurations with biome-specific spawning
 * Migrated from V3 UnaCartaParaIsaBackend
 *
 * Each animal type has:
 * - Basic stats (health, speed, detection)
 * - Behavior (flee, hunt, consume resources)
 * - Spawning (probability, suitable biomes, group size)
 */

import { AnimalType } from "./AnimalEnums";
import { BiomeType } from "../core/BiomeResolver";

export enum SpecialPreyType {
  HUMAN = "human",
}

export type PreyType = AnimalType | SpecialPreyType;

export interface AnimalConfig {
  type: AnimalType;
  displayName: string;

  spriteKey: string;
  scale: number;
  tint?: number;

  maxHealth: number;
  speed: number;
  fleeSpeed: number;
  detectionRange: number;

  hungerDecayRate: number;
  thirstDecayRate: number;
  reproductionCooldown: number;
  lifespan: number;

  foodValue: number;
  canBeHunted: boolean;
  fleeFromHumans: boolean;
  fleeDistance: number;

  consumesVegetation: boolean;
  consumesWater: boolean;
  vegetationConsumptionRate: number;
  waterConsumptionRate: number;

  isPredator?: boolean;
  preyTypes?: PreyType[];
  huntingRange?: number;
  attackDamage?: number;

  isAquatic?: boolean;

  spawnProbability: number;
  suitableBiomes: string[];
  groupSize: { min: number; max: number };
  minDistanceBetweenGroups: number;
}

/**
 * Animal configurations - 6 types with biome-specific spawning
 */
export const ANIMAL_CONFIGS: Record<string, AnimalConfig> = {
  rabbit: {
    type: AnimalType.RABBIT,
    displayName: "Conejo",
    spriteKey: AnimalType.RABBIT,
    scale: 0.8,
    tint: 0xccaa88,
    maxHealth: 30,
    speed: 80,
    fleeSpeed: 150,
    detectionRange: 200,
    hungerDecayRate: 4.0,
    thirstDecayRate: 6.0,
    reproductionCooldown: 10000,
    lifespan: 300000,
    foodValue: 15,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 150,
    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 2,
    waterConsumptionRate: 3,
    spawnProbability: 0.25,
    suitableBiomes: [
      BiomeType.GRASSLAND,
      BiomeType.FOREST,
      BiomeType.MYSTICAL,
      BiomeType.VILLAGE,
    ],
    groupSize: { min: 3, max: 7 },
    minDistanceBetweenGroups: 200,
  },

  deer: {
    type: AnimalType.DEER,
    displayName: "Ciervo",
    spriteKey: AnimalType.DEER,
    scale: 1.2,
    tint: 0xaa8866,
    maxHealth: 50,
    speed: 100,
    fleeSpeed: 180,
    detectionRange: 250,
    hungerDecayRate: 3.0,
    thirstDecayRate: 5.0,
    reproductionCooldown: 60000,
    lifespan: 600000,
    foodValue: 30,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 200,
    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 3,
    waterConsumptionRate: 4,
    spawnProbability: 0.15,
    suitableBiomes: [BiomeType.FOREST, BiomeType.MYSTICAL, BiomeType.VILLAGE],
    groupSize: { min: 2, max: 4 },
    minDistanceBetweenGroups: 300,
  },

  boar: {
    type: AnimalType.BOAR,
    displayName: "Jabalí",
    spriteKey: AnimalType.BOAR,
    scale: 1.0,
    tint: 0x665544,
    maxHealth: 70,
    speed: 70,
    fleeSpeed: 120,
    detectionRange: 180,
    hungerDecayRate: 5.0,
    thirstDecayRate: 4.0,
    reproductionCooldown: 75000,
    lifespan: 480000,
    foodValue: 25,
    canBeHunted: true,
    fleeFromHumans: false,
    fleeDistance: 100,
    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 4,
    waterConsumptionRate: 3,
    spawnProbability: 0.1,
    suitableBiomes: [BiomeType.FOREST, BiomeType.GRASSLAND, BiomeType.VILLAGE],
    groupSize: { min: 1, max: 2 },
    minDistanceBetweenGroups: 350,
  },

  bird: {
    type: AnimalType.BIRD,
    displayName: "Pájaro",
    spriteKey: AnimalType.BIRD,
    scale: 0.6,
    tint: 0x8899aa,
    maxHealth: 15,
    speed: 120,
    fleeSpeed: 200,
    detectionRange: 300,
    hungerDecayRate: 6.0,
    thirstDecayRate: 7.0,
    reproductionCooldown: 15000,
    lifespan: 240000,
    foodValue: 8,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 250,
    consumesVegetation: true,
    consumesWater: true,
    vegetationConsumptionRate: 1,
    waterConsumptionRate: 2,
    spawnProbability: 0.25,
    suitableBiomes: [
      BiomeType.FOREST,
      BiomeType.MYSTICAL,
      BiomeType.GRASSLAND,
      BiomeType.WETLAND,
      BiomeType.VILLAGE,
    ],
    groupSize: { min: 3, max: 8 },
    minDistanceBetweenGroups: 200,
  },

  fish: {
    type: AnimalType.FISH,
    displayName: "Pez",
    spriteKey: AnimalType.FISH,
    scale: 0.7,
    tint: 0x6688aa,
    maxHealth: 20,
    speed: 60,
    fleeSpeed: 100,
    detectionRange: 150,
    hungerDecayRate: 3.0,
    thirstDecayRate: 0,
    reproductionCooldown: 50000,
    lifespan: 360000,
    foodValue: 12,
    canBeHunted: true,
    fleeFromHumans: true,
    fleeDistance: 120,
    consumesVegetation: true,
    consumesWater: false,
    vegetationConsumptionRate: 1.5,
    waterConsumptionRate: 0,
    isAquatic: true,
    spawnProbability: 0.3,
    suitableBiomes: [
      BiomeType.WETLAND,
      BiomeType.OCEAN,
      BiomeType.LAKE,
      BiomeType.RIVER,
    ],
    groupSize: { min: 4, max: 10 },
    minDistanceBetweenGroups: 300,
  },

  wolf: {
    type: AnimalType.WOLF,
    displayName: "Lobo",
    spriteKey: AnimalType.WOLF,
    scale: 1.1,
    tint: 0x666666,
    maxHealth: 80,
    speed: 110,
    fleeSpeed: 140,
    detectionRange: 300,
    hungerDecayRate: 5.0,
    thirstDecayRate: 4.0,
    reproductionCooldown: 90000,
    lifespan: 720000,
    foodValue: 35,
    canBeHunted: true,
    fleeFromHumans: false,
    fleeDistance: 180,
    consumesVegetation: false,
    consumesWater: true,
    vegetationConsumptionRate: 0,
    waterConsumptionRate: 3,
    isPredator: true,
    preyTypes: [AnimalType.RABBIT, AnimalType.DEER, SpecialPreyType.HUMAN],
    huntingRange: 250,
    attackDamage: 20,
    spawnProbability: 0.15,
    suitableBiomes: [BiomeType.FOREST, BiomeType.MYSTICAL],
    groupSize: { min: 1, max: 3 },
    minDistanceBetweenGroups: 500,
  },
};

/**
 * Get configuration for a specific animal type
 */
export function getAnimalConfig(type: string): AnimalConfig | undefined {
  return ANIMAL_CONFIGS[type];
}

/**
 * Get all animal type keys
 */
export function getAllAnimalTypes(): string[] {
  return Object.keys(ANIMAL_CONFIGS);
}

/**
 * Get animals that can spawn in a specific biome
 */
export function getAnimalsForBiome(biome: string): AnimalConfig[] {
  return Object.values(ANIMAL_CONFIGS).filter((config) =>
    config.suitableBiomes.includes(biome),
  );
}
