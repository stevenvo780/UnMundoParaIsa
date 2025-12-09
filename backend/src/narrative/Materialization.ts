/**
 * Materialization - Sistema de materialización de partículas
 * Partícula → Personaje → Héroe
 */

import { Particle } from "../types.js";
import { getSignature } from "../social/Signatures.js";

export type EntityType = "particle" | "character" | "hero";

/**
 * BaseCharacter - Propiedades comunes
 */
export interface BaseCharacter {
  id: number;
  particleId: number;
  name: string;

  x: number;
  y: number;
  energy: number;
  seed: number;
  signature: [number, number, number, number];

  bornAt: number;
  age: number;
  lineage: number[];
  events: CharacterEvent[];

  partner?: number;
  children: number[];
  community?: number;

  traits: string[];
}

/**
 * Character - Partícula materializada con identidad
 */
export interface Character extends BaseCharacter {
  type: "character";
}

/**
 * Hero - Personaje notable con diálogos
 */
export interface Hero extends BaseCharacter {
  type: "hero";
  title: string;
  dialogues: string[];
  achievements: string[];
  legacy: string;
  discoveredFragments: string[];
}

export interface CharacterEvent {
  tick: number;
  type:
    | "born"
    | "paired"
    | "child"
    | "discovery"
    | "migration"
    | "conflict"
    | "survival";
  description: string;
  location: { x: number; y: number };
}

const FIRST_NAMES = {
  male: [
    "Aiden",
    "Kai",
    "Leo",
    "Milo",
    "Nova",
    "Orion",
    "Phoenix",
    "River",
    "Sol",
    "Zephyr",
  ],
  female: [
    "Aurora",
    "Celeste",
    "Dawn",
    "Ember",
    "Flora",
    "Iris",
    "Luna",
    "Sage",
    "Stella",
    "Willow",
  ],
  neutral: [
    "Ash",
    "Blake",
    "Eden",
    "Haven",
    "Journey",
    "Moss",
    "Ocean",
    "Rain",
    "Sky",
    "Storm",
  ],
};

const FAMILY_SUFFIXES = [
  "del Valle",
  "de la Luz",
  "del Bosque",
  "de las Estrellas",
  "del Río",
  "de la Luna",
];

const TRAITS = [
  "curioso",
  "valiente",
  "gentil",
  "sabio",
  "persistente",
  "creativo",
  "compasivo",
  "aventurero",
  "tranquilo",
  "leal",
  "soñador",
  "pragmático",
  "alegre",
  "reflexivo",
  "protector",
];

const TITLES = [
  "El Explorador",
  "La Visionaria",
  "El Guardián",
  "La Pionera",
  "El Fundador",
  "La Matriarca",
  "El Pacificador",
  "La Sabia",
];

/**
 * Generar nombre desde seed
 */
export function generateName(seed: number): string {
  const sig = getSignature(seed);

  const genderIdx = Math.floor(sig[0] * 3);
  const genderKey =
    genderIdx === 0 ? "male" : genderIdx === 1 ? "female" : "neutral";
  const names = FIRST_NAMES[genderKey];

  const nameIdx = Math.floor(sig[1] * names.length);
  const firstName = names[nameIdx];

  const familyIdx = Math.floor(sig[2] * FAMILY_SUFFIXES.length);
  const familySuffix = FAMILY_SUFFIXES[familyIdx];

  return `${firstName} ${familySuffix}`;
}

/**
 * Generar traits desde seed
 */
export function generateTraits(seed: number, count: number = 3): string[] {
  const result: string[] = [];
  const sig = getSignature(seed);

  const indices = new Set<number>();

  for (let i = 0; i < 4 && result.length < count; i++) {
    const idx = Math.floor(sig[i] * TRAITS.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(TRAITS[idx]);
    }
  }

  while (result.length < count) {
    const idx = Math.floor(Math.random() * TRAITS.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(TRAITS[idx]);
    }
  }

  return result;
}

/**
 * Generar título para héroe
 */
export function generateTitle(seed: number): string {
  const idx = Math.floor(((seed & 0xff) / 256) * TITLES.length);
  return TITLES[idx];
}

/**
 * MaterializationManager - Gestiona la materialización de entidades
 */
export class MaterializationManager {
  private characters: Map<number, Character> = new Map();
  private heroes: Map<number, Hero> = new Map();
  private particleToCharacter: Map<number, number> = new Map();
  private nextId = 1;
  private tick = 0;

  readonly config = {
    minAgeForCharacter: 500,
    minAgeForHero: 2000,
    minDiscoveries: 3,
    materializationRadius: 50,
  };

  /**
   * Actualizar tick
   */
  setTick(tick: number): void {
    this.tick = tick;
  }

  /**
   * Verificar si partícula puede materializarse como Character
   */
  canMaterialize(particle: Particle, age: number): boolean {
    if (this.particleToCharacter.has(particle.id)) return false;
    return age >= this.config.minAgeForCharacter;
  }

