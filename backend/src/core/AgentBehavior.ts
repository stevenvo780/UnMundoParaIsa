/**
 * AgentBehavior - Sistema de comportamiento (Cerebro)
 * Implementa una Máquina de Estados Finitos (FSM) para los agentes
 */
import { Particle, AgentState, FieldType } from "../types";
import { World } from "./World";
import { InventorySystem } from "../economy/InventorySystem";
import { StructureManager, StructureType } from "./StructureManager";
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

    // Initialize emergent properties
    if (!agent.needs) {
      agent.needs = {
        shelter: 0.5,
        comfort: 0.5,
        wealth: 0.0,
        social: 0.5,
        thirst: 0.8, // Start mostly hydrated
        hunger: 0.8, // Start mostly fed
      };
    }
    if (!agent.ownedStructureIds) {
      agent.ownedStructureIds = [];
    }

    // 0. Necesidades Biológicas (Critical)
    this.handleBiologicalNeeds(agent);

    // 1. Goal Planning
    const hadNoGoal = !agent.currentGoal;
    if (hadNoGoal) {
      this.inputPlanning(agent);
    }

    // Set startedAt timestamp for newly created goals
    if (hadNoGoal && agent.currentGoal && !agent.currentGoal.startedAt) {
      agent.currentGoal.startedAt = this.world.getCurrentTick();
    }

    // Goal timeout: abandon goals that take too long (1000 ticks = ~50 seconds)
    const GOAL_TIMEOUT_TICKS = 1000;
    if (
      agent.currentGoal?.startedAt &&
      this.world.getCurrentTick() - agent.currentGoal.startedAt > GOAL_TIMEOUT_TICKS
    ) {
      agent.currentGoal = undefined; // Clear stale goal
      agent.state = AgentState.IDLE;
    }

    // Emergency interrupt: critically low energy overrides all goals
    if (agent.energy < 0.25 && agent.currentGoal?.type !== "FIND_FOOD") {
      agent.currentGoal = {
        type: "FIND_FOOD",
        priority: 100, // Maximum priority
        startedAt: this.world.getCurrentTick(),
      };
    }

    // 2. Goal Execution
    if (agent.currentGoal) {
      this.executeGoal(agent);
      // If goal is still active (not completed/cleared), return to skip FSM
      if (agent.currentGoal) {
        return;
      }
    }

    // Fallback to FSM if no goal active (or goal was just cleared)
    if (!agent.currentGoal) {
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
  }

  private handleBiologicalNeeds(agent: Particle): void {
    // 1. Eat if hungry and has food
    // NOTE: threshold reduced from 1 to 0.1 to match gather_food output (~0.15)
    if (agent.energy < 0.6 && this.inventorySystem.hasItem(agent, "food", 0.1)) {
      if (this.inventorySystem.removeItem(agent, "food", 0.1)) {
        agent.energy = Math.min(1.0, agent.energy + 0.15); // Proportional gain for small meals
        // Also satisfy hunger need
        if (agent.needs) {
          agent.needs.hunger = Math.min(1.0, agent.needs.hunger + 0.3);
        }
        agent.currentAction = "Eating";
      }
    }

    // 2. Drink water to satisfy thirst (but NOT energy directly)
    // Energy comes from food only - this prevents infinite energy from water
    const waterHere = this.world.getFieldValueAt(
      FieldType.WATER,
      agent.x,
      agent.y,
    );
    if (agent.needs && waterHere > 0.2) {
      const hydrationAmount = Math.min(0.1, waterHere * 0.15);
      agent.needs.thirst = Math.min(1.0, agent.needs.thirst + hydrationAmount);
      // Consume water from field
      this.world.setFieldValueAt(
        FieldType.WATER,
        agent.x,
        agent.y,
        Math.max(0, waterHere - 0.01),
      );
    }

    // 3. Natural decay of needs over time
    if (agent.needs) {
      agent.needs.hunger = Math.max(0, agent.needs.hunger - 0.001);
      agent.needs.thirst = Math.max(0, agent.needs.thirst - 0.002); // Thirst decays faster
    }
  }

  private handleReproduction(agent: Particle): void {
    if (agent.energy > 0.9 && this.inventorySystem.hasItem(agent, "food", 5)) {
      if (Math.random() < 0.05) {
        // Mark intention for World to process
        agent.wantsToReproduce = true;
        // Consume food cost upfront
        this.inventorySystem.removeItem(agent, "food", 3);
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
    agent.targetX = undefined;
    agent.targetY = undefined;
  }

  private handleGathering(agent: Particle): void {
    // If we have a High-Level Goal driving this gathering, respect it
    let targetType = FieldType.TREES;

    if (agent.currentGoal?.type === "GATHER_RESOURCES") {
      targetType = FieldType.TREES; // Simplification: Wealth = Wood
    } else if (agent.currentGoal?.type === "BUILD_SHELTER") {
      targetType = FieldType.TREES; // Need wood for shelter
    } else if (agent.currentGoal?.type === "FIND_FOOD") {
      targetType = FieldType.FOOD;
    } else {
      // Default reactive behavior
      targetType = agent.energy < 0.4 ? FieldType.FOOD : FieldType.TREES;
    }

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
      if (targetType === FieldType.FOOD && agent.energy > 0.9) {
        agent.state = AgentState.IDLE;
        agent.targetX = undefined;
        agent.targetY = undefined;
      }

      if (targetType === FieldType.TREES) {
        // If gathering for goal, don't stop just because of inventory check?
        // No, inventory full check is critical
        if (!this.inventorySystem.canAddItem(agent, "wood", 1)) {
          // Full, stop gathering
          // Let executeGoal handle the 'Full' state
          agent.state = AgentState.IDLE;
          agent.targetX = undefined;
          agent.targetY = undefined;
        }
      }
    } else {
      // If failed (no resource or no energy)
      if (fieldsAtLocation[targetType] < 0.1) {
        // Resource depleted
      }
    }
  }

  private handleWorking(agent: Particle): void {
    if (!agent.memory.targetStructureId) {
      agent.state = AgentState.IDLE;
      agent.targetX = undefined;
      agent.targetY = undefined;
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
        agent.targetX = undefined;
        agent.targetY = undefined;
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
      agent.targetX = undefined;
      agent.targetY = undefined;
    }
  }

  private handleWandering(agent: Particle): void {
    if (Math.random() < 0.05) {
      agent.state = AgentState.IDLE;
    }
  }

  // --- Emergent Behavior Methods ---

  private inputPlanning(agent: Particle): void {
    if (!agent.needs) return;

    // Decay needs - faster decay creates more emergent pressure
    agent.needs.shelter = Math.max(0, agent.needs.shelter - 0.002);
    agent.needs.comfort = Math.max(0, agent.needs.comfort - 0.002);
    agent.needs.wealth = Math.max(0, agent.needs.wealth - 0.001);
    agent.needs.social = Math.max(0, agent.needs.social - 0.0005);
    agent.needs.thirst = Math.max(0, agent.needs.thirst - 0.003); // Thirst decays faster than other needs

    // 0. Survival Need (Food/Water)
    if (agent.energy < 0.4) {
      agent.currentGoal = {
        type: "FIND_FOOD",
        priority: 20,
      };
      return;
    }

    // 1. Shelter Need
    if (agent.needs.shelter < 0.3) {
      // Need shelter
      // Check if owns shelter
      const ownedStructures = this.structureManager.getStructuresByOwner(
        agent.id,
      );
      const hasShelter = ownedStructures.some(
        (s) =>
          s.type === StructureType.SHELTER || s.type === StructureType.CAMP,
      );

      if (hasShelter) {
        // Go to shelter
        const shelter = ownedStructures.find(
          (s) =>
            s.type === StructureType.SHELTER || s.type === StructureType.CAMP,
        );
        if (shelter) {
          agent.currentGoal = {
            type: "GO_HOME",
            priority: 10,
            targetId: shelter.id,
            targetX: shelter.x,
            targetY: shelter.y,
          };
        }
      } else {
        // Build shelter
        agent.currentGoal = {
          type: "BUILD_SHELTER",
          priority: 10,
        };
      }
      return;
    }

    // 2. Wealth/Resource Need (Gathering)
    if (agent.needs.wealth < 0.5) {
      // Gather resources
      agent.currentGoal = {
        type: "GATHER_RESOURCES",
        priority: 5,
      };
    }
  }

  private executeGoal(agent: Particle): void {
    if (!agent.currentGoal) return;

    switch (agent.currentGoal.type) {
      case "FIND_FOOD":
        this.executeFindFood(agent);
        break;
      case "BUILD_SHELTER":
        this.executeBuildShelter(agent);
        break;
      case "GATHER_RESOURCES":
        this.executeGatherResources(agent);
        break;
      case "GO_HOME":
        this.executeGoHome(agent);
        break;
      default:
        agent.currentGoal = undefined;
        break;
    }
  }

  private executeFindFood(agent: Particle): void {
    // Reuse gathering logic but force target
    agent.state = AgentState.GATHERING;
    this.handleGathering(agent);
    // Completion check handled by handleGathering or energy check next tick
    if (agent.energy > 0.9) {
      agent.currentGoal = undefined;
    }
  }

  private executeBuildShelter(agent: Particle): void {
    // 1. Check resources
    const woodNeeded = 5;
    const hasWood = this.inventorySystem.hasItem(agent, "wood", woodNeeded);

    if (!hasWood) {
      // Sub-goal: Gather wood
      if (this.inventorySystem.canAddItem(agent, "wood", 1)) {
        agent.state = AgentState.GATHERING;
        agent.currentAction = "Gathering Wood for Shelter";
        this.handleGathering(agent); // Reuse existing gathering logic
      } else {
        // Inventory full but no wood? Dump something?
        // For now, fail goal.
        agent.currentGoal = undefined;
      }
    } else {
      // Has wood, find place to build
      // Random walk until find suitable spot or just build here if 'empty'
      // Simply: Build here!
      const structure = this.structureManager.createStructure(
        agent.x,
        agent.y,
        StructureType.SHELTER,
        agent.id,
        Date.now(), // approximation of tick
        agent.id, // owner
      );

      if (structure) {
        this.inventorySystem.removeItem(agent, "wood", woodNeeded);
        agent.currentAction = "Built Shelter";
        // Gradual satisfaction instead of instant
        if (agent.needs)
          agent.needs.shelter = Math.min(1.0, agent.needs.shelter + 0.4);
        agent.currentGoal = undefined; // Goal complete
      } else {
        // Can't build here, move
        agent.state = AgentState.WANDERING;
        agent.currentAction = "Looking for building site";
        this.handleWandering(agent);
      }
    }
  }

  private executeGatherResources(agent: Particle): void {
    if (this.inventorySystem.canAddItem(agent, "wood", 1)) {
      agent.state = AgentState.GATHERING;
      this.handleGathering(agent);
      if (this.inventorySystem.hasItem(agent, "wood", 5)) {
        // Gradual satisfaction instead of instant
        if (agent.needs)
          agent.needs.wealth = Math.min(1.0, agent.needs.wealth + 0.3);
        agent.currentGoal = undefined;
      }
    } else {
      agent.currentGoal = undefined; // Full
    }
  }

  private executeGoHome(agent: Particle): void {
    if (!agent.currentGoal?.targetX || !agent.currentGoal?.targetY) {
      agent.currentGoal = undefined;
      return;
    }

    const dist = Math.sqrt(
      (agent.x - agent.currentGoal.targetX) ** 2 +
      (agent.y - agent.currentGoal.targetY) ** 2,
    );

    if (dist < 5) {
      agent.state = AgentState.IDLE;
      agent.currentAction = "Resting at Home";
      if (agent.needs) {
        agent.needs.shelter = Math.min(1.0, agent.needs.shelter + 0.01);
        agent.needs.comfort = Math.min(1.0, agent.needs.comfort + 0.01);
      }

      // If fully rested, clear goal
      if (agent.needs && agent.needs.shelter > 0.95) {
        agent.currentGoal = undefined;
      }
    } else {
      agent.targetX = agent.currentGoal.targetX;
      agent.targetY = agent.currentGoal.targetY;
      agent.state = AgentState.MOVING;
      this.handleMoving(agent);
      agent.currentAction = "Going Home";
    }
  }
}
