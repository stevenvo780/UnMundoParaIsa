/**
 * Conflict.ts - Sistema de Procesamiento de Conflictos
 *
 * Gestiona la detección, resolución y consecuencias de conflictos
 * entre comunidades basándose en tensión acumulada.
 */

const WORLD_WIDTH = 512;
const WORLD_HEIGHT = 512;

export interface Conflict {
  id: string;
  community1Id: string;
  community2Id: string;
  epicenterX: number;
  epicenterY: number;
  intensity: number;
  phase: ConflictPhase;
  startTick: number;
  duration: number;
  casualties: { community1: number; community2: number };
  territoryChange: number;
}

export interface ConflictOutcome {
  winnerId: string | null;
  loserId: string | null;
  territoryTransferred: number;
  casualties: number;
  tensionReduction: number;
}

export interface ConflictConfig {
  tensionThreshold: number;
  conflictDuration: number;
  casualtyRate: number;
  territoryChangeRate: number;
  cooldownTicks: number;
  maxActiveConflicts: number;
}

/**
 * Sistema de procesamiento de conflictos entre comunidades
 */
export class ConflictManager {
  private activeConflicts: Map<string, Conflict> = new Map();
  private conflictHistory: Conflict[] = [];
  private cooldowns: Map<string, number> = new Map();
  private config: ConflictConfig;
  private conflictIdCounter = 0;

  constructor(
    _width: number = WORLD_WIDTH,
    _height: number = WORLD_HEIGHT,
    config: Partial<ConflictConfig> = {},
  ) {
    this.config = {
      tensionThreshold: config.tensionThreshold ?? 0.7,
      conflictDuration: config.conflictDuration ?? 100,
      casualtyRate: config.casualtyRate ?? 0.02,
      territoryChangeRate: config.territoryChangeRate ?? 0.1,
      cooldownTicks: config.cooldownTicks ?? 200,
      maxActiveConflicts: config.maxActiveConflicts ?? 5,
    };
  }

  /**
   * Evaluar tensiones y detectar nuevos conflictos
   */
  evaluateTensions(
    tensionData: Array<{
      community1Id: string;
      community2Id: string;
      tension: number;
      borderX: number;
      borderY: number;
    }>,
    tick: number,
  ): Conflict[] {
    const newConflicts: Conflict[] = [];

    for (const data of tensionData) {
      if (data.tension < this.config.tensionThreshold) continue;
      if (
        this.isOnCooldown(data.community1Id) ||
        this.isOnCooldown(data.community2Id)
      )
        continue;
      if (this.hasActiveConflict(data.community1Id, data.community2Id))
        continue;
      if (this.activeConflicts.size >= this.config.maxActiveConflicts) break;

      const conflict = this.createConflict(
        data.community1Id,
        data.community2Id,
        data.borderX,
        data.borderY,
        data.tension,
        tick,
      );

      this.activeConflicts.set(conflict.id, conflict);
      newConflicts.push(conflict);
    }

    return newConflicts;
  }

  /**
   * Crear un nuevo conflicto
   */
  private createConflict(
    community1Id: string,
    community2Id: string,
    epicenterX: number,
    epicenterY: number,
    tension: number,
    tick: number,
  ): Conflict {
    return {
      id: `conflict_${this.conflictIdCounter++}`,
      community1Id,
      community2Id,
      epicenterX,
      epicenterY,
      intensity: tension,
      phase: ConflictPhase.BREWING,
      startTick: tick,
      duration: Math.floor(
        this.config.conflictDuration * (0.5 + tension * 0.5),
      ),
      casualties: { community1: 0, community2: 0 },
      territoryChange: 0,
    };
  }

  /**
   * Actualizar todos los conflictos activos
   */
  update(
    tick: number,
    getCommunityStrength: (communityId: string) => number,
  ): { resolved: ConflictOutcome[]; ongoing: Conflict[] } {
    const resolved: ConflictOutcome[] = [];

    for (const [conflictId, conflict] of this.activeConflicts) {
      const ticksElapsed = tick - conflict.startTick;
      const progress = ticksElapsed / conflict.duration;

      if (progress < 0.1) {
        conflict.phase = ConflictPhase.BREWING;
      } else if (progress < 0.8) {
        conflict.phase = ConflictPhase.ACTIVE;
        this.processActiveCombat(conflict, getCommunityStrength);
      } else if (progress < 1.0) {
        conflict.phase = ConflictPhase.RESOLUTION;
      } else {
        conflict.phase = ConflictPhase.AFTERMATH;
        const outcome = this.resolveConflict(conflict);
        resolved.push(outcome);
        this.conflictHistory.push(conflict);
        this.activeConflicts.delete(conflictId);

        this.setCooldown(conflict.community1Id, this.config.cooldownTicks);
        this.setCooldown(conflict.community2Id, this.config.cooldownTicks);
      }
    }

    this.decrementCooldowns();

    return {
      resolved,
      ongoing: Array.from(this.activeConflicts.values()),
    };
  }

