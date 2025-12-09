/**
 * BiomeResolver - Determina biomas basándose en factores ambientales
 * Adaptado del proyecto original UnaCartaParaIsaBackend
 * 
 * Usa temperature/moisture/elevation/continentality para resolver biomas realistas
 */

// Tipos de bioma soportados
export enum BiomeType {
  GRASSLAND = 'grassland',
  FOREST = 'forest',
  DESERT = 'desert',
  TUNDRA = 'tundra',
  SWAMP = 'swamp',
  WETLAND = 'wetland',
  MOUNTAIN = 'mountain',
  BEACH = 'beach',
  OCEAN = 'ocean',
  LAKE = 'lake',
  RIVER = 'river',  // Nuevo: ríos
}

// Configuración de cada bioma
export interface BiomeConfig {
  id: BiomeType;
  name: string;
  color: number;         // Color en formato 0xRRGGBB
  isWalkable: boolean;
  
  // Rangos de condiciones [min, max]
  temperature: [number, number];
  moisture: [number, number];
  elevation: [number, number];
  
  // Densidades para generación procedural
  density: {
    trees?: number;
    plants?: number;
    rocks?: number;
    water?: number;
  };
}

// Definición de biomas con rangos de temperatura/humedad/elevación
export const BIOME_CONFIGS: BiomeConfig[] = [
  {
    id: BiomeType.GRASSLAND,
    name: 'Pradera',
    color: 0x7CB342,
    isWalkable: true,
    temperature: [0.3, 0.7],
    moisture: [0.3, 0.65],
    elevation: [0.25, 0.7],
    density: { trees: 0.15, plants: 0.3 },
  },
  {
    id: BiomeType.FOREST,
    name: 'Bosque',
    color: 0x2E7D32,
    isWalkable: true,
    temperature: [0.2, 0.8],
    moisture: [0.55, 1.0],
    elevation: [0.2, 0.75],
    density: { trees: 0.85, plants: 0.4 },
  },
  {
    id: BiomeType.DESERT,
    name: 'Desierto',
    color: 0xD4A574,
    isWalkable: true,
    temperature: [0.6, 1.0],
    moisture: [0.0, 0.3],
    elevation: [0.1, 0.6],
    density: { rocks: 0.2 },
  },
  {
    id: BiomeType.TUNDRA,
    name: 'Tundra',
    color: 0xB0BEC5,
    isWalkable: true,
    temperature: [0.0, 0.35],
    moisture: [0.0, 0.6],
    elevation: [0.0, 0.8],
    density: { trees: 0.1, rocks: 0.15 },
  },
  {
    id: BiomeType.SWAMP,
    name: 'Pantano',
    color: 0x558B2F,
    isWalkable: true,
    temperature: [0.5, 0.9],
    moisture: [0.7, 1.0],
    elevation: [0.0, 0.35],
    density: { trees: 0.5, plants: 0.6, water: 0.4 },
  },
  {
    id: BiomeType.WETLAND,
    name: 'Humedal',
    color: 0x66BB6A,
    isWalkable: true,
    temperature: [0.3, 0.7],
    moisture: [0.6, 0.85],
    elevation: [0.15, 0.4],
    density: { plants: 0.5, water: 0.3 },
  },
  {
    id: BiomeType.MOUNTAIN,
    name: 'Montaña',
    color: 0x78909C,
    isWalkable: true,
    temperature: [0.0, 0.5],
    moisture: [0.0, 0.7],
    elevation: [0.7, 1.0],
    density: { rocks: 0.7, trees: 0.1 },
  },
  {
    id: BiomeType.BEACH,
    name: 'Playa',
    color: 0xFFF59D,
    isWalkable: true,
    temperature: [0.3, 0.9],
    moisture: [0.2, 0.6],
    elevation: [0.05, 0.2],
    density: {},
  },
  {
    id: BiomeType.OCEAN,
    name: 'Océano',
    color: 0x0288D1,
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [1.0, 1.0],
    elevation: [0.0, 0.0],
    density: { water: 1.0 },
  },
  {
    id: BiomeType.LAKE,
    name: 'Lago',
    color: 0x4FC3F7,
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [0.8, 1.0],
    elevation: [0.0, 0.3],
    density: { water: 1.0 },
  },
  {
    id: BiomeType.RIVER,
    name: 'Río',
    color: 0x29B6F6,  // Azul claro
    isWalkable: false,
    temperature: [0.0, 1.0],
    moisture: [0.7, 1.0],
    elevation: [0.1, 0.7],
    density: { water: 1.0 },
  },
];

