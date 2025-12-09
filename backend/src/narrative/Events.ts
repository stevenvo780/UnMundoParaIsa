/**
 * Events - Sistema de eventos narrativos
 * Triggers basados en condiciones del mundo
 */

import { ChatFragment, Emotion } from "./ChatParser.js";
import { Artifact } from "./Artifacts.js";
import { Particle } from "../types.js";

export type EventType =
  | "artifact_discovered"
  | "community_formed"
  | "community_extinct"
  | "first_birth"
  | "mass_birth"
  | "mass_death"
  | "conflict_started"
  | "peace_restored"
  | "migration"
  | "discovery"
  | "love_pair"
  | "elder"
  | "hero_born";

export interface NarrativeEvent {
  id: number;
  type: EventType;
  tick: number;
  x: number;
  y: number;
  data: EventData;
  fragment?: ChatFragment;
  displayed: boolean;
}

export type EventData =
  | ArtifactDiscoveredData
  | CommunityEventData
  | BirthDeathData
  | ConflictData
  | MigrationData
  | LovePairData
  | ElderData
  | HeroData;

export interface ArtifactDiscoveredData {
  artifactId: number;
  artifactType: string;
  discoveredBy: number;
}

export interface CommunityEventData {
  communityId: number;
  population: number;
  age?: number;
}

export interface BirthDeathData {
  count: number;
  location: { x: number; y: number };
}

export interface ConflictData {
  tension: number;
  casualties: number;
  dispersed: number;
}

export interface MigrationData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  count: number;
}

export interface LovePairData {
  particle1: number;
  particle2: number;
  similarity: number;
}

export interface ElderData {
  particleId: number;
  age: number;
}

export interface HeroData {
  particleId: number;
  name: string;
  traits: string[];
}

/**
 * EventCondition - Condición para disparar evento
 */
export interface EventCondition {
  type: EventType;
  check: (state: WorldState, prevState: WorldState) => EventTrigger | null;
  cooldown: number;
  priority: number;
  emotionHint?: Emotion;
}

export interface EventTrigger {
  x: number;
  y: number;
  data: EventData;
}

export interface WorldState {
  tick: number;
  particles: Particle[];
  births: number;
  deaths: number;
  communities: Array<{ id: number; population: number; x: number; y: number }>;
  conflicts: Array<{ x: number; y: number; tension: number }>;
  artifacts: Artifact[];
}

/**
 * EventManager - Gestiona eventos narrativos
 */
export class EventManager {
  private events: NarrativeEvent[] = [];
  private nextId = 1;
  private lastEventByType: Map<EventType, number> = new Map();
  private tick = 0;

  private conditions: EventCondition[] = [];

  constructor() {
    this.registerDefaultConditions();
  }