  /**
   * Procesar combate activo
   */
  private processActiveCombat(
    conflict: Conflict,
    getCommunityStrength: (communityId: string) => number,
  ): void {
    const strength1 = getCommunityStrength(conflict.community1Id);
    const strength2 = getCommunityStrength(conflict.community2Id);
    const totalStrength = strength1 + strength2 || 1;

    const casualtyRatio1 =
      (strength2 / totalStrength) *
      this.config.casualtyRate *
      conflict.intensity;
    const casualtyRatio2 =
      (strength1 / totalStrength) *
      this.config.casualtyRate *
      conflict.intensity;

    conflict.casualties.community1 += casualtyRatio1;
    conflict.casualties.community2 += casualtyRatio2;

    const strengthDiff = (strength1 - strength2) / totalStrength;
    conflict.territoryChange +=
      strengthDiff * this.config.territoryChangeRate * conflict.intensity;
  }

  /**
   * Resolver conflicto y determinar resultado
   */
  private resolveConflict(conflict: Conflict): ConflictOutcome {
    const totalCasualties =
      conflict.casualties.community1 + conflict.casualties.community2;

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (conflict.territoryChange > 0.1) {
      winnerId = conflict.community1Id;
      loserId = conflict.community2Id;
    } else if (conflict.territoryChange < -0.1) {
      winnerId = conflict.community2Id;
      loserId = conflict.community1Id;
    }

    return {
      winnerId,
      loserId,
      territoryTransferred: Math.abs(conflict.territoryChange),
      casualties: Math.floor(totalCasualties),
      tensionReduction: 0.3 + conflict.intensity * 0.4,
    };
  }

  /**
   * Verificar si una comunidad está en cooldown
   */
  private isOnCooldown(communityId: string): boolean {
    return (this.cooldowns.get(communityId) ?? 0) > 0;
  }

  /**
   * Establecer cooldown para una comunidad
   */
  private setCooldown(communityId: string, ticks: number): void {
    this.cooldowns.set(communityId, ticks);
  }

  /**
   * Decrementar todos los cooldowns
   */
  private decrementCooldowns(): void {
    for (const [id, cooldown] of this.cooldowns) {
      if (cooldown > 0) {
        this.cooldowns.set(id, cooldown - 1);
      }
    }
  }

  /**
   * Verificar si hay conflicto activo entre dos comunidades
   */
  private hasActiveConflict(
    community1Id: string,
    community2Id: string,
  ): boolean {
    for (const conflict of this.activeConflicts.values()) {
      if (
        (conflict.community1Id === community1Id &&
          conflict.community2Id === community2Id) ||
        (conflict.community1Id === community2Id &&
          conflict.community2Id === community1Id)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Obtener conflictos activos
   */
  getActiveConflicts(): Conflict[] {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Obtener historial de conflictos
   */
  getConflictHistory(limit: number = 10): Conflict[] {
    return this.conflictHistory.slice(-limit);
  }

  /**
   * Obtener zonas de conflicto para visualización
   */
  getConflictZones(): Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    phase: string;
  }> {
    return this.getActiveConflicts().map((conflict) => ({
      x: conflict.epicenterX,
      y: conflict.epicenterY,
      radius: 20 + conflict.intensity * 30,
      intensity: conflict.intensity,
      phase: conflict.phase,
    }));
  }

  /**
   * Estadísticas del sistema
   */
  getStats(): {
    activeConflicts: number;
    totalHistorical: number;
    totalCasualties: number;
    avgIntensity: number;
  } {
    const activeConflicts = this.activeConflicts.size;
    const totalHistorical = this.conflictHistory.length;

    let totalCasualties = 0;
    let totalIntensity = 0;

    for (const conflict of this.conflictHistory) {
      totalCasualties +=
        conflict.casualties.community1 + conflict.casualties.community2;
      totalIntensity += conflict.intensity;
    }

    return {
      activeConflicts,
      totalHistorical,
      totalCasualties: Math.floor(totalCasualties),
      avgIntensity: totalHistorical > 0 ? totalIntensity / totalHistorical : 0,
    };
  }
}
export enum ConflictPhase {
  BREWING = "brewing",
  ACTIVE = "active",
  RESOLUTION = "resolution",
  AFTERMATH = "aftermath",
}
