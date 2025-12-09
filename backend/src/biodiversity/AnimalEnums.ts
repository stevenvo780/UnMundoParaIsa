/**
 * Animal type enumerations for the simulation system.
 * Migrated from V3 UnaCartaParaIsaBackend
 *
 * Defines all animal types and states used in the simulation.
 */

/**
 * Enumeration of animal types.
 */
export enum AnimalType {
  RABBIT = "rabbit",
  DEER = "deer",
  BOAR = "boar",
  BIRD = "bird",
  FISH = "fish",
  WOLF = "wolf",
}

/**
 * Enumeration of animal states.
 */
export enum AnimalState {
  IDLE = "idle",
  WANDERING = "wandering",
  SEEKING_FOOD = "seeking_food",
  SEEKING_WATER = "seeking_water",
  EATING = "eating",
  DRINKING = "drinking",
  FLEEING = "fleeing",
  HUNTING = "hunting",
  MATING = "mating",
  DEAD = "dead",
}

/**
 * Enumeration of animal target types.
 */
export enum AnimalTargetType {
  FOOD = "food",
  WATER = "water",
  MATE = "mate",
}