  /**
   * Registrar condiciones por defecto
   */
  private registerDefaultConditions(): void {
    this.conditions = [
      {
        type: "artifact_discovered",
        check: (state, prev) => {
          const newDiscovered = state.artifacts.filter(
            (a) =>
              a.discovered &&
              !prev.artifacts.find((p) => p.id === a.id && p.discovered),
          );
          if (newDiscovered.length === 0) return null;

          const artifact = newDiscovered[0];
          return {
            x: artifact.x,
            y: artifact.y,
            data: {
              artifactId: artifact.id,
              artifactType: artifact.type,
              discoveredBy: artifact.discoveredBy || 0,
            } as ArtifactDiscoveredData,
          };
        },
        cooldown: 10,
        priority: 1,
        emotionHint: undefined,
      },

      {
        type: "community_formed",
        check: (state, prev) => {
          const newCommunities = state.communities.filter(
            (c) => !prev.communities.find((p) => p.id === c.id),
          );
          if (newCommunities.length === 0) return null;

          const comm = newCommunities[0];
          return {
            x: comm.x,
            y: comm.y,
            data: {
              communityId: comm.id,
              population: comm.population,
            } as CommunityEventData,
          };
        },
        cooldown: 100,
        priority: 3,
        emotionHint: "joy",
      },

      {
        type: "mass_birth",
        check: (state, prev) => {
          if (state.births < 10) return null;

          const babies = state.particles.filter(
            (p) => !prev.particles.find((pp) => pp.id === p.id),
          );
          if (babies.length < 5) return null;

          const cx = babies.reduce((s, p) => s + p.x, 0) / babies.length;
          const cy = babies.reduce((s, p) => s + p.y, 0) / babies.length;

          return {
            x: Math.floor(cx),
            y: Math.floor(cy),
            data: {
              count: state.births,
              location: { x: Math.floor(cx), y: Math.floor(cy) },
            } as BirthDeathData,
          };
        },
        cooldown: 200,
        priority: 4,
        emotionHint: "joy",
      },

      {
        type: "mass_death",
        check: (state, prev) => {
          if (state.deaths < 10) return null;

          const dead = prev.particles.filter(
            (p) => !state.particles.find((pp) => pp.id === p.id),
          );
          if (dead.length < 5) return null;

          const cx = dead.reduce((s, p) => s + p.x, 0) / dead.length;
          const cy = dead.reduce((s, p) => s + p.y, 0) / dead.length;

          return {
            x: Math.floor(cx),
            y: Math.floor(cy),
            data: {
              count: state.deaths,
              location: { x: Math.floor(cx), y: Math.floor(cy) },
            } as BirthDeathData,
          };
        },
        cooldown: 200,
        priority: 4,
        emotionHint: "melancholy",
      },

      {
        type: "conflict_started",
        check: (state, prev) => {
          const newConflicts = state.conflicts.filter(
            (c) =>
              !prev.conflicts.find(
                (p) => Math.abs(p.x - c.x) < 10 && Math.abs(p.y - c.y) < 10,
              ),
          );
          if (newConflicts.length === 0) return null;

          const conflict = newConflicts[0];
          return {
            x: conflict.x,
            y: conflict.y,
            data: {
              tension: conflict.tension,
              casualties: 0,
              dispersed: 0,
            } as ConflictData,
          };
        },
        cooldown: 150,
        priority: 2,
        emotionHint: "melancholy",
      },
    ];

    this.conditions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Procesar tick y detectar eventos
   */
  process(state: WorldState, prevState: WorldState): NarrativeEvent[] {
    this.tick = state.tick;
    const triggered: NarrativeEvent[] = [];

    for (const condition of this.conditions) {
      const lastEvent = this.lastEventByType.get(condition.type) || 0;
      if (this.tick - lastEvent < condition.cooldown) continue;

      const trigger = condition.check(state, prevState);
      if (!trigger) continue;

      const event: NarrativeEvent = {
        id: this.nextId++,
        type: condition.type,
        tick: this.tick,
        x: trigger.x,
        y: trigger.y,
        data: trigger.data,
        displayed: false,
      };

      this.events.push(event);
      this.lastEventByType.set(condition.type, this.tick);
      triggered.push(event);
    }

    return triggered;
  }

  /**
   * Obtener eventos no mostrados
   */
  getUnDisplayed(): NarrativeEvent[] {
    return this.events.filter((e) => !e.displayed);
  }

  /**
   * Marcar evento como mostrado
   */
  markDisplayed(eventId: number): void {
    const event = this.events.find((e) => e.id === eventId);
    if (event) event.displayed = true;
  }

  /**
   * Obtener eventos recientes
   */
  getRecent(count: number = 10): NarrativeEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Obtener eventos por tipo
   */
  getByType(type: EventType): NarrativeEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): EventStats {
    const byType: Record<EventType, number> = {} as Record<EventType, number>;

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
    }

    return {
      total: this.events.length,
      undisplayed: this.events.filter((e) => !e.displayed).length,
      byType,
    };
  }

  /**
   * Serializar para persistencia
   */
  serialize(): NarrativeEvent[] {
    return this.events;
  }

  /**
   * Cargar desde datos
   */
  load(data: NarrativeEvent[]): void {
    this.events = data;
    this.nextId = Math.max(0, ...data.map((e) => e.id)) + 1;

    for (const event of data) {
      const last = this.lastEventByType.get(event.type) || 0;
      if (event.tick > last) {
        this.lastEventByType.set(event.type, event.tick);
      }
    }
  }
}

export interface EventStats {
  total: number;
  undisplayed: number;
  byType: Record<EventType, number>;
}
