/**
 * Communities - Detección de comunidades/clusters
 * Una comunidad es un grupo de celdas con alta población y firma similar
 */

import { Particle } from '../types.js';
import { getSignature, averageSignature, seedSimilarity } from './Signatures.js';

export interface Community {
  id: number;
  centerX: number;
  centerY: number;
  radius: number;
  population: number;
  dominantSignature: [number, number, number, number];
  members: number[];  // IDs de partículas
  founded: number;    // Tick de fundación
  age: number;        // Ticks de existencia
}

export interface CommunityConfig {
  minPopulation: number;        // Población mínima para formar comunidad
  mergeDistance: number;        // Distancia para fusionar comunidades
  signatureSimilarityThreshold: number;  // Similitud mínima de firma
  decayRate: number;            // Tasa de decay de comunidades
}

const DEFAULT_COMMUNITY_CONFIG: CommunityConfig = {
  minPopulation: 5,
  mergeDistance: 20,
  signatureSimilarityThreshold: 0.6,
  decayRate: 0.01,
};

/**
 * CommunityDetector - Detecta y gestiona comunidades
 */
export class CommunityDetector {
  readonly config: CommunityConfig;
  
  private communities: Map<number, Community> = new Map();
  private nextId = 1;
  private tick = 0;
  
  // Índice espacial: "x,y" -> community id
  private spatialIndex: Map<string, number> = new Map();
  
  constructor(config?: Partial<CommunityConfig>) {
    this.config = { ...DEFAULT_COMMUNITY_CONFIG, ...config };
  }
  
  /**
   * Detectar comunidades desde partículas y campo de población
   */
  detect(
    particles: Particle[],
    populationField: Float32Array,
    width: number,
    height: number
  ): void {
    this.tick++;
    
    // 1. Encontrar celdas con alta población (peaks)
    const peaks = this.findDensityPeaks(populationField, width, height);
    
    // 2. Para cada peak, formar o actualizar comunidad
    const assignedParticles = new Set<number>();
    
    for (const peak of peaks) {
      // Encontrar partículas cercanas al peak
      const nearby = particles.filter(p => {
        if (!p.alive || assignedParticles.has(p.id)) return false;
        const dx = p.x - peak.x;
        const dy = p.y - peak.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.config.mergeDistance;
      });
      
      if (nearby.length < this.config.minPopulation) continue;
      
      // Verificar si hay comunidad existente cerca
      const existingId = this.findNearestCommunity(peak.x, peak.y);
      
      if (existingId !== null) {
        // Actualizar comunidad existente
        this.updateCommunity(existingId, nearby, peak);
      } else {
        // Crear nueva comunidad
        this.createCommunity(nearby, peak);
      }
      
      // Marcar partículas como asignadas
      for (const p of nearby) {
        assignedParticles.add(p.id);
      }
    }
    
    // 3. Decay de comunidades no actualizadas
    this.decayCommunities();
    
    // 4. Fusionar comunidades cercanas con firmas similares
    this.mergeSimilarCommunities();
  }
  
