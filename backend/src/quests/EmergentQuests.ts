/**
 * EmergentQuests - Sistema de misiones emergentes
 * Las misiones emergen de eventos narrativos y condiciones del mundo
 * NO son pre-programadas, se generan dinámicamente
 */

import { NarrativeEvent, EventType } from "../narrative/Events";
import { Particle } from "../types";

export enum QuestType {
  PROTECT_COMMUNITY = "protect_community",
  DISCOVER_ARTIFACT = "discover_artifact",
  RESTORE_BALANCE = "restore_balance",
  WITNESS_BIRTH = "witness_birth",
  HEAL_CONFLICT = "heal_conflict",
  EXPLORE_UNKNOWN = "explore_unknown",
  NURTURE_GROWTH = "nurture_growth",
  WITNESS_ELDER = "witness_elder",
  OBSERVE_MIGRATION = "observe_migration",
  DISCOVER_LOVE = "discover_love",
}

export enum QuestStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  EXPIRED = "expired",
}

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  triggerEvent?: NarrativeEvent;

  targetX: number;
  targetY: number;
  radius: number;

  condition: QuestCondition;
  progress: number;

  createdAt: number;
  expiresAt: number;
  completedAt?: number;

  status: QuestStatus;

  reward: QuestReward;
}

export enum QuestConditionType {
  POPULATION = "population",
  RESOURCE = "resource",
  TIME = "time",
  DISCOVERY = "discovery",
  TENSION = "tension",
  SURVIVAL = "survival",
}

export enum QuestComparison {
  GTE = "gte",
  LTE = "lte",
  EQ = "eq",
  WITHIN = "within",
}

export enum QuestRewardType {
  ARTIFACT_SPAWN = "artifact_spawn",
  DIALOG_UNLOCK = "dialog_unlock",
  AREA_REVEAL = "area_reveal",
  BLESSING = "blessing",
}

export interface QuestCondition {
  type: QuestConditionType;
  target: number;
  current: number;
  comparison: QuestComparison;
}

export interface QuestReward {
  type: QuestRewardType;
  value: string;
  description: string;
}

const QUEST_GENERATORS: Record<
  EventType,
  (event: NarrativeEvent, tick: number) => Quest | null
