/**
 * InventorySystem - Gestión de inventarios de agentes
 */
import { Particle } from "@shared/types";

export interface InventoryConfig {
  maxCarryWeight: number;
}

const DEFAULT_CONFIG: InventoryConfig = {
  maxCarryWeight: 10.0,
};

// Pesos por unidad de recurso
const RESOURCE_WEIGHTS: Record<string, number> = {
  food: 0.1,
  water: 0.1,
  wood: 0.5,
  stone: 1.0,
  plank: 0.4,
  stone_block: 0.9,
};

export class InventorySystem {
  private config: InventoryConfig;

  constructor(config: Partial<InventoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verificar si un agente tiene espacio para un recurso
   */
  canAddItem(agent: Particle, resource: string, amount: number): boolean {
    const currentWeight = this.calculateWeight(agent.inventory || {});
    const itemWeight = (RESOURCE_WEIGHTS[resource] || 0.1) * amount;

    return currentWeight + itemWeight <= this.config.maxCarryWeight;
  }

  /**
   * Añadir recurso al inventario
   * Retorna la cantidad realmente añadida
   */
  addItem(agent: Particle, resource: string, amount: number): number {
    if (amount <= 0) return 0;
    if (!agent.inventory) {
      agent.inventory = {};
    }

    const weightPerUnit = RESOURCE_WEIGHTS[resource] || 0.1;
    const currentWeight = this.calculateWeight(agent.inventory);
    const availableWeight = Math.max(
      0,
      this.config.maxCarryWeight - currentWeight,
    );

    const maxAmountByWeight = availableWeight / weightPerUnit;
    const amountToAdd = Math.min(amount, maxAmountByWeight);

    if (amountToAdd <= 0) return 0;

    agent.inventory[resource] = (agent.inventory[resource] || 0) + amountToAdd;
    return amountToAdd;
  }

  /**
   * Remover recurso del inventario
   * Retorna true si se pudo remover la cantidad completa
   */
  removeItem(agent: Particle, resource: string, amount: number): boolean {
    if (
      !agent.inventory ||
      !agent.inventory[resource] ||
      agent.inventory[resource] < amount
    ) {
      return false;
    }

    agent.inventory[resource] -= amount;
    if (agent.inventory[resource] <= 0.001) {
      delete agent.inventory[resource];
    }
    return true;
  }

  /**
   * Verificar si tiene recurso suficiente
   */
  hasItem(agent: Particle, resource: string, amount: number): boolean {
    return (agent.inventory?.[resource] || 0) >= amount;
  }

  /**
   * Calcular peso total
   */
  calculateWeight(inventory: Record<string, number>): number {
    let weight = 0;
    for (const [res, amount] of Object.entries(inventory)) {
      weight += amount * (RESOURCE_WEIGHTS[res] || 0.1);
    }
    return weight;
  }

  /**
   * Transferir recurso entre agentes
   */
  transfer(
    from: Particle,
    to: Particle,
    resource: string,
    amount: number,
  ): number {
    if (!this.hasItem(from, resource, amount)) return 0;

    const added = this.addItem(to, resource, amount);
    if (added > 0) {
      this.removeItem(from, resource, added);
    }
    return added;
  }
}
