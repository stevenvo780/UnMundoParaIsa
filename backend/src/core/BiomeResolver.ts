/**
 * BiomeResolver - Determina biomas basándose en factores ambientales
 * Adaptado del proyecto original UnaCartaParaIsaBackend
 *
 * Usa temperature/moisture/elevation/continentality para resolver biomas realistas
 */

export enum BiomeType {
  GRASSLAND = "grassland",
  FOREST = "forest",
  DESERT = "desert",
  TUNDRA = "tundra",
  SWAMP = "swamp",
  WETLAND = "wetland",
  MOUNTAIN = "mountain",
  BEACH = "beach",
  OCEAN = "ocean",
  LAKE = "lake",
  RIVER = "river",
  MYSTICAL = "mystical",
  MOUNTAINOUS = "mountainous",
  VILLAGE = "village",
}

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  color: number;
  isWalkable: boolean;

  temperature: [number, number];
  moisture: [number, number];
  elevation: [number, number];

  density: {
    trees?: number;
    plants?: number;
    rocks?: number;
    water?: number;
  };
}

export const BIOME_CONFIGS: BiomeConfig[] = [
  {
    id: BiomeType.GRASSLAND,
    name: "Pradera",
    color: 0x7cb342,
    isWalkable: true,
    temperature: [0.3, 0.7],
    moisture: [0.3, 0.65],
    elevation: [0.25, 0.7],
    density: { trees: 0.15, plants: 0.3 },
  },
  {
    id: BiomeType.FOREST,
    name: "Bosque",
    color: 0x2e7d32,
    isWalkable: true,
    temperature: [0.2, 0.8],
    moisture: [0.55, 1.0],
    elevation: [0.2, 0.75],
    density: { trees: 0.85, plants: 0.4 },
  },
  {
    id: BiomeType.DESERT,
    name: "Desierto",
    color: 0xd4a574,
    isWalkable: true,
    temperature: [0.6, 1.0],
    moisture: [0.0, 0.3],
    elevation: [0.1, 0.6],
    density: { rocks: 0.2 },
  },
  {
    id: BiomeType.TUNDRA,
    name: "Tundra",
    color: 0xb0bec5,
    isWalkable: true,
    temperature: [0.0, 0.35],
    moisture: [0.0, 0.6],
    elevation: [0.0, 0.8],
    density: { trees: 0.1, rocks: 0.15 },
  },
  {
    id: BiomeType.SWAMP,
    name: "Pantano",
    color: 0x558b2f,
    isWalkable: true,
    temperature: [0.5, 0.9],
    moisture: [0.7, 1.0],
    elevation: [0.0, 0.35],
    density: { trees: 0.5, plants: 0.6, water: 0.4 },
  },
  {
    id: BiomeType.WETLAND,
    name: "Humedal",
    color: 0x66bb6a,
    isWalkable: true,
    temperature: [0.3, 0.7],
    moisture: [0.6, 0.85],
    elevation: [0.15, 0.4],
    density: { plants: 0.5, water: 0.3 },
  },
  {
    id: BiomeType.MOUNTAIN,
    name: "Montaña",
    color: 0x78909c,
    isWalkable: true,
    temperature: [0.0, 0.5],
    moisture: [0.0, 0.7],
    elevation: [0.7, 1.0],
    density: { rocks: 0.7, trees: 0.1 },
  },
  {
    id: BiomeType.BEACH,
    name: "Playa",
    color: 0xfff59d,
    isWalkable: true,
    temperature: [0.3, 0.9],
    moisture: [0.2, 0.6],
    elevation: [0.05, 0.2],
    density: {},
  },
  {
    id: BiomeType.OCEAN,
    name: "Océano",
    color: 0x0288d1,
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [1.0, 1.0],
    elevation: [0.0, 0.0],
    density: { water: 1.0 },
  },
  {
    id: BiomeType.LAKE,
    name: "Lago",
    color: 0x4fc3f7,
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [0.8, 1.0],
    elevation: [0.0, 0.3],
    density: { water: 1.0 },
  },
  {
    id: BiomeType.RIVER,
    name: "Río",
    color: 0x29b6f6,
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [0.7, 1.0],
    elevation: [0.1, 0.7],
    density: { water: 1.0 },
  },

  {
    id: BiomeType.MYSTICAL,
    name: "Bosque Místico",
    color: 0x7b1fa2,
    isWalkable: true,
    temperature: [0.2, 0.5],
    moisture: [0.4, 0.7],
    elevation: [0.1, 0.5],
    density: { trees: 0.3, plants: 0.12 },
  },
  {
    id: BiomeType.MOUNTAINOUS,
    name: "Zona Montañosa",
    color: 0x5d4037,
    isWalkable: true,
    temperature: [0.1, 0.4],
    moisture: [0.1, 0.4],
    elevation: [0.7, 1.0],
    density: { trees: 0.13, rocks: 0.42 },
  },
  {
    id: BiomeType.VILLAGE,
    name: "Zona de Pueblo",
    color: 0x8d6e63,
    isWalkable: true,
    temperature: [0.4, 0.7],
    moisture: [0.4, 0.7],
    elevation: [0.3, 0.6],
    density: { trees: 0.13, plants: 0.22 },
  },
];

const BIOME_MAP = new Map<BiomeType, BiomeConfig>();
BIOME_CONFIGS.forEach((b) => BIOME_MAP.set(b.id, b));

/**
 * BiomeResolver - Resuelve bioma a partir de factores ambientales
 */
export class BiomeResolver {
  private walkableBiomes: BiomeConfig[];

