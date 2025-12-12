/**
 * Reactions - Sistema de reacciones químicas/económicas
 * DSL JSON para definir transformaciones de recursos
 */

import { FieldType } from "../types";
import { Logger } from "../utils/Logger";

export interface Reaction {
  id: string;
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  requires?: {
    labor?: number;
    building?: string;
    minPopulation?: number;
    field?: {
      type: FieldType;
      minValue: number;
    };
  };
  rate: number;
  priority: number;
}

/**
 * Definición de reacciones por defecto
 *
 * IMPORTANTE: Conservación de masa
 * - Los inputs se consumen del campo o inventario
 * - Los outputs van al inventario del agente
 * - efficiency < 1.0 simula pérdidas realistas
 * - rate = 1.0 para evitar multiplicación mágica
 */
export const DEFAULT_REACTIONS: Reaction[] = [
  // Recolección de comida: toma del campo FOOD, da al inventario
  // Eficiencia ~75% para simular pérdidas en recolección
  // Labor cost reduced to prevent death spiral (was 0.1)
  {
    id: "gather_food",
    name: "Recolectar comida",
    inputs: { food: 0.2 },
    outputs: { food: 0.15 },
    requires: { labor: 0.01, field: { type: FieldType.FOOD, minValue: 0.2 } },
    rate: 1.0,
    priority: 1,
  },
  // Recolección de agua: toma del campo WATER, da al inventario
  // Eficiencia ~80%
  {
    id: "gather_water",
    name: "Recolectar agua",
    inputs: { water: 0.15 },
    outputs: { water: 0.12 },
    requires: { labor: 0.005, field: { type: FieldType.WATER, minValue: 0.15 } },
    rate: 1.0,
    priority: 1,
  },
  // Talar árboles: consume del campo TREES, produce wood
  // Eficiencia ~60% (talar es difícil)
  {
    id: "chop_wood",
    name: "Talar árboles",
    inputs: { trees: 0.25 },
    outputs: { wood: 0.15 },
    requires: { labor: 0.01, field: { type: FieldType.TREES, minValue: 0.25 } },  // Reduced from 0.2
    rate: 1.0,
    priority: 2,
  },
  // Minar piedra: consume del campo STONE, produce stone_block
  {
    id: "mine_stone",
    name: "Minar piedra",
    inputs: { stone: 0.2 },
    outputs: { stone_block: 0.1 },
    requires: { labor: 0.01, field: { type: FieldType.STONE, minValue: 0.2 } },  // Reduced from 0.3
    rate: 1.0,
    priority: 3,
  },

  {
    id: "make_planks",
    name: "Hacer tablones",
    inputs: { wood: 2 },
    outputs: { plank: 1.5 },
    requires: { labor: 0.02, building: "workbench" },  // Reduced from 0.3
    rate: 0.4,
    priority: 4,
  },
  {
    id: "cook_food",
    name: "Cocinar comida",
    inputs: { food: 2, wood: 0.5 },
    outputs: { cooked_food: 1.8 },
    requires: { labor: 0.02, building: "campfire" },  // Reduced from 0.2
    rate: 0.5,
    priority: 3,
  },

  {
    id: "build_shelter",
    name: "Construir refugio",
    inputs: { plank: 10, stone_block: 5 },
    outputs: { building_shelter: 1 },
    requires: { labor: 0.05, minPopulation: 3 },  // Reduced from 2
    rate: 0.1,
    priority: 5,
  },
];

export interface ReactionResult {
  reactionId: string;
  executed: boolean;
  consumed: Record<string, number>;
  produced: Record<string, number>;
  laborUsed: number;
}

/**
 * ReactionProcessor - Procesa reacciones
 */
export class ReactionProcessor {
  private reactions: Reaction[];

