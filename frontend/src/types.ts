/**
 * Re-export shared types
 */
export * from "@shared/types";

import { Particle } from "@shared/types";

// ============================================
// Tipos específicos del Frontend
// ============================================

// Estado extendido para interpolación en frontend
export interface ParticleRenderState extends Particle {
  displayX: number; // Posición visual interpolada
  displayY: number;
  prevX: number; // Posición anterior (para interpolación)
  prevY: number;
}

// Colores de biomas para renderizado
// Note: We are keeping this here in case we want to customize colors per frontend theme,
// though the core color map is now in shared.
// If shared has BIOME_COLORS, we can use that or override it.
// Shared types export BIOME_COLORS, so we don't need to redefine it unless we needed different values.
// The file usage shows importing BIOME_COLORS.
// We will just re-export it from shared (already done via export *).

// ============================================
// Tipos adicionales para visualización
// ============================================

export interface Community {
  id: number;
  centerX: number;
  centerY: number;
  radius: number;
  population: number;
  dominantSignature: [number, number, number, number];
}

export interface ConflictZone {
  x: number;
  y: number;
  tension: number;
}

export interface Artifact {
  id: number;
  type: string;
  x: number;
  y: number;
  discovered: boolean;
}

export interface Character {
  id: number;
  name: string;
  x: number;
  y: number;
  type: CharacterType;
}

export enum CharacterType {
  CHARACTER = "character",
  HERO = "hero",
}

export interface ExtendedWorldState {
  tick: number;
  particles: Particle[];
  // fields: Record<FieldType, Float32Array>; // Derived from shared WorldState if needed
  communities?: Community[];
  conflicts?: ConflictZone[];
  artifacts?: Artifact[];
  characters?: Character[];
  tensionField?: Float32Array;
}
