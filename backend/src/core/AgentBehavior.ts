/**
 * AgentBehavior - Sistema de comportamiento (Cerebro)
 * Implementa una Máquina de Estados Finitos (FSM) para los agentes
 */
import { Particle, AgentState, FieldType, WORLD } from "../types";
import { World } from "./World";
import { InventorySystem } from "../economy/InventorySystem";
import { StructureManager, StructureType } from "./StructureManager";
import { ReactionProcessor } from "../economy/Reactions";

export class AgentBehaviorSystem {
  private world: World;
  private inventorySystem: InventorySystem;
  private structureManager: StructureManager;
  private reactionProcessor: ReactionProcessor;

  constructor(world: World, inventorySystem: InventorySystem, structureManager: StructureManager, reactionProcessor: ReactionProcessor) {
    this.world = world;
    this.inventorySystem = inventorySystem;
    this.structureManager = structureManager;
    this.reactionProcessor = reactionProcessor;
  }

  update(agent: Particle): void {
    // Inicialización si falta estado
    if (!agent.state) {
      agent.state = AgentState.IDLE;
      agent.inventory = agent.inventory || {};
      agent.memory = agent.memory || {};
    }

    switch (agent.state) {
      case AgentState.IDLE:
        this.handleIdle(agent);
        break;
      case AgentState.GATHERING:
        this.handleGathering(agent);
        break;
      case AgentState.WORKING:
        this.handleWorking(agent);
        break;
      case AgentState.WANDERING:
        this.handleWandering(agent);
        break;
      case AgentState.MOVING:
        this.handleMoving(agent);
        break;
    }
  }

  private handleIdle(agent: Particle): void {
    // 1. Necesidades Basicas (Comida)
    if (agent.energy < 0.4) {
      agent.state = AgentState.GATHERING;
      agent.currentAction = "Seeking Food";
      return;
    }

    // 2. Trabajo (Building)
    // Si tiene recursos de construcción, buscar construcción
    if (this.inventorySystem.hasItem(agent, "wood", 5)) {
      const nearbyStructures = this.structureManager.getNearbyStructures(agent.x, agent.y, 100);
      const constructionSite = nearbyStructures.find(s => s.health < 1.0);

      if (constructionSite) {
        agent.state = AgentState.WORKING;
        agent.memory.targetStructureId = constructionSite.id;
        agent.targetX = constructionSite.x;
        agent.targetY = constructionSite.y;
        agent.currentAction = "Going to Build";
        return;
      }
    }

    // 3. Recolección (Trabajo)
    // Si no tiene nada que hacer, recolectar madera
    if (this.inventorySystem.canAddItem(agent, "wood", 1)) {
      agent.state = AgentState.GATHERING;
      agent.currentAction = "Gathering Wood";
      return;
    }

    // 4. Wander
    agent.state = AgentState.WANDERING;
    agent.currentAction = "Wandering";
  }

  private handleGathering(agent: Particle): void {
    const targetType = agent.energy < 0.4 ? FieldType.FOOD : FieldType.TREES;
    // Map resource to reaction ID
    const reactionId = targetType === FieldType.FOOD ? "gather_food" : "chop_wood";

    // Prepare fields context
    const fields: Record<string, number> = {
      [targetType]: this.world.getFieldValueAt(targetType, agent.x, agent.y)
    };

    // Attempt reaction
    const result = this.reactionProcessor.performAction(
      agent,
      reactionId,
      this.inventorySystem,
      fields
    );

    if (result.executed) {
      // Apply field consumption
      for (const [field, amount] of Object.entries(result.consumed)) {
        if (Object.values(FieldType).includes(field as FieldType)) {
          const current = this.world.getFieldValueAt(field as FieldType, agent.x, agent.y);
          this.world.setFieldValueAt(field as FieldType, agent.x, agent.y, Math.max(0, current - amount));
        }
      }

      agent.currentAction = `Gathering ${reactionId}`;
      agent.vx *= 0.5;
      agent.vy *= 0.5;

      // Check completion
      if (targetType === FieldType.FOOD && agent.energy > 0.9) agent.state = AgentState.IDLE;
      if (targetType === FieldType.TREES && !this.inventorySystem.canAddItem(agent, "wood", 1)) agent.state = AgentState.IDLE;

    } else {
      // If failed (no resource or no energy), return to IDLE or move
      // If resource is empty, move
      if (fields[targetType] < 0.1) {
        // Move towards gradient (handled by World for now, but we should reset state if persistent failure)
        // agent.state = AgentState.WANDERING; 
      }
      // If energy low and can't gather food? Die eventually.
    }
  }

  private handleWorking(agent: Particle): void {
    if (!agent.memory.targetStructureId) {
      agent.state = AgentState.IDLE;
      return;
    }

    // Verificar distancia
    const dist = Math.sqrt((agent.x - (agent.targetX || 0)) ** 2 + (agent.y - (agent.targetY || 0)) ** 2);

    if (dist < 5) {
      // Construir
      if (this.inventorySystem.removeItem(agent, "wood", 1)) {
        this.structureManager.contributeToStructure(agent.memory.targetStructureId, agent.id, 0.1);
        agent.currentAction = "Building";
      } else {
        // Se acabaron los recursos
        agent.state = AgentState.IDLE;
      }
    } else {
      // Seguir moviendose
      agent.currentAction = "Moving to Site";
    }
  }

  private handleMoving(agent: Particle): void {
    // Logic handled by physics mostly
    const dist = Math.sqrt((agent.x - (agent.targetX || 0)) ** 2 + (agent.y - (agent.targetY || 0)) ** 2);
    if (dist < 2) {
      agent.state = AgentState.IDLE;
    }
  }

  private handleWandering(agent: Particle): void {
    if (Math.random() < 0.05) {
      agent.state = AgentState.IDLE;
    }
  }
}
