/**
 * Artifacts - Objetos descubribles que contienen fragmentos de chat
 * Aparecen en el mundo cuando se cumplen condiciones
 */

import { ChatFragment, Emotion } from './ChatParser.js';

export type ArtifactType = 
  | 'letter'       // Carta - fragmento de amor
  | 'photograph'   // Foto - recuerdo visual
  | 'melody'       // Melodía - alegría
  | 'tear'         // Lágrima - melancolía
  | 'star'         // Estrella - asombro
  | 'memory';      // Memoria - nostalgia

export interface Artifact {
  id: number;
  type: ArtifactType;
  x: number;
  y: number;
  fragmentId: string;        // ID del fragmento asociado
  fragment?: ChatFragment;   // Fragmento completo
  discovered: boolean;
  discoveredBy?: number;     // ID de partícula que lo descubrió
  discoveredAt?: number;     // Tick de descubrimiento
  spawnedAt: number;         // Tick de aparición
  lifetime: number;          // Ticks antes de desaparecer si no se descubre
  glowIntensity: number;     // 0-1: brillo visual
}

export interface ArtifactSpawnCondition {
  type: ArtifactType;
  emotion: Emotion;
  minFieldValue: number;     // Valor mínimo de campo semántico
  minPopulation?: number;    // Población mínima cercana
  spawnChance: number;       // Probabilidad de spawn (0-1)
  cooldown: number;          // Ticks entre spawns
}

const SPAWN_CONDITIONS: ArtifactSpawnCondition[] = [
  { type: 'letter', emotion: 'love', minFieldValue: 0.6, spawnChance: 0.1, cooldown: 200 },
  { type: 'photograph', emotion: 'joy', minFieldValue: 0.5, spawnChance: 0.15, cooldown: 150 },
  { type: 'melody', emotion: 'joy', minFieldValue: 0.7, spawnChance: 0.08, cooldown: 250 },
  { type: 'tear', emotion: 'melancholy', minFieldValue: 0.4, spawnChance: 0.12, cooldown: 180 },
  { type: 'star', emotion: 'wonder', minFieldValue: 0.5, spawnChance: 0.1, cooldown: 200 },
  { type: 'memory', emotion: 'nostalgia', minFieldValue: 0.5, spawnChance: 0.1, cooldown: 220 },
];

const ARTIFACT_LIFETIME = 500;  // Ticks antes de desaparecer

/**
 * ArtifactManager - Gestiona artefactos en el mundo
 */
export class ArtifactManager {
  private artifacts: Map<number, Artifact> = new Map();
  private nextId = 1;
  private lastSpawnByType: Map<ArtifactType, number> = new Map();
  private tick = 0;
  
  // Índice espacial
  private spatialIndex: Map<string, number[]> = new Map();
  
  readonly width: number;
  readonly height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Intentar spawn de artefactos basado en campos semánticos
   */
  trySpawn(
    semanticFields: Map<Emotion, Float32Array>,
    populationField: Float32Array,
    getFragment: (emotion: Emotion) => ChatFragment | null
  ): Artifact | null {
    this.tick++;
    
    for (const condition of SPAWN_CONDITIONS) {
      // Verificar cooldown
      const lastSpawn = this.lastSpawnByType.get(condition.type) || 0;
      if (this.tick - lastSpawn < condition.cooldown) continue;
      
      // Buscar posición válida
      const emotionField = semanticFields.get(condition.emotion);
      if (!emotionField) continue;
      
      const position = this.findValidPosition(
        emotionField, 
        populationField,
        condition.minFieldValue,
        condition.minPopulation || 0
      );
      
      if (!position) continue;
      
      // Probabilidad de spawn
      if (Math.random() > condition.spawnChance) continue;
      
      // Obtener fragmento
      const fragment = getFragment(condition.emotion);
      if (!fragment) continue;
      
      // Crear artefacto
      const artifact = this.create(
        condition.type,
        position.x,
        position.y,
        fragment
      );
      
      this.lastSpawnByType.set(condition.type, this.tick);
      
      return artifact;
    }
    
    return null;
  }
  