  /**
   * Materializar partícula a Character
   */
  materialize(
    particle: Particle,
    age: number,
    lineage: number[] = [],
  ): Character {
    const character: Character = {
      id: this.nextId++,
      particleId: particle.id,
      name: generateName(particle.seed),
      type: "character",

      x: particle.x,
      y: particle.y,
      energy: particle.energy,
      seed: particle.seed,
      signature: getSignature(particle.seed),

      bornAt: this.tick - age,
      age,
      lineage,
      events: [
        {
          tick: this.tick,
          type: "born",
          description: "Materializó en el mundo",
          location: { x: particle.x, y: particle.y },
        },
      ],

      children: [],
      traits: generateTraits(particle.seed),
    };

    this.characters.set(character.id, character);
    this.particleToCharacter.set(particle.id, character.id);

    return character;
  }

  /**
   * Verificar si Character puede ser promovido a Hero
   */
  canPromoteToHero(character: Character): boolean {
    if (this.heroes.has(character.id)) return false;
    if (character.age < this.config.minAgeForHero) return false;

    const discoveries = character.events.filter(
      (e) => e.type === "discovery",
    ).length;
    return discoveries >= this.config.minDiscoveries;
  }

  /**
   * Promover Character a Hero
   */
  promoteToHero(character: Character): Hero {
    const hero: Hero = {
      ...character,
      type: "hero",
      title: generateTitle(character.seed),
      dialogues: [],
      achievements: character.events
        .filter((e) => e.type === "discovery" || e.type === "survival")
        .map((e) => e.description),
      legacy: `${character.name} dejó su marca en el mundo`,
      discoveredFragments: [],
    };

    this.characters.delete(character.id);
    this.heroes.set(hero.id, hero);

    return hero;
  }

  /**
   * Actualizar posición de Character desde partícula
   */
  updateFromParticle(particle: Particle): void {
    const characterId = this.particleToCharacter.get(particle.id);
    if (!characterId) return;

    const character =
      this.characters.get(characterId) || this.heroes.get(characterId);
    if (!character) return;

    character.x = particle.x;
    character.y = particle.y;
    character.energy = particle.energy;
    character.age++;
  }

  /**
   * Registrar evento para Character
   */
  addEvent(particleId: number, event: Omit<CharacterEvent, "tick">): void {
    const characterId = this.particleToCharacter.get(particleId);
    if (!characterId) return;

    const character =
      this.characters.get(characterId) || this.heroes.get(characterId);
    if (!character) return;

    character.events.push({
      ...event,
      tick: this.tick,
    });
  }

  /**
   * Registrar descubrimiento de fragmento para Hero
   */
  addDiscoveredFragment(heroId: number, fragmentId: string): void {
    const hero = this.heroes.get(heroId);
    if (!hero) return;

    if (!hero.discoveredFragments.includes(fragmentId)) {
      hero.discoveredFragments.push(fragmentId);
    }
  }

  /**
   * Manejar muerte de partícula
   */
  handleDeath(particleId: number): void {
    const characterId = this.particleToCharacter.get(particleId);
    if (!characterId) return;

    const character =
      this.characters.get(characterId) || this.heroes.get(characterId);
    if (character) {
      character.events.push({
        tick: this.tick,
        type: "survival",
        description: `Vivió ${character.age} ciclos`,
        location: { x: character.x, y: character.y },
      });
    }

    this.particleToCharacter.delete(particleId);
  }

  /**
   * Obtener Character por ID de partícula
   */
  getByParticleId(particleId: number): Character | Hero | undefined {
    const characterId = this.particleToCharacter.get(particleId);
    if (!characterId) return undefined;

    return this.characters.get(characterId) || this.heroes.get(characterId);
  }

  /**
   * Obtener todos los Characters
   */
  getAllCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /**
   * Obtener todos los Heroes
   */
  getAllHeroes(): Hero[] {
    return Array.from(this.heroes.values());
  }

  /**
   * Obtener estadísticas
   */
  getStats(): MaterializationStats {
    return {
      characters: this.characters.size,
      heroes: this.heroes.size,
      totalMaterialized: this.characters.size + this.heroes.size,
      oldestCharacter: Math.max(
        0,
        ...Array.from(this.characters.values()).map((c) => c.age),
      ),
      oldestHero: Math.max(
        0,
        ...Array.from(this.heroes.values()).map((h) => h.age),
      ),
    };
  }

  /**
   * Serializar para persistencia
   */
  serialize(): { characters: Character[]; heroes: Hero[] } {
    return {
      characters: Array.from(this.characters.values()),
      heroes: Array.from(this.heroes.values()),
    };
  }

  /**
   * Cargar desde datos
   */
  load(data: { characters: Character[]; heroes: Hero[] }): void {
    this.characters.clear();
    this.heroes.clear();
    this.particleToCharacter.clear();

    for (const char of data.characters) {
      this.characters.set(char.id, char);
      this.particleToCharacter.set(char.particleId, char.id);
      if (char.id >= this.nextId) this.nextId = char.id + 1;
    }

    for (const hero of data.heroes) {
      this.heroes.set(hero.id, hero);
      this.particleToCharacter.set(hero.particleId, hero.id);
      if (hero.id >= this.nextId) this.nextId = hero.id + 1;
    }
  }
}

export interface MaterializationStats {
  characters: number;
  heroes: number;
  totalMaterialized: number;
  oldestCharacter: number;
  oldestHero: number;
}
