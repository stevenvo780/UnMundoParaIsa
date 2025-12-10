/**
 * EmergentQuests - Sistema de misiones emergentes
 * Las misiones emergen de eventos narrativos y condiciones del mundo
 * NO son pre-programadas, se generan dinámicamente
 */

import { NarrativeEvent, EventType } from "../narrative/Events.js";
import { Particle } from "../types.js";

export type QuestType =
  | "protect_community"
  | "discover_artifact"
  | "restore_balance"
  | "witness_birth"
  | "heal_conflict"
  | "explore_unknown"
  | "nurture_growth"
  | "witness_elder"
  | "observe_migration"
  | "discover_love";

export type QuestStatus = "active" | "completed" | "failed" | "expired";

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

export interface QuestCondition {
  type:
    | "population"
    | "resource"
    | "time"
    | "discovery"
    | "tension"
    | "survival";
  target: number;
  current: number;
  comparison: "gte" | "lte" | "eq" | "within";
}

export interface QuestReward {
  type: "artifact_spawn" | "dialog_unlock" | "area_reveal" | "blessing";
  value: string;
  description: string;
}

const QUEST_GENERATORS: Record<
  EventType,
  (event: NarrativeEvent, tick: number) => Quest | null
> = {
  artifact_discovered: () => null,

  community_formed: (event, tick) => ({
    id: `quest_${tick}_community_${event.id}`,
    type: "protect_community",
    title: "Proteger la Nueva Comunidad",
    description: `Una comunidad ha emergido. Ayúdala a sobrevivir sus primeros 500 ticks.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 30,
    condition: {
      type: "survival",
      target: 500,
      current: 0,
      comparison: "gte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 1000,
    status: "active",
    reward: {
      type: "blessing",
      value: "community_prosperity",
      description: "La comunidad florece con mayor energía",
    },
  }),

  community_extinct: (event, tick) => ({
    id: `quest_${tick}_restore_${event.id}`,
    type: "restore_balance",
    title: "Restaurar el Equilibrio",
    description: `Una comunidad ha desaparecido. Restaura los recursos del área.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 25,
    condition: {
      type: "resource",
      target: 0.5,
      current: 0,
      comparison: "gte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 800,
    status: "active",
    reward: {
      type: "artifact_spawn",
      value: "memory",
      description: "Una memoria de los caídos aparece",
    },
  }),

  first_birth: (event, tick) => ({
    id: `quest_${tick}_nurture_${event.id}`,
    type: "nurture_growth",
    title: "Nutrir la Nueva Vida",
    description: `El primer nacimiento en esta área. Ayuda a la población a crecer a 10.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 20,
    condition: {
      type: "population",
      target: 10,
      current: 1,
      comparison: "gte",
    },
    progress: 0.1,
    createdAt: tick,
    expiresAt: tick + 1500,
    status: "active",
    reward: {
      type: "dialog_unlock",
      value: "birth_celebration",
      description: "Un diálogo de celebración se desbloquea",
    },
  }),

  mass_birth: () => null,

  mass_death: (event, tick) => ({
    id: `quest_${tick}_heal_${event.id}`,
    type: "heal_conflict",
    title: "Sanar las Heridas",
    description: `Muchas muertes han ocurrido. Reduce la tensión del área.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 35,
    condition: {
      type: "tension",
      target: 0.3,
      current: 1.0,
      comparison: "lte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 600,
    status: "active",
    reward: {
      type: "artifact_spawn",
      value: "tear",
      description: "Una lágrima de los perdidos aparece",
    },
  }),

  conflict_started: (event, tick) => ({
    id: `quest_${tick}_peace_${event.id}`,
    type: "heal_conflict",
    title: "Restaurar la Paz",
    description: `Un conflicto ha comenzado. Reduce la tensión antes de más muertes.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 25,
    condition: {
      type: "tension",
      target: 0.4,
      current: 0.8,
      comparison: "lte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 400,
    status: "active",
    reward: {
      type: "blessing",
      value: "peace_aura",
      description: "Un aura de paz se extiende",
    },
  }),

  peace_restored: () => null,

  migration: (event, tick) => ({
    id: `quest_${tick}_observe_${event.id}`,
    type: "observe_migration",
    title: "Observar la Gran Migración",
    description: `Una migración masiva está ocurriendo. Observa su destino.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 40,
    condition: {
      type: "time",
      target: 200,
      current: 0,
      comparison: "gte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 300,
    status: "active",
    reward: {
      type: "area_reveal",
      value: "migration_path",
      description: "Se revela una ruta de migración",
    },
  }),

  discovery: (event, tick) => ({
    id: `quest_${tick}_explore_${event.id}`,
    type: "explore_unknown",
    title: "Explorar lo Desconocido",
    description: `Una nueva zona ha sido descubierta. Explórala completamente.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 50,
    condition: {
      type: "discovery",
      target: 100,
      current: 10,
      comparison: "gte",
    },
    progress: 0.1,
    createdAt: tick,
    expiresAt: tick + 2000,
    status: "active",
    reward: {
      type: "artifact_spawn",
      value: "star",
      description: "Una estrella de descubrimiento aparece",
    },
  }),

  love_pair: (event, tick) => ({
    id: `quest_${tick}_love_${event.id}`,
    type: "discover_love",
    title: "Testigo del Amor",
    description: `Dos almas similares se han encontrado. Ayúdalas a prosperar.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 15,
    condition: {
      type: "survival",
      target: 300,
      current: 0,
      comparison: "gte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 500,
    status: "active",
    reward: {
      type: "artifact_spawn",
      value: "letter",
      description: "Una carta de amor aparece",
    },
  }),

  elder: (event, tick) => ({
    id: `quest_${tick}_elder_${event.id}`,
    type: "witness_elder",
    title: "Sabiduría del Anciano",
    description: `Una partícula longeva ha sido encontrada. Aprende de su sabiduría.`,
    triggerEvent: event,
    targetX: event.x,
    targetY: event.y,
    radius: 10,
    condition: {
      type: "time",
      target: 100,
      current: 0,
      comparison: "gte",
    },
    progress: 0,
    createdAt: tick,
    expiresAt: tick + 200,
    status: "active",
    reward: {
      type: "dialog_unlock",
      value: "elder_wisdom",
      description: "Se desbloquea la sabiduría del anciano",
    },
  }),

  hero_born: () => null,
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
      if (quest.status !== "active") continue;
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
      console.log(`[Quests] Nueva quest: ${quest.title}`);
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
      if (quest.status !== "active") continue;

      if (tick >= quest.expiresAt) {
        quest.status = "expired";
        continue;
      }

      this.updateQuestProgress(quest, particles, tensionField, width);

      if (this.isConditionMet(quest.condition)) {
        quest.status = "completed";
        quest.completedAt = tick;
        quest.progress = 1;
        this.completedQuests.push(quest);
        console.log(`[Quests] Quest completada: ${quest.title}`);
      }
    }

    for (const [id, quest] of this.quests) {
      if (quest.status === "expired" || quest.status === "completed") {
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
      case "population":
        condition.current = nearbyParticles.length;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case "survival":
        condition.current++;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case "time":
        condition.current = this.tick - quest.createdAt;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case "tension": {
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

      case "discovery":
        condition.current = nearbyParticles.length * 10;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;

      case "resource":
        condition.current = nearbyParticles.length > 0 ? 0.5 : 0;
        quest.progress = Math.min(1, condition.current / condition.target);
        break;
    }
  }

  private isConditionMet(condition: QuestCondition): boolean {
    switch (condition.comparison) {
      case "gte":
        return condition.current >= condition.target;
      case "lte":
        return condition.current <= condition.target;
      case "eq":
        return Math.abs(condition.current - condition.target) < 0.01;
      case "within":
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
      (q) => q.status === "active",
    );
  }

  getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
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
      active: all.filter((q) => q.status === "active").length,
      completed: this.completedQuests.length,
      failed: all.filter((q) => q.status === "failed").length,
      expired: all.filter((q) => q.status === "expired").length,
    };
  }
}