> = {
  [EventType.ARTIFACT_DISCOVERED]: () => null,

  [EventType.COMMUNITY_FORMED]: (event, tick) => ({
    id: `quest_${tick}_community_${event.id}`,
    type: QuestType.PROTECT_COMMUNITY,
    title: "Proteger la Nueva Comunidad",
    description: `Una comunidad ha emergido. Ayúdala a sobrevivir sus primeros 500 ticks.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 30,
    condition: {
      type: QuestConditionType.SURVIVAL,
      target: 500,
      current: 0,
      comparison: QuestComparison.GTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 1000,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.BLESSING,
      value: "community_prosperity",
      description: "La comunidad florece con mayor energía",
    },
  }),

  [EventType.COMMUNITY_EXTINCT]: (event, tick) => ({
    id: `quest_${tick}_restore_${event.id}`,
    type: QuestType.RESTORE_BALANCE,
    title: "Restaurar el Equilibrio",
    description: `Una comunidad ha desaparecido. Restaura los recursos del área.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 25,
    condition: {
      type: QuestConditionType.RESOURCE,
      target: 0.5,
      current: 0,
      comparison: QuestComparison.GTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 800,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.ARTIFACT_SPAWN,
      value: "memory",
      description: "Una memoria de los caídos aparece",
    },
  }),

  [EventType.FIRST_BIRTH]: (event, tick) => ({
    id: `quest_${tick}_nurture_${event.id}`,
    type: QuestType.NURTURE_GROWTH,
    title: "Nutrir la Nueva Vida",
    description: `El primer nacimiento en esta área. Ayuda a la población a crecer a 10.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 20,
    condition: {
      type: QuestConditionType.POPULATION,
      target: 10,
      current: 1,
      comparison: QuestComparison.GTE,
    },
    progress: 0.1,
    createdAt: tick,
    expiresAt: tick + 1500,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.DIALOG_UNLOCK,
      value: "birth_celebration",
      description: "Un diálogo de celebración se desbloquea",
    },
  }),

  [EventType.MASS_BIRTH]: () => null,

  [EventType.MASS_DEATH]: (event, tick) => ({
    id: `quest_${tick}_heal_${event.id}`,
    type: QuestType.HEAL_CONFLICT,
    title: "Sanar las Heridas",
    description: `Muchas muertes han ocurrido. Reduce la tensión del área.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 35,
    condition: {
      type: QuestConditionType.TENSION,
      target: 0.3,
      current: 1.0,
      comparison: QuestComparison.LTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 600,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.ARTIFACT_SPAWN,
      value: "tear",
      description: "Una lágrima de los perdidos aparece",
    },
  }),

  [EventType.CONFLICT_STARTED]: (event, tick) => ({
    id: `quest_${tick}_peace_${event.id}`,
    type: QuestType.HEAL_CONFLICT,
    title: "Restaurar la Paz",
    description: `Un conflicto ha comenzado. Reduce la tensión antes de más muertes.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 25,
    condition: {
      type: QuestConditionType.TENSION,
      target: 0.4,
      current: 0.8,
      comparison: QuestComparison.LTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 400,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.BLESSING,
      value: "peace_aura",
      description: "Un aura de paz se extiende",
    },
  }),

  [EventType.PEACE_RESTORED]: () => null,

  [EventType.MIGRATION]: (event, tick) => ({
    id: `quest_${tick}_observe_${event.id}`,
    type: QuestType.OBSERVE_MIGRATION,
    title: "Observar la Gran Migración",
    description: `Una migración masiva está ocurriendo. Observa su destino.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 40,
    condition: {
      type: QuestConditionType.TIME,
      target: 200,
      current: 0,
      comparison: QuestComparison.GTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 300,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.AREA_REVEAL,
      value: "migration_path",
      description: "Se revela una ruta de migración",
    },
  }),

  [EventType.DISCOVERY]: (event, tick) => ({
    id: `quest_${tick}_explore_${event.id}`,
    type: QuestType.EXPLORE_UNKNOWN,
    title: "Explorar lo Desconocido",
    description: `Una nueva zona ha sido descubierta. Explórala completamente.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 50,
    condition: {
      type: QuestConditionType.DISCOVERY,
      target: 100,
      current: 10,
      comparison: QuestComparison.GTE,
    },
    progress: 0.1,
    createdAt: tick,
    expiresAt: tick + 2000,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.ARTIFACT_SPAWN,
      value: "star",
      description: "Una estrella de descubrimiento aparece",
    },
  }),

  [EventType.LOVE_PAIR]: (event, tick) => ({
    id: `quest_${tick}_love_${event.id}`,
    type: QuestType.DISCOVER_LOVE,
    title: "Testigo del Amor",
    description: `Dos almas similares se han encontrado. Ayúdalas a prosperar.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 15,
    condition: {
      type: QuestConditionType.SURVIVAL,
      target: 300,
      current: 0,
      comparison: QuestComparison.GTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 500,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.ARTIFACT_SPAWN,
      value: "letter",
      description: "Una carta de amor aparece",
    },
  }),

  [EventType.ELDER]: (event, tick) => ({
    id: `quest_${tick}_elder_${event.id}`,
    type: QuestType.WITNESS_ELDER,
    title: "Sabiduría del Anciano",
    description: `Una partícula longeva ha sido encontrada. Aprende de su sabiduría.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 10,
    condition: {
      type: QuestConditionType.TIME,
      target: 100,
      current: 0,
      comparison: QuestComparison.GTE,
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 200,
    status: QuestStatus.ACTIVE,
    reward: {
      type: QuestRewardType.DIALOG_UNLOCK,
      value: "elder_wisdom",
      description: "Se desbloquea la sabiduría del anciano",
    },
  }),

  [EventType.HERO_BORN]: () => null,
};

export interface QuestManagerConfig {
  maxActiveQuests: number;
  minDistanceBetweenQuests: number;
  defaultExpiration: number;
}

const DEFAULT_CONFIG: QuestManagerConfig = {
  maxActiveQuests: 5,
  minDistanceBetweenQuests: 50,
  defaultExpiration: 1000,
};

export class QuestManager {
  private quests: Map<string, Quest> = new Map();
  private completedQuests: Quest[] = [];
  private config: QuestManagerConfig;
  private tick = 0;

  constructor(config: Partial<QuestManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Procesar evento narrativo y generar quest si aplica
   */
  processEvent(event: NarrativeEvent, tick: number): Quest | null {
    this.tick = tick;

    if (this.getActiveQuests().length >= this.config.maxActiveQuests) {
      return null;
    }

    for (const quest of this.quests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) continue;
      const dx = event.x - quest.targetX;
      const dy = event.y - quest.targetY;
      if (Math.sqrt(dx * dx + dy * dy) < this.config.minDistanceBetweenQuests) {
        return null;
      }
    }

    const generator = QUEST_GENERATORS[event.type];
    if (!generator) return null;

    const quest = generator(event, tick);
    if (quest) {
      this.quests.set(quest.id, quest);
    }

    return quest;
  }

  /**
   * Actualizar estado de quests
   */
  update(
    tick: number,
    particles: Particle[],
    tensionField: Float32Array,
    width: number,
  ): void {
    this.tick = tick;

    for (const quest of this.quests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) continue;

      if (tick >= quest.expiresAt) {
        quest.status = QuestStatus.EXPIRED;
        continue;
      }

      this.updateQuestProgress(quest, particles, tensionField, width);

      if (this.isConditionMet(quest.condition)) {
        quest.status = QuestStatus.COMPLETED;
        quest.completedAt = tick;
        quest.progress = 1;
        this.completedQuests.push(quest);
      }
    }

    for (const [id, quest] of this.quests) {
      if (
        quest.status === QuestStatus.EXPIRED ||
        quest.status === QuestStatus.COMPLETED
      ) {
        if (tick - (quest.completedAt || quest.expiresAt) > 200) {
          this.quests.delete(id);
        }
      }
    }
  }

  private updateQuestProgress(
    quest: Quest,
    particles: Particle[],
    tensionField: Float32Array,
    width: number,
  ): void {
    const { targetX, targetY, radius, condition } = quest;

    const nearbyParticles = particles.filter((p) => {
      if (!p.alive) return false;
      const dx = p.x - targetX;
      const dy = p.y - targetY;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });

    switch (condition.type) {
      case QuestConditionType.POPULATION:
        condition.current = nearbyParticles.length;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case QuestConditionType.SURVIVAL:
        condition.current++;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case QuestConditionType.TIME:
        condition.current = this.tick - quest.createdAt;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case QuestConditionType.TENSION: {
        let totalTension = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = targetX + dx;
            const y = targetY + dy;
            if (x >= 0 && x < width && y >= 0 && y < width) {
              totalTension += tensionField[y * width + x] || 0;
              count++;
            }
          }
        }
        condition.current = count > 0 ? totalTension / count : 0;

        quest.progress = Math.min(
          1,
          (1 - condition.current) / (1 - condition.target),
        );
        break;
      }

      case QuestConditionType.DISCOVERY:
        condition.current = nearbyParticles.length * 10;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case QuestConditionType.RESOURCE:
        condition.current = nearbyParticles.length > 0 ? 0.5 : 0;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;
    }
  }

  private isConditionMet(condition: QuestCondition): boolean {
    switch (condition.comparison) {
      case QuestComparison.GTE:
        return condition.current >= condition.target;
      case QuestComparison.LTE:
        return condition.current <= condition.target;
      case QuestComparison.EQ:
        return Math.abs(condition.current - condition.target) < 0.01;
      case QuestComparison.WITHIN:
        return (
          Math.abs(condition.current - condition.target) <
          condition.target * 0.1
        );
      default:
        return false;
    }
  }

  getActiveQuests(): Quest[] {
    return Array.from(this.quests.values()).filter(
      (q) => q.status === QuestStatus.ACTIVE,
    );
  }

  getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
  }

  /**
   * Encontrar la misión activa más cercana
   */
  getNearestActiveQuest(x: number, y: number): Quest | null {
    let nearest: Quest | null = null;
    let minDistSq = Infinity;

    for (const quest of this.quests.values()) {
      if (quest.status !== QuestStatus.ACTIVE) continue;

      const distSq = (quest.targetX - x) ** 2 + (quest.targetY - y) ** 2;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = quest;
      }
    }
    return nearest;
  }

  getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  getCompletedQuests(): Quest[] {
    return this.completedQuests;
  }

  getQuestStats(): {
    active: number;
    completed: number;
    failed: number;
    expired: number;
  } {
    const all = Array.from(this.quests.values());
    return {
      active: all.filter((q) => q.status === QuestStatus.ACTIVE).length,
      completed: this.completedQuests.length,
      failed: all.filter((q) => q.status === QuestStatus.FAILED).length,
      expired: all.filter((q) => q.status === QuestStatus.EXPIRED).length,
    };
  }
}
