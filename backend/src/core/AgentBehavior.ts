/**
 * AgentBehavior - Sistema de comportamiento (Cerebro)
 * Implementa una Máquina de Estados Finitos (FSM) para los agentes
 */
import { Particle, AgentState, FieldType } from "../types";
import { World } from "./World";
import { InventorySystem } from "../economy/InventorySystem";
import { StructureManager } from "./StructureManager";
import { ReactionProcessor } from "../economy/Reactions";
import { QuestManager } from "../quests/EmergentQuests";

export class AgentBehaviorSystem {
  private world: World;
  private inventorySystem: InventorySystem;
  private structureManager: StructureManager;
  private reactionProcessor: ReactionProcessor;
  private questManager: QuestManager;

  constructor(
    world: World,
    inventorySystem: InventorySystem,
    structureManager: StructureManager,
    reactionProcessor: ReactionProcessor,
    questManager: QuestManager,
  ) {
    this.world = world;
    this.inventorySystem = inventorySystem;
    this.structureManager = structureManager;
    this.reactionProcessor = reactionProcessor;
    this.questManager = questManager;
  }

  update(agent: Particle): void {
    // Inicialización si falta estado
    if (!agent.state) {
      agent.state = AgentState.IDLE;
      agent.inventory = agent.inventory || {};
      agent.memory = agent.memory || {};
    }

    // 0. Necesidades Biológicas (Critical)
    this.handleBiologicalNeeds(agent);

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

  private handleBiologicalNeeds(agent: Particle): void {
    // 1. Eat if hungry and has food
    if (agent.energy < 0.6 && this.inventorySystem.hasItem(agent, "food", 1)) {
      if (this.inventorySystem.removeItem(agent, "food", 1)) {
        agent.energy = Math.min(1.0, agent.energy + 0.5);
        agent.currentAction = "Eating";
      }
    }

    // 2. Drink (Automatic if on water - simplify for now)
    const waterHere = this.world.getFieldValueAt(
      FieldType.WATER,
      agent.x,
      agent.y,
    );
    if (waterHere > 0.2) {
      agent.energy = Math.min(1.0, agent.energy + 0.05); // Hydrate small amount
      this.world.setFieldValueAt(
        FieldType.WATER,
        agent.x,
        agent.y,
        Math.max(0, waterHere - 0.01),
      );
    }
  }

  private handleReproduction(agent: Particle): void {
    if (agent.energy > 0.9 && this.inventorySystem.hasItem(agent, "food", 5)) {
      if (Math.random() < 0.05) {
        // Trigger World reproduction
        // We need to expose reproduction or call it via event
        // For now, let's just deduct cost and assume World handles population limits if we had a method
        // But World.reproduce is private. We should probably make it public or trigger via flag
      }
    }
  }

  private handleIdle(agent: Particle): void {
    // 1. Necesidades Basicas (Comida)
    if (agent.energy < 0.4) {
      // If we are here, we are hungry and HAVE NO FOOD (checked in handleBiologicalNeeds)
      agent.state = AgentState.GATHERING;
      agent.currentAction = "Seeking Food";
      return;
    }

    // Attempt Reproduction
    this.handleReproduction(agent);

    // 2. Trabajo (Building)
    // Si tiene recursos de construcción, buscar construcción
    if (this.inventorySystem.hasItem(agent, "wood", 5)) {
      const nearestQuest = this.questManager.getNearestActiveQuest(
        agent.x,
        agent.y,
      );
      if (nearestQuest) {
        // If quest is close, maybe interact? For now simple attraction
        const dx = nearestQuest.targetX - agent.x;
        const dy = nearestQuest.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5 && dist < 100) {
          // Move towards quest
          agent.targetX = nearestQuest.targetX;
          agent.targetY = nearestQuest.targetY;
          agent.state = AgentState.WANDERING; // Wandering towards target
          agent.currentAction = `Quest: ${nearestQuest.title}`;
          return;
        }
      }

      // 3. Find nearby structures to build/repair
      // Only if we have resources or just to check status
      const structures = this.structureManager.getNearbyStructures(
        agent.x,
        agent.y,
        100,
      );
      const constructionSite = structures.find((s) => s.health < 1.0);

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

    // Prepare combined resources (inventory + fields) for processCell
    const availableResources: Record<string, number> = {};
    if (agent.inventory) {
      for (const [res, amt] of Object.entries(agent.inventory)) {
        availableResources[res] = amt;
      }
    }

    // Get current field values
    const fieldsAtLocation: Record<FieldType, number> = {
      [FieldType.FOOD]: this.world.getFieldValueAt(
        FieldType.FOOD,
        agent.x,
        agent.y,
      ),
      [FieldType.WATER]: this.world.getFieldValueAt(
        FieldType.WATER,
        agent.x,
        agent.y,
      ),
      [FieldType.TREES]: this.world.getFieldValueAt(
        FieldType.TREES,
        agent.x,
        agent.y,
      ),
      [FieldType.STONE]: this.world.getFieldValueAt(
        FieldType.STONE,
        agent.x,
        agent.y,
      ),
      [FieldType.LABOR]: 0,
      [FieldType.POPULATION]: 0,
      [FieldType.COST]: 0,
      [FieldType.DANGER]: 0,
      [FieldType.TRAIL0]: 0,
      [FieldType.TRAIL1]: 0,
      [FieldType.TRAIL2]: 0,
      [FieldType.TRAIL3]: 0,
    };

    availableResources[FieldType.FOOD] =
      (availableResources[FieldType.FOOD] || 0) +
      fieldsAtLocation[FieldType.FOOD];
    availableResources[FieldType.WATER] =
      (availableResources[FieldType.WATER] || 0) +
      fieldsAtLocation[FieldType.WATER];
    availableResources[FieldType.TREES] =
      (availableResources[FieldType.TREES] || 0) +
      fieldsAtLocation[FieldType.TREES];
    availableResources[FieldType.STONE] =
      (availableResources[FieldType.STONE] || 0) +
      fieldsAtLocation[FieldType.STONE];

    // Identify nearby structures
    const nearbyStructures = this.structureManager.getNearbyStructures(
      agent.x,
      agent.y,
      5,
    );
    const availableBuildings = new Set<string>();
    for (const s of nearbyStructures) {
      availableBuildings.add(s.type);
    }

    const availableLabor = agent.energy;
    const populationHere = this.world.getFieldValueAt(
      FieldType.POPULATION,
      agent.x,
      agent.y,
    );

    // Run reactions
    const results = this.reactionProcessor.processCell(
      availableResources,
      availableLabor,
      availableBuildings,
      populationHere,
      fieldsAtLocation,
    );

    let executedRelevantReaction = false;

    // Apply results
    for (const result of results) {
      if (!result.executed) continue;

      // Check if this reaction helped with our gathering goal
      // e.g. if we wanted food and we got food
      if (targetType === FieldType.FOOD && result.produced["food"])
        executedRelevantReaction = true;
      if (targetType === FieldType.TREES && result.produced["wood"])
        executedRelevantReaction = true;

      // Consume inputs
      for (const [resourceName, amount] of Object.entries(result.consumed)) {
        if (agent.inventory && agent.inventory[resourceName] !== undefined) {
          this.inventorySystem.removeItem(agent, resourceName, amount);
        } else if (
          Object.values(FieldType).includes(resourceName as FieldType)
        ) {
          const current = this.world.getFieldValueAt(
            resourceName as FieldType,
            agent.x,
            agent.y,
          );
          this.world.setFieldValueAt(
            resourceName as FieldType,
            agent.x,
            agent.y,
            Math.max(0, current - amount),
          );
        }
      }

      // Produce outputs
      for (const [resourceName, amount] of Object.entries(result.produced)) {
        if (resourceName.startsWith("building_")) {
          // Handled elsewhere or ignore if gathering?
        } else {
          this.inventorySystem.addItem(agent, resourceName, amount);
        }
      }

      agent.energy -= result.laborUsed;
    }

    if (executedRelevantReaction) {
      agent.currentAction = `Gathering ${targetType}`;
      agent.vx *= 0.5;
      agent.vy *= 0.5;

      // Check completion
      if (targetType === FieldType.FOOD && agent.energy > 0.9)
        agent.state = AgentState.IDLE;
      if (
        targetType === FieldType.TREES &&
        !this.inventorySystem.canAddItem(agent, "wood", 1)
      )
        agent.state = AgentState.IDLE;
    } else {
      // If failed (no resource or no energy)
      if (fieldsAtLocation[targetType] < 0.1) {
        // Resource depleted, maybe transition?
        // agent.state = AgentState.WANDERING;
      }
    }
  }

  private handleWorking(agent: Particle): void {
    if (!agent.memory.targetStructureId) {
      agent.state = AgentState.IDLE;
      return;
    }

    // Verificar distancia
    const dist = Math.sqrt(
      (agent.x - (agent.targetX || 0)) ** 2 +
      (agent.y - (agent.targetY || 0)) ** 2,
    );

    if (dist < 5) {
      // Construir
      if (this.inventorySystem.removeItem(agent, "wood", 1)) {
        this.structureManager.contributeToStructure(
          agent.memory.targetStructureId,
          agent.id,
          0.1,
        );
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
    const dist = Math.sqrt(
      (agent.x - (agent.targetX || 0)) ** 2 +
      (agent.y - (agent.targetY || 0)) ** 2,
    );
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
