/**
 * Reactions - Sistema de reacciones químicas/económicas
 * DSL JSON para definir transformaciones de recursos
 */

import { FieldType, Particle } from "../types";
import { Logger } from "../utils/Logger";
import { InventorySystem } from "./InventorySystem";

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
 */
export const DEFAULT_REACTIONS: Reaction[] = [
  {
    id: "gather_food",
    name: "Recolectar comida",
    inputs: {},
    outputs: { food: 1 },
    requires: { labor: 0.1 },
    rate: 0.5,
    priority: 1,
  },
  {
    id: "gather_water",
    name: "Recolectar agua",
    inputs: {},
    outputs: { water: 1 },
    requires: { labor: 0.05, field: { type: FieldType.WATER, minValue: 0.3 } },
    rate: 0.8,
    priority: 1,
  },
  {
    id: "chop_wood",
    name: "Talar árboles",
    inputs: { trees: 0.2 },
    outputs: { wood: 1 },
    requires: { labor: 0.2 },
    rate: 0.3,
    priority: 2,
  },
  {
    id: "mine_stone",
    name: "Minar piedra",
    inputs: { stone: 0.1 },
    outputs: { stone_block: 1 },
    requires: { labor: 0.3 },
    rate: 0.2,
    priority: 3,
  },

  {
    id: "make_planks",
    name: "Hacer tablones",
    inputs: { wood: 2 },
    outputs: { plank: 1.5 },
    requires: { labor: 0.3, building: "workbench" },
    rate: 0.4,
    priority: 4,
  },
  {
    id: "cook_food",
    name: "Cocinar comida",
    inputs: { food: 2, wood: 0.5 },
    outputs: { cooked_food: 1.8 },
    requires: { labor: 0.2, building: "campfire" },
    rate: 0.5,
    priority: 3,
  },

  {
    id: "build_shelter",
    name: "Construir refugio",
    inputs: { plank: 10, stone_block: 5 },
    outputs: { building_shelter: 1 },
    requires: { labor: 2, minPopulation: 3 },
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
   * Ejecutar acción basada en agente
   */
  performAction(
    agent: Particle,
    reactionId: string,
    inventorySystem: InventorySystem,
    fields: Record<string, number>
  ): ReactionResult {
    const reaction = this.reactions.find(r => r.id === reactionId);
    const result: ReactionResult = {
      reactionId: reactionId,
      executed: false,
      consumed: {},
      produced: {},
      laborUsed: 0
    };

    if (!reaction) return result;

    // 1. Check requirements
    if (reaction.requires) {
      if (reaction.requires.labor && agent.energy < reaction.requires.labor) return result;
      if (reaction.requires.field) {
        const val = fields[reaction.requires.field.type] || 0;
        if (val < reaction.requires.field.minValue) return result;
      }
      // Building check would need location awareness passed in, skipping for now or assumed valid by caller
    }

    // 2. Check inputs
    for (const [res, amt] of Object.entries(reaction.inputs)) {
      // If input is a field type (like 'trees'), check fields
      if (Object.values(FieldType).includes(res as FieldType)) {
        if ((fields[res] || 0) < amt) return result;
      } else {
        // Check inventory
        if (!inventorySystem.hasItem(agent, res, amt)) return result;
      }
    }

    // 3. Execute
    if (reaction.requires?.labor) {
      agent.energy -= reaction.requires.labor;
      result.laborUsed = reaction.requires.labor;
    }

    // Consume
    for (const [res, amt] of Object.entries(reaction.inputs)) {
      if (Object.values(FieldType).includes(res as FieldType)) {
        // Field consumption handled by caller using result.consumed
        result.consumed[res] = amt;
      } else {
        inventorySystem.removeItem(agent, res, amt);
        result.consumed[res] = amt;
      }
    }

    // Produce
    for (const [res, amt] of Object.entries(reaction.outputs)) {
      // If starts with building_ it's handled by caller
      if (res.startsWith("building_")) {
        result.produced[res] = amt;
      } else {
        inventorySystem.addItem(agent, res, amt);
        result.produced[res] = amt;
      }
    }

    result.executed = true;
    return result;
  }

  // Deprecated/Legacy support for cell-based logic if needed, or define empty
  processCell(): ReactionResult[] {
    return [];
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