  constructor(reactions: Reaction[] = DEFAULT_REACTIONS) {
    this.reactions = [...reactions].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Añadir una reacción
   */
  addReaction(reaction: Reaction): void {
    this.reactions.push(reaction);
    this.reactions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Obtener todas las reacciones
   */
  getReactions(): Reaction[] {
    return this.reactions;
  }

  /**
   * Verificar si una reacción puede ejecutarse
   */
  canExecute(
    reaction: Reaction,
    resources: Record<string, number>,
    labor: number,
    buildings: Set<string>,
    population: number,
    fields: Partial<Record<FieldType, number>>,
  ): boolean {
    for (const [resource, amount] of Object.entries(reaction.inputs)) {
      if ((resources[resource] || 0) < amount) {
        return false;
      }
    }

    if (reaction.requires) {
      if (reaction.requires.labor && labor < reaction.requires.labor) {
        return false;
      }

      if (
        reaction.requires.building &&
        !buildings.has(reaction.requires.building)
      ) {
        return false;
      }

      if (
        reaction.requires.minPopulation &&
        population < reaction.requires.minPopulation
      ) {
        return false;
      }

      if (reaction.requires.field) {
        const fieldValue = fields[reaction.requires.field.type] ?? 0;
        if (fieldValue < reaction.requires.field.minValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Ejecutar una reacción
   */
  execute(
    reaction: Reaction,
    resources: Record<string, number>,
  ): ReactionResult {
    const result: ReactionResult = {
      reactionId: reaction.id,
      executed: false,
      consumed: {},
      produced: {},
      laborUsed: 0,
    };

    for (const [resource, amount] of Object.entries(reaction.inputs)) {
      const consumed = amount * reaction.rate;
      // We don't modify resources here because we want to see if multiple reactions can happen
      // or if we just want to report what WOULD happen.
      // But for processCell we generally want to simulate it.
      // In this specific implementation for World.ts, we modify the resources object passed in
      // to track consumption within the loop of reactions.
      resources[resource] = (resources[resource] || 0) - consumed;
      result.consumed[resource] = consumed;
    }

    for (const [resource, amount] of Object.entries(reaction.outputs)) {
      const produced = amount * reaction.rate;
      resources[resource] = (resources[resource] || 0) + produced;
      result.produced[resource] = produced;
    }

    if (reaction.requires?.labor) {
      result.laborUsed = reaction.requires.labor * reaction.rate;
    }

    result.executed = true;
    return result;
  }

  /**
   * Procesar todas las reacciones posibles en una celda
   */
  processCell(
    resources: Record<string, number>,
    labor: number,
    buildings: Set<string>,
    population: number,
    fields: Record<string, number>,
  ): ReactionResult[] {
    const results: ReactionResult[] = [];
    let availableLabor = labor;

    // Clone resources to avoid modifying the input object directly before confirmation?
    // Actually, processCell updates 'resources' locally to allow reaction chaining if desired.
    // The caller (World.ts) reconstructs the final changes from the results.
    const currentResources = { ...resources };

    for (const reaction of this.reactions) {
      // Check if we can execute with CURRENT resources (modified by previous reactions in this loop)
      if (
        !this.canExecute(
          reaction,
          currentResources,
          availableLabor,
          buildings,
          population,
          fields,
        )
      ) {
        continue;
      }

      const result = this.execute(reaction, currentResources);
      if (result.executed) {
        results.push(result);
        availableLabor -= result.laborUsed;

        // If we run out of labor, stop processing reactions for this agent/cell
        if (availableLabor <= 0) break;
      }
    }

    return results;
  }
}

interface ReactionsJSON {
  reactions?: unknown;
}

/**
 * Cargar reacciones desde JSON
 */
export function loadReactionsFromJSON(json: string): Reaction[] {
  try {
    const data = JSON.parse(json) as ReactionsJSON;
    if (data.reactions && Array.isArray(data.reactions)) {
      return data.reactions as Reaction[];
    }
    return [];
  } catch (e) {
    Logger.error("[Reactions] Error loading from JSON:", e);
    return [];
  }
}

/**
 * Exportar reacciones a JSON
 */
export function exportReactionsToJSON(reactions: Reaction[]): string {
  return JSON.stringify({ reactions }, null, 2);
}