// Mapa para acceso rápido
const BIOME_MAP = new Map<BiomeType, BiomeConfig>();
BIOME_CONFIGS.forEach(b => BIOME_MAP.set(b.id, b));

/**
 * BiomeResolver - Resuelve bioma a partir de factores ambientales
 */
export class BiomeResolver {
  private walkableBiomes: BiomeConfig[];
  
  constructor() {
    this.walkableBiomes = BIOME_CONFIGS.filter(b => b.isWalkable);
  }
  
  /**
   * Resolver bioma basándose en factores ambientales
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
    // === OCÉANO: Bordes del mundo o depresiones profundas marinas ===
    // Más permisivo: baja continentalidad indica cercanía al mar
    if (continentality < 0.25) {
      // Zona oceánica profunda
      if (elevation < 0.2) {
        return BiomeType.OCEAN;
      }
      // Playa en las costas
      if (elevation < 0.35) {
        return BiomeType.BEACH;
      }
    }
    
    // === LAGO: Depresiones interiores con agua ===
    // Lagos aparecen en zonas bajas con alta humedad LEJOS del océano
    if (elevation < 0.22 && moisture > 0.55 && continentality > 0.5) {
      return BiomeType.LAKE;
    }
    
    // === HUMEDAL/PANTANO: Zonas inundables ===
    if (elevation < 0.32 && moisture > 0.58) {
      // Pantanos en zonas cálidas, humedales en templadas
      return temperature > 0.5 ? BiomeType.SWAMP : BiomeType.WETLAND;
    }
    
    // === MONTAÑA: Alta elevación ===
    if (elevation > 0.7) {
      return BiomeType.MOUNTAIN;
    }
    
    // === PLAYA interior: Zonas bajas cerca del agua ===
    if (continentality < 0.4 && elevation < 0.28 && elevation > 0.15) {
      return BiomeType.BEACH;
    }
    
    // === TUNDRA: Muy frío ===
    if (temperature < 0.25) {
      return BiomeType.TUNDRA;
    }
    
    // === DESIERTO: Caliente y seco ===
    if (temperature > 0.65 && moisture < 0.35) {
      return BiomeType.DESERT;
    }
    
    // === BOSQUE: Templado y húmedo ===
    if (moisture > 0.5 && elevation < 0.65) {
      return BiomeType.FOREST;
    }
    
    // === DEFAULT: Pradera ===
    return BiomeType.GRASSLAND;
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
      temp >= biome.temperature[0] && temp <= biome.temperature[1] &&
      moist >= biome.moisture[0] && moist <= biome.moisture[1] &&
      elev >= biome.elevation[0] && elev <= biome.elevation[1]
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
    
    // Aplicar variación sutil (±10%)
    const r = (baseColor >> 16) & 0xFF;
    const g = (baseColor >> 8) & 0xFF;
    const b = baseColor & 0xFF;
    
    const factor = 1 + variation * 0.1;
    
    const newR = Math.min(255, Math.max(0, Math.floor(r * factor)));
    const newG = Math.min(255, Math.max(0, Math.floor(g * factor)));
    const newB = Math.min(255, Math.max(0, Math.floor(b * factor)));
    
    return (newR << 16) | (newG << 8) | newB;
  }
}
