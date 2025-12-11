/**
 * Biodiversity module - Exports
 */

export {
  BehaviorType,
  type BehaviorConfig,
  type BiodiversityStats,
  BEHAVIOR_CONFIGS,
  getBehaviorType,
  getParticleBehavior,
  getBehaviorColor,
  getBehaviorName,
  calculateBiodiversity,
  applyBehaviorWeights,
} from "./BehaviorTypes";

export { AnimalType, AnimalState, AnimalTargetType } from "./AnimalEnums";

export {
  type AnimalConfig,
  ANIMAL_CONFIGS,
  getAnimalConfig,
  getAllAnimalTypes,
  getAnimalsForBiome,
} from "./AnimalConfigs";
