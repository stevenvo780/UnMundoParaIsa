/**
 * Tension - Sistema de tensión social
 * R7: tension = entropy(signatures) × population / (resources + ε)
 * Alta tensión causa conflicto, migración, muertes
 */

import { SignatureField, signatureEntropy } from './Signatures.js';
import { Community } from './Communities.js';

export interface TensionConfig {
  entropyWeight: number;      // Peso de diversidad de firmas
  densityWeight: number;      // Peso de densidad poblacional
  scarcityWeight: number;     // Peso de escasez de recursos
  conflictThreshold: number;  // Umbral para iniciar conflicto
  dangerIncrease: number;     // Incremento de danger por conflicto
  dispersalRadius: number;    // Radio de dispersión en conflicto
  mortalityRate: number;      // Probabilidad de muerte en conflicto
}

const DEFAULT_TENSION_CONFIG: TensionConfig = {
  entropyWeight: 1.0,
  densityWeight: 0.5,
  scarcityWeight: 1.5,
  conflictThreshold: 0.7,
  dangerIncrease: 0.3,
  dispersalRadius: 10,
  mortalityRate: 0.1,
};

export interface TensionResult {
  x: number;
  y: number;
  tension: number;
  isConflict: boolean;
  entropy: number;
  density: number;
  scarcity: number;
}

export interface ConflictEvent {
  x: number;
  y: number;
  tick: number;
  tension: number;
  casualties: number;
  dispersed: number;
}

/**
 * TensionField - Campo de tensión social
 */
export class TensionField {
  readonly width: number;
  readonly height: number;
  readonly config: TensionConfig;
  
  private tension: Float32Array;
  private lastConflicts: ConflictEvent[] = [];
  
  constructor(width: number, height: number, config?: Partial<TensionConfig>) {
    this.width = width;
    this.height = height;
    this.config = { ...DEFAULT_TENSION_CONFIG, ...config };
    
    this.tension = new Float32Array(width * height);
  }
  
  /**
   * Calcular tensión para todo el campo
   */
  calculate(
    signatureField: SignatureField,
    populationField: Float32Array,
    resourceFields: { food: Float32Array; water: Float32Array }
  ): void {
    const { width, height } = this;
    const { entropyWeight, densityWeight, scarcityWeight } = this.config;
    const epsilon = 0.001;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        
        const population = populationField[i];
        if (population < 2) {
          this.tension[i] = 0;
          continue;
        }
        
        // Entropía de firmas (diversidad)
        const entropy = signatureField.getEntropyInRegion(x, y, 3);
        
        // Densidad (población normalizada)
        const density = Math.min(1, population / 20);
        
        // Escasez (inverso de recursos disponibles)
        const totalResources = resourceFields.food[i] + resourceFields.water[i];
        const scarcity = 1 / (totalResources + epsilon);
        const normalizedScarcity = Math.min(1, scarcity);
        
        // Fórmula de tensión
        const tension = 
          entropyWeight * entropy * density +
          densityWeight * density +
          scarcityWeight * normalizedScarcity * density;
        
        // Normalizar a 0-1
        this.tension[i] = Math.min(1, tension / (entropyWeight + densityWeight + scarcityWeight));
      }
    }
  }
  
  /**
   * Obtener tensión en posición
   */
  get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.tension[y * this.width + x];
  }
  
  /**
   * Detectar zonas de conflicto
   */
  detectConflicts(tick: number): ConflictEvent[] {
    const conflicts: ConflictEvent[] = [];
    const { conflictThreshold } = this.config;
    
    // Buscar máximos locales por encima del umbral
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const t = this.get(x, y);
        
        if (t < conflictThreshold) continue;
        
        // Verificar si es máximo local
        let isMax = true;
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1 && isMax; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (this.get(x + dx, y + dy) > t) {
              isMax = false;
            }
          }
        }
        
        if (isMax) {
          conflicts.push({
            x,
            y,
            tick,
            tension: t,
            casualties: 0,
            dispersed: 0,
          });
        }
      }
    }
    
    this.lastConflicts = conflicts;
    return conflicts;
  }
  
  /**
   * Obtener conflictos recientes
   */
  getRecentConflicts(): ConflictEvent[] {
    return this.lastConflicts;
  }
  
  /**
   * Obtener buffer de tensión
   */
  getBuffer(): Float32Array {
    return this.tension;
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): TensionStats {
    let sum = 0;
    let max = 0;
    let highTensionCells = 0;
    const { conflictThreshold } = this.config;
    
    for (let i = 0; i < this.tension.length; i++) {
      const t = this.tension[i];
      sum += t;
      if (t > max) max = t;
      if (t >= conflictThreshold) highTensionCells++;
    }
    
    return {
      average: sum / this.tension.length,
      max,
      highTensionCells,
      conflictZones: this.lastConflicts.length,
    };
  }
}

export interface TensionStats {
  average: number;
  max: number;
  highTensionCells: number;
  conflictZones: number;
}

/**
 * ConflictProcessor - Procesa efectos de conflictos
 */
export class ConflictProcessor {
  readonly config: TensionConfig;
  
  constructor(config?: Partial<TensionConfig>) {
    this.config = { ...DEFAULT_TENSION_CONFIG, ...config };
  }
  
  /**
   * Procesar conflicto y retornar efectos
   */
  process(
    conflict: ConflictEvent,
    dangerField: Float32Array,
    width: number,
    height: number
  ): ConflictEffects {
    const { dangerIncrease, dispersalRadius } = this.config;
    const effects: ConflictEffects = {
      dangerCells: [],
      dispersalVectors: [],
    };
    
    // Aumentar danger en zona de conflicto
    for (let dy = -dispersalRadius; dy <= dispersalRadius; dy++) {
      for (let dx = -dispersalRadius; dx <= dispersalRadius; dx++) {
        const x = conflict.x + dx;
        const y = conflict.y + dy;
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > dispersalRadius) continue;
        
        const factor = 1 - dist / dispersalRadius;
        const increase = dangerIncrease * factor * conflict.tension;
        
        const i = y * width + x;
        dangerField[i] = Math.min(1, dangerField[i] + increase);
        
        effects.dangerCells.push({ x, y, increase });
        
        // Vector de dispersión (alejarse del centro)
        if (dist > 0) {
          effects.dispersalVectors.push({
            x,
            y,
            dx: dx / dist,
            dy: dy / dist,
            strength: factor,
          });
        }
      }
    }
    
    return effects;
  }
  
  /**
   * Determinar si una partícula muere en conflicto
   */
  shouldDie(tension: number): boolean {
    const { mortalityRate } = this.config;
    return Math.random() < mortalityRate * tension;
  }
  
  /**
   * Calcular vector de huida para partícula
   */
  getFleeVector(
    x: number, 
    y: number, 
    conflicts: ConflictEvent[]
  ): { dx: number; dy: number } {
    let totalDx = 0;
    let totalDy = 0;
    let weight = 0;
    
    for (const conflict of conflicts) {
      const dx = x - conflict.x;
      const dy = y - conflict.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 1) continue;
      
      const w = conflict.tension / dist;
      totalDx += (dx / dist) * w;
      totalDy += (dy / dist) * w;
      weight += w;
    }
    
    if (weight === 0) {
      return { dx: 0, dy: 0 };
    }
    
    return {
      dx: totalDx / weight,
      dy: totalDy / weight,
    };
  }
}

export interface ConflictEffects {
  dangerCells: Array<{ x: number; y: number; increase: number }>;
  dispersalVectors: Array<{ x: number; y: number; dx: number; dy: number; strength: number }>;
}
