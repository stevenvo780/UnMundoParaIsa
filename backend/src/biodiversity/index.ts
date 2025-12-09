/**
 * Biodiversity module - Exports
 */

export {
  type BehaviorType,
  type BehaviorConfig,
  type BiodiversityStats,
  BEHAVIOR_CONFIGS,
  getBehaviorType,
  getParticleBehavior,
  getBehaviorColor,
  getBehaviorName,
  calculateBiodiversity,
  applyBehaviorWeights,
} from "./BehaviorTypes.js";

export { AnimalType, AnimalState, AnimalTargetType } from "./AnimalEnums.js";

export {
  type AnimalConfig,
  ANIMAL_CONFIGS,
  getAnimalConfig,
  getAllAnimalTypes,
  getAnimalsForBiome,
} from "./AnimalConfigs.js";