  /**
   * Encontrar posición válida para spawn
   */
  private findValidPosition(
    emotionField: Float32Array,
    populationField: Float32Array,
    minValue: number,
    minPopulation: number
  ): { x: number; y: number } | null {
    // Buscar celdas que cumplen condiciones
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    
    for (let y = 5; y < this.height - 5; y += 5) {
      for (let x = 5; x < this.width - 5; x += 5) {
        const i = y * this.width + x;
        const emotionValue = emotionField[i];
        const pop = populationField[i];
        
        if (emotionValue < minValue) continue;
        if (pop < minPopulation) continue;
        
        // Verificar que no hay artefacto cercano
        if (this.hasNearbyArtifact(x, y, 10)) continue;
        
        candidates.push({
          x,
          y,
          score: emotionValue * (1 + pop * 0.1),
        });
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Seleccionar por score con algo de aleatoriedad
    candidates.sort((a, b) => b.score - a.score);
    const idx = Math.floor(Math.random() * Math.min(5, candidates.length));
    
    return candidates[idx];
  }
  
  /**
   * Verificar si hay artefacto cercano
   */
  private hasNearbyArtifact(x: number, y: number, radius: number): boolean {
    for (const artifact of this.artifacts.values()) {
      const dx = artifact.x - x;
      const dy = artifact.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Crear artefacto
   */
  create(
    type: ArtifactType,
    x: number,
    y: number,
    fragment: ChatFragment
  ): Artifact {
    const artifact: Artifact = {
      id: this.nextId++,
      type,
      x,
      y,
      fragmentId: fragment.id,
      fragment,
      discovered: false,
      spawnedAt: this.tick,
      lifetime: ARTIFACT_LIFETIME,
      glowIntensity: 0.5 + fragment.intensity * 0.5,
    };
    
    this.artifacts.set(artifact.id, artifact);
    this.updateSpatialIndex(artifact);
    
    return artifact;
  }
  
  /**
   * Actualizar índice espacial
   */
  private updateSpatialIndex(artifact: Artifact): void {
    const key = `${artifact.x},${artifact.y}`;
    const ids = this.spatialIndex.get(key) || [];
    if (!ids.includes(artifact.id)) {
      ids.push(artifact.id);
      this.spatialIndex.set(key, ids);
    }
  }
  
  /**
   * Obtener artefactos en posición
   */
  getAt(x: number, y: number, radius: number = 3): Artifact[] {
    const result: Artifact[] = [];
    
    for (const artifact of this.artifacts.values()) {
      if (artifact.discovered) continue;
      
      const dx = artifact.x - x;
      const dy = artifact.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        result.push(artifact);
      }
    }
    
    return result;
  }
  
  /**
   * Descubrir artefacto
   */
  discover(artifactId: number, particleId: number): Artifact | null {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact || artifact.discovered) return null;
    
    artifact.discovered = true;
    artifact.discoveredBy = particleId;
    artifact.discoveredAt = this.tick;
    
    return artifact;
  }
  
  /**
   * Actualizar artefactos (eliminar expirados)
   */
  update(): number {
    this.tick++;
    let removed = 0;
    
    for (const [id, artifact] of this.artifacts) {
      if (artifact.discovered) continue;
      
      // Verificar lifetime
      const age = this.tick - artifact.spawnedAt;
      if (age > artifact.lifetime) {
        this.remove(id);
        removed++;
      }
      
      // Actualizar glow (pulsar)
      artifact.glowIntensity = 0.5 + 0.3 * Math.sin(this.tick * 0.05);
    }
    
    return removed;
  }
  
  /**
   * Eliminar artefacto
   */
  private remove(id: number): void {
    const artifact = this.artifacts.get(id);
    if (!artifact) return;
    
    // Limpiar índice espacial
    const key = `${artifact.x},${artifact.y}`;
    const ids = this.spatialIndex.get(key);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx !== -1) ids.splice(idx, 1);
      if (ids.length === 0) this.spatialIndex.delete(key);
    }
    
    this.artifacts.delete(id);
  }
  
  /**
   * Obtener todos los artefactos activos
   */
  getAll(): Artifact[] {
    return Array.from(this.artifacts.values());
  }
  
  /**
   * Obtener artefactos descubiertos
   */
  getDiscovered(): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.discovered);
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): ArtifactStats {
    const byType: Record<ArtifactType, number> = {
      letter: 0, photograph: 0, melody: 0, tear: 0, star: 0, memory: 0,
    };
    
    let discovered = 0;
    for (const artifact of this.artifacts.values()) {
      byType[artifact.type]++;
      if (artifact.discovered) discovered++;
    }
    
    return {
      total: this.artifacts.size,
      discovered,
      active: this.artifacts.size - discovered,
      byType,
    };
  }
  
  /**
   * Serializar para persistencia
   */
  serialize(): Artifact[] {
    return Array.from(this.artifacts.values());
  }
  
  /**
   * Cargar desde datos
   */
  load(data: Artifact[]): void {
    this.artifacts.clear();
    this.spatialIndex.clear();
    
    for (const artifact of data) {
      this.artifacts.set(artifact.id, artifact);
      this.updateSpatialIndex(artifact);
      
      if (artifact.id >= this.nextId) {
        this.nextId = artifact.id + 1;
      }
    }
  }
}

export interface ArtifactStats {
  total: number;
  discovered: number;
  active: number;
  byType: Record<ArtifactType, number>;
}