  /**
   * Encontrar peaks de densidad (máximos locales)
   */
  private findDensityPeaks(
    field: Float32Array, 
    width: number, 
    height: number
  ): Array<{ x: number; y: number; density: number }> {
    const peaks: Array<{ x: number; y: number; density: number }> = [];
    const minDensity = this.config.minPopulation * 0.5;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const v = field[i];
        
        if (v < minDensity) continue;
        
        // Verificar si es máximo local (8 vecinos)
        let isMax = true;
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1 && isMax; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (field[(y + dy) * width + (x + dx)] > v) {
              isMax = false;
            }
          }
        }
        
        if (isMax) {
          peaks.push({ x, y, density: v });
        }
      }
    }
    
    // Ordenar por densidad descendente
    peaks.sort((a, b) => b.density - a.density);
    
    return peaks;
  }
  
  /**
   * Encontrar comunidad más cercana
   */
  private findNearestCommunity(x: number, y: number): number | null {
    let nearest: number | null = null;
    let minDist = this.config.mergeDistance;
    
    for (const community of this.communities.values()) {
      const dx = community.centerX - x;
      const dy = community.centerY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist) {
        minDist = dist;
        nearest = community.id;
      }
    }
    
    return nearest;
  }
  
  /**
   * Crear nueva comunidad
   */
  private createCommunity(
    particles: Particle[], 
    center: { x: number; y: number }
  ): Community {
    const signature = averageSignature(particles);
    
    // Calcular radio
    let maxDist = 0;
    for (const p of particles) {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
    
    const community: Community = {
      id: this.nextId++,
      centerX: center.x,
      centerY: center.y,
      radius: maxDist + 5,
      population: particles.length,
      dominantSignature: signature,
      members: particles.map(p => p.id),
      founded: this.tick,
      age: 0,
    };
    
    this.communities.set(community.id, community);
    this.updateSpatialIndex(community);
    
    return community;
  }
  
  /**
   * Actualizar comunidad existente
   */
  private updateCommunity(
    id: number, 
    particles: Particle[],
    center: { x: number; y: number }
  ): void {
    const community = this.communities.get(id);
    if (!community) return;
    
    // Actualizar centro (media móvil)
    community.centerX = community.centerX * 0.8 + center.x * 0.2;
    community.centerY = community.centerY * 0.8 + center.y * 0.2;
    
    // Actualizar población
    community.population = particles.length;
    community.members = particles.map(p => p.id);
    
    // Actualizar firma (media móvil)
    const newSig = averageSignature(particles);
    for (let c = 0; c < 4; c++) {
      community.dominantSignature[c] = 
        community.dominantSignature[c] * 0.9 + newSig[c] * 0.1;
    }
    
    // Actualizar radio
    let maxDist = 0;
    for (const p of particles) {
      const dx = p.x - community.centerX;
      const dy = p.y - community.centerY;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
    community.radius = community.radius * 0.9 + (maxDist + 5) * 0.1;
    
    community.age = this.tick - community.founded;
    
    this.updateSpatialIndex(community);
  }
  
  /**
   * Actualizar índice espacial
   */
  private updateSpatialIndex(community: Community): void {
    // Limpiar entradas antiguas
    for (const [key, id] of this.spatialIndex.entries()) {
      if (id === community.id) {
        this.spatialIndex.delete(key);
      }
    }
    
    // Añadir nuevas
    const r = Math.ceil(community.radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const key = `${Math.round(community.centerX + dx)},${Math.round(community.centerY + dy)}`;
        this.spatialIndex.set(key, community.id);
      }
    }
  }
  
  /**
   * Decay de comunidades
   */
  private decayCommunities(): void {
    const toRemove: number[] = [];
    
    for (const community of this.communities.values()) {
      community.population *= (1 - this.config.decayRate);
      
      if (community.population < this.config.minPopulation * 0.5) {
        toRemove.push(community.id);
      }
    }
    
    for (const id of toRemove) {
      this.removeCommunity(id);
    }
  }
  
  /**
   * Fusionar comunidades similares
   */
  private mergeSimilarCommunities(): void {
    const communities = Array.from(this.communities.values());
    const merged = new Set<number>();
    
    for (let i = 0; i < communities.length; i++) {
      if (merged.has(communities[i].id)) continue;
      
      for (let j = i + 1; j < communities.length; j++) {
        if (merged.has(communities[j].id)) continue;
        
        const c1 = communities[i];
        const c2 = communities[j];
        
        // Verificar distancia
        const dx = c1.centerX - c2.centerX;
        const dy = c1.centerY - c2.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > this.config.mergeDistance) continue;
        
        // Verificar similitud de firma
        let similarity = 0;
        for (let c = 0; c < 4; c++) {
          similarity += 1 - Math.abs(c1.dominantSignature[c] - c2.dominantSignature[c]);
        }
        similarity /= 4;
        
        if (similarity >= this.config.signatureSimilarityThreshold) {
          // Fusionar c2 en c1
          c1.population += c2.population;
          c1.members = [...c1.members, ...c2.members];
          c1.centerX = (c1.centerX + c2.centerX) / 2;
          c1.centerY = (c1.centerY + c2.centerY) / 2;
          c1.radius = Math.max(c1.radius, c2.radius, dist / 2);
          
          merged.add(c2.id);
          this.removeCommunity(c2.id);
        }
      }
    }
  }
  
  /**
   * Eliminar comunidad
   */
  private removeCommunity(id: number): void {
    // Limpiar índice espacial
    for (const [key, cid] of this.spatialIndex.entries()) {
      if (cid === id) {
        this.spatialIndex.delete(key);
      }
    }
    
    this.communities.delete(id);
  }
  
  /**
   * Obtener comunidad en posición
   */
  getCommunityAt(x: number, y: number): Community | null {
    const id = this.spatialIndex.get(`${x},${y}`);
    return id ? this.communities.get(id) || null : null;
  }
  
  /**
   * Obtener todas las comunidades
   */
  getAll(): Community[] {
    return Array.from(this.communities.values());
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): CommunityStats {
    const communities = this.getAll();
    
    return {
      count: communities.length,
      totalPopulation: communities.reduce((sum, c) => sum + c.population, 0),
      avgAge: communities.length > 0 
        ? communities.reduce((sum, c) => sum + c.age, 0) / communities.length 
        : 0,
      largest: communities.reduce((max, c) => 
        c.population > (max?.population || 0) ? c : max, 
        null as Community | null
      ),
    };
  }
}

export interface CommunityStats {
  count: number;
  totalPopulation: number;
  avgAge: number;
  largest: Community | null;
}