  constructor() {
    this.walkableBiomes = BIOME_CONFIGS.filter((b) => b.isWalkable);
  }

  /**
   * Resolver bioma basándose en factores ambientales (lógica V3)
   *
   * Estrategia:
   * - OCEAN en baja continentalidad
   * - LAKE en baja elevación + alta humedad
   * - Buscar candidatos que cumplan rangos de temp/moisture/elev
   * - Elegir mejor ajuste por scoring
   *
   * @param temperature - Temperatura normalizada [0..1]
   * @param moisture - Humedad normalizada [0..1]
   * @param elevation - Elevación normalizada [0..1]
   * @param continentality - Distancia a masas de agua [0..1]
   * @returns Tipo de bioma resuelto
   */
  resolveBiome(
    temperature: number,
    moisture: number,
    elevation: number,
    continentality: number,
  ): BiomeType {
    // Determinar masas de agua combinando elevación con cercanía a la costa
    const coastProximity = 1 - continentality;
    const elevationWithCoast =
      elevation + continentality * 0.25 - coastProximity * 0.05;
    const seaLevel = 0.28 + coastProximity * 0.12;

    if (elevationWithCoast < seaLevel) {
      return BiomeType.OCEAN;
    }

    const beachBand = seaLevel + 0.04 + coastProximity * 0.03;
    if (elevationWithCoast < beachBand) {
      return BiomeType.BEACH;
    }

    const lakeMoistureBias =
      moisture +
      Math.max(0, 0.5 - elevation) * 0.3 +
      coastProximity * 0.05;
    const lakeLevel = Math.max(0.18, 0.32 - continentality * 0.08);

    if (elevation < lakeLevel && lakeMoistureBias > 0.55) {
      return BiomeType.LAKE;
    }

    const wetlandLevel = lakeLevel + 0.08;
    if (elevation < wetlandLevel && lakeMoistureBias > 0.52) {
      return BiomeType.WETLAND;
    }

    const candidates = this.walkableBiomes.filter((b) =>
      this.matchesCriteria(b, temperature, moisture, elevation),
    );

    if (candidates.length === 0) {
      return this.findClosestBiome(temperature, moisture, elevation);
    }

    if (candidates.length === 1) {
      return candidates[0].id;
    }

    return this.getBestFit(candidates, temperature, moisture, elevation);
  }

  /**
   * Verificar si un bioma cumple con los criterios dados
   */
  private matchesCriteria(
    biome: BiomeConfig,
    temp: number,
    moist: number,
    elev: number,
  ): boolean {
    return (
      temp >= biome.temperature[0] &&
      temp <= biome.temperature[1] &&
      moist >= biome.moisture[0] &&
      moist <= biome.moisture[1] &&
      elev >= biome.elevation[0] &&
      elev <= biome.elevation[1]
    );
  }

  /**
   * Obtener el mejor ajuste entre candidatos
   */
  private getBestFit(
    candidates: BiomeConfig[],
    temp: number,
    moist: number,
    elev: number,
  ): BiomeType {
    let bestBiome = candidates[0];
    let bestScore = -1;

    for (const biome of candidates) {
      const score = this.calculateScore(biome, temp, moist, elev);
      if (score > bestScore) {
        bestScore = score;
        bestBiome = biome;
      }
    }

    return bestBiome.id;
  }

  /**
   * Calcular puntuación de ajuste (más cercano al centro = mejor)
   */
  private calculateScore(
    biome: BiomeConfig,
    temp: number,
    moist: number,
    elev: number,
  ): number {
    const tempCenter = (biome.temperature[0] + biome.temperature[1]) / 2;
    const moistCenter = (biome.moisture[0] + biome.moisture[1]) / 2;
    const elevCenter = (biome.elevation[0] + biome.elevation[1]) / 2;

    const tempDist = Math.abs(temp - tempCenter);
    const moistDist = Math.abs(moist - moistCenter);
    const elevDist = Math.abs(elev - elevCenter);

    return 1 - (tempDist + moistDist + elevDist) / 3;
  }

  /**
   * Encontrar bioma más cercano si no hay coincidencia exacta
   */
  private findClosestBiome(
    temp: number,
    moist: number,
    elev: number,
  ): BiomeType {
    let bestBiome = this.walkableBiomes[0];
    let minDistance = Infinity;

    for (const biome of this.walkableBiomes) {
      const tempCenter = (biome.temperature[0] + biome.temperature[1]) / 2;
      const moistCenter = (biome.moisture[0] + biome.moisture[1]) / 2;
      const elevCenter = (biome.elevation[0] + biome.elevation[1]) / 2;

      const dist =
        (temp - tempCenter) ** 2 +
        (moist - moistCenter) ** 2 +
        (elev - elevCenter) ** 2;

      if (dist < minDistance) {
        minDistance = dist;
        bestBiome = biome;
      }
    }

    return bestBiome.id;
  }

  /**
   * Obtener configuración de un bioma
   */
  getBiomeConfig(biome: BiomeType): BiomeConfig | undefined {
    return BIOME_MAP.get(biome);
  }

  /**
   * Obtener color de un bioma con variación
   */
  getBiomeColor(biome: BiomeType, variation: number = 0): number {
    const config = BIOME_MAP.get(biome);
    if (!config) return 0x808080;

    const baseColor = config.color;

    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    const factor = 1 + variation * 0.1;

    const newR = Math.min(255, Math.max(0, Math.floor(r * factor)));
    const newG = Math.min(255, Math.max(0, Math.floor(g * factor)));
    const newB = Math.min(255, Math.max(0, Math.floor(b * factor)));

    return (newR << 16) | (newG << 8) | newB;
  }
}
