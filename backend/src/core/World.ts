/**
 * World - Gestiona todos los campos y la simulación global
 * Integra: Chunks, Scheduler, Economy, Social, Narrative, Scale
 */

import { Field } from "./Field";
import { Scheduler } from "./Scheduler";
import { Logger } from "../utils/Logger";
import {
  FieldType,
  DEFAULT_FIELD_CONFIGS,
  SimulationConfig,
  DEFAULT_CONFIG,
  AgentState,
  SimulationMetrics,
  Particle,
  StructureData,
  // StructureStats removed
  BiodiversitySnapshot,
  EmergenceSnapshot,
} from "@shared/types";

import { DemandManager } from "../economy/Demand";
import { ResourceFlowSystem } from "../economy/Advection";
import { ReactionProcessor } from "../economy/Reactions";
import { StockpileManager, StockpileData } from "../economy/Stockpiles"; // Import StockpileManager

import { getSignature, SignatureField } from "../social/Signatures";
import { CommunityDetector } from "../social/Communities";
import { TensionField } from "../social/Tension";

import {
  SemanticFieldManager,
  SemanticFieldType,
} from "../narrative/SemanticFields";
import { ArtifactManager } from "../narrative/Artifacts";
import { EventManager, WorldState } from "../narrative/Events";
import { MaterializationManager } from "../narrative/Materialization";

import { FlowFieldManager } from "../scale/FlowFields";
import { LODManager } from "../scale/LOD";
import { ThermostatBank, WorldBalancer, ThermostatType } from "../scale/Thermostats";
import { InfiniteChunkManager } from "./InfiniteChunkManager";
import { CHUNK_SIZE } from "./Chunk";

import { QuestManager } from "../quests/EmergentQuests";
import { StructureManager, StructureType } from "./StructureManager";
import { AgentBehaviorSystem } from "./AgentBehavior";
import { InventorySystem } from "../economy/InventorySystem";


export class World {
  readonly width: number;
  readonly height: number;
  readonly config: SimulationConfig;

  private infiniteChunks?: InfiniteChunkManager;

  private structureManager!: StructureManager;
  private stockpileManager!: StockpileManager; // Property
  private reactionProcessor!: ReactionProcessor;
  private agentBehavior!: AgentBehaviorSystem;
  private inventorySystem!: InventorySystem;

  private fields: Map<FieldType, Field> = new Map();
  private particles: Particle[] = [];
  private particleIdCounter = 0;

  private tick = 0;
  private paused = false;
  private lastTickTime = 0;

  private births = 0;
  private deaths = 0;

  private scheduler!: Scheduler;

  private demandManager!: DemandManager;
  private resourceFlow!: ResourceFlowSystem;

  private communities!: CommunityDetector;
  private tension!: TensionField;

  private semanticFields!: SemanticFieldManager;
  private artifacts!: ArtifactManager;
  private events!: EventManager;
  private materialization!: MaterializationManager;
  private questManager!: QuestManager;

  private flowFields!: FlowFieldManager;
  private lod!: LODManager;
  private thermostats!: ThermostatBank;
  private worldBalancer!: WorldBalancer;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.width = this.config.worldWidth;
    this.height = this.config.worldHeight;

    this.initializeFields();

    this.initializeSystems();
  }

  /**
   * Inicializar todos los subsistemas
   */
  private initializeSystems(): void {
    this.scheduler = new Scheduler();

    this.demandManager = new DemandManager(this.width, this.height);
    this.resourceFlow = new ResourceFlowSystem(this.width, this.height, [
      FieldType.FOOD,
      FieldType.WATER,
      FieldType.STONE,
    ]);

    this.communities = new CommunityDetector();
    this.tension = new TensionField(this.width, this.height);

    this.semanticFields = new SemanticFieldManager(this.width, this.height);
    this.artifacts = new ArtifactManager(this.width, this.height);
    this.events = new EventManager();
    this.materialization = new MaterializationManager();
    this.questManager = new QuestManager();

    this.flowFields = new FlowFieldManager();
    this.lod = new LODManager();
    this.thermostats = new ThermostatBank();
    this.worldBalancer = new WorldBalancer(this.thermostats);

    this.structureManager = new StructureManager();
    this.stockpileManager = new StockpileManager(this.width, this.height);
    this.inventorySystem = new InventorySystem();
    this.reactionProcessor = new ReactionProcessor();
    this.agentBehavior = new AgentBehaviorSystem(
      this,
      this.inventorySystem,
      this.structureManager,
      this.reactionProcessor,
      this.questManager,
    );

    this.registerScheduledTasks();
  }

  /**
   * Registrar tareas con diferentes frecuencias
   */
  private registerScheduledTasks(): void {
    // Agent AI/Behavior - runs FIRST so agents can eat/gather before metabolism
    this.scheduler.register({
      id: "agent-behavior",
      rate: "FAST",
      fn: () => this.updateAgentBehavior(),
      priority: 0,
    });
    this.scheduler.register({
      id: "particles",
      rate: "FAST",
      fn: () => this.updateParticles(),
      priority: 1,
    });
    this.scheduler.register({
      id: "fields",
      rate: "MEDIUM",
      fn: () => this.updateFields(),
      priority: 2,
      offset: 0,
    });
    this.scheduler.register({
      id: "food-production",
      rate: "FAST",
      fn: () => this.updateFoodProduction(),
      priority: 3,
    });

    this.scheduler.register({
      id: "economy",
      rate: "MEDIUM",
      fn: () => this.updateEconomy(),
      priority: 10,
      offset: 2,
    });
    this.scheduler.register({
      id: "stockpiles",
      rate: "SLOW",
      fn: () => this.stockpileManager.applyDecay(),
      priority: 12,
      offset: 8,
    });
    this.scheduler.register({
      id: "social",
      rate: "MEDIUM",
      fn: () => this.updateSocial(),
      priority: 11,
      offset: 4,
    });

    this.scheduler.register({
      id: "growth",
      rate: "SLOW",
      fn: () => this.updateTreeGrowth(),
      priority: 19,
      offset: 1,
    });
    this.scheduler.register({
      id: "narrative",
      rate: "SLOW",
      fn: () => this.updateNarrative(),
      priority: 20,
      offset: 6,
    });
    this.scheduler.register({
      id: "scale",
      rate: "SLOW",
      fn: () => this.updateScale(),
      priority: 21,
      offset: 11,
    });
    this.scheduler.register({
      id: "thermostats",
      rate: "SLOW",
      fn: () => this.updateThermostats(),
      priority: 22,
      offset: 16,
    });
    this.scheduler.register({
      id: "structures",
      rate: "SLOW",
      fn: () => this.structureManager.update(this.tick),
      priority: 23,
      offset: 13,
    });
  }

  /**
   * Get current simulation tick (for agent goal timeout tracking)
   */
  getCurrentTick(): number {
    return this.tick;
  }

  /**
   * Update agent behavior (AI/decision-making) for all particles
   * This runs BEFORE metabolism so agents can eat and gather
   */
  private updateAgentBehavior(): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      this.agentBehavior.update(p);
    }
  }

  /**
   * Actualizar economía (MEDIUM rate)
   * Integra: Demand, Reactions, Advection, Stockpiles
   */
  private updateEconomy(): void {
    const populationField = this.getField(FieldType.POPULATION)?.getBuffer();
    const foodField = this.getField(FieldType.FOOD);
    const waterField = this.getField(FieldType.WATER);

    if (!populationField || !foodField || !waterField) return;

    const resourceFields = new Map<string, Float32Array>();
    resourceFields.set(FieldType.FOOD, foodField.getBuffer());
    resourceFields.set(FieldType.WATER, waterField.getBuffer());

    const treesField = this.getField(FieldType.TREES);
    const stoneField = this.getField(FieldType.STONE);
    if (treesField) resourceFields.set(FieldType.TREES, treesField.getBuffer());
    if (stoneField) resourceFields.set(FieldType.STONE, stoneField.getBuffer());

    this.demandManager.update(populationField, resourceFields);
    this.processCrafting();

    const foodDemand = this.demandManager.getDemandField(FieldType.FOOD);
    if (foodDemand) {
      const size = this.width * this.height;
      const gradX = new Float32Array(size);
      const gradY = new Float32Array(size);

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const i = y * this.width + x;
          const grad = foodDemand.getGradient(x, y);
          gradX[i] = grad.gx;
          gradY[i] = grad.gy;
        }
      }

      const advectedFood = this.resourceFlow.updateFlow(
        FieldType.FOOD,
        gradX,
        gradY,
        foodField.getBuffer(),
      );

      const buffer = foodField.getBuffer();
      for (let i = 0; i < advectedFood.length; i++) {
        buffer[i] = advectedFood[i];
      }
    }
  }

  /**
   * Actualizar sistemas sociales (MEDIUM rate)
   * Integra: Signatures, Communities, Tension
   */
  private updateSocial(): void {
    const populationField = this.getField(FieldType.POPULATION)?.getBuffer();
    const foodField = this.getField(FieldType.FOOD)?.getBuffer();
    const waterField = this.getField(FieldType.WATER)?.getBuffer();

    if (!populationField || !foodField || !waterField) return;

    const signatureField = this.buildSignatureField();

    this.communities.detect(
      this.particles,
      populationField,
      this.width,
      this.height,
    );

    this.tension.calculate(signatureField, populationField, {
      food: foodField,
      water: waterField,
    });

    const conflicts = this.tension.detectConflicts(this.tick);
    for (const conflict of conflicts) {
      const radius = 5;
      for (const particle of this.particles) {
        if (!particle.alive) continue;
        const dx = particle.x - conflict.x;
        const dy = particle.y - conflict.y;
        if (Math.sqrt(dx * dx + dy * dy) < radius) {
          const angle = Math.atan2(dy, dx);
          particle.x += Math.cos(angle) * 2;
          particle.y += Math.sin(angle) * 2;
          particle.energy -= 0.001 * conflict.tension; // Reduced from 0.1 to prevent instant death
        }
      }
    }
  }

  /**
   * Procesar crafteo y construcción (MEDIUM rate)
   */
  private processCrafting(): void {
    for (const p of this.particles) {
      if (!p.alive) continue;

      const px = Math.floor(p.x);
      const py = Math.floor(p.y);

      // Initialize inventory if it doesn't exist
      if (!p.inventory) {
        p.inventory = {};
      }

      // Create a map of ALL available resources for this cell/particle for the reaction processor
      // This includes particle's inventory and field resources at its location
      const totalAvailableResources: Record<string, number> = {};

      // Add inventory resources
      for (const [resourceName, amount] of Object.entries(p.inventory)) {
        totalAvailableResources[resourceName] =
          (totalAvailableResources[resourceName] || 0) + amount;
      }

      // Add field resources, ensuring these are also available for reactions
      const fieldsAtLocation: Record<FieldType, number> = {
        [FieldType.FOOD]: this.getFieldValueAt(FieldType.FOOD, p.x, p.y),
        [FieldType.WATER]: this.getFieldValueAt(FieldType.WATER, p.x, p.y),
        [FieldType.TREES]: this.getFieldValueAt(FieldType.TREES, p.x, p.y),
        [FieldType.STONE]: this.getFieldValueAt(FieldType.STONE, p.x, p.y),
        [FieldType.LABOR]: 0,
        [FieldType.POPULATION]: 0,
        [FieldType.COST]: 0,
        [FieldType.DANGER]: 0,
        [FieldType.TRAIL0]: 0,
        [FieldType.TRAIL1]: 0,
        [FieldType.TRAIL2]: 0,
        [FieldType.TRAIL3]: 0,
      };

      totalAvailableResources[FieldType.FOOD] =
        (totalAvailableResources[FieldType.FOOD] || 0) +
        fieldsAtLocation[FieldType.FOOD];
      totalAvailableResources[FieldType.WATER] =
        (totalAvailableResources[FieldType.WATER] || 0) +
        fieldsAtLocation[FieldType.WATER];
      totalAvailableResources[FieldType.TREES] =
        (totalAvailableResources[FieldType.TREES] || 0) +
        fieldsAtLocation[FieldType.TREES];
      totalAvailableResources[FieldType.STONE] =
        (totalAvailableResources[FieldType.STONE] || 0) +
        fieldsAtLocation[FieldType.STONE];

      const availableLabor = p.energy; // Simplification: agent's energy is its available labor
      const populationHere = this.getFieldValueAt(
        FieldType.POPULATION,
        p.x,
        p.y,
      );

      // Determine available buildings (e.g., workbench, campfire)
      const nearbyStructures = this.structureManager.getNearbyStructures(
        p.x,
        p.y,
        5,
      ); // search radius of 5
      const availableBuildings = new Set<string>();
      for (const s of nearbyStructures) {
        availableBuildings.add(s.type);
      }

      // Process reactions
      const reactionResults = this.reactionProcessor.processCell(
        totalAvailableResources, // Pass the combined resource pool
        availableLabor,
        availableBuildings,
        populationHere,
        fieldsAtLocation, // Fields are for checking conditions, not direct consumption/production from this map
      );

      // Apply reaction results back to particle inventory and world fields
      for (const result of reactionResults) {
        if (!result.executed) continue;

        // Consume inputs
        for (const [resourceName, amount] of Object.entries(result.consumed)) {
          // If it's an inventory item, update particle's inventory
          if (p.inventory[resourceName] !== undefined) {
            p.inventory[resourceName] = Math.max(
              0,
              p.inventory[resourceName] - amount,
            );
          }
          // If it's a field resource, update the world field
          else if (
            Object.values(FieldType).includes(resourceName as FieldType)
          ) {
            const currentFieldValue = this.getFieldValueAt(
              resourceName as FieldType,
              px,
              py,
            );
            this.setFieldValueAt(
              resourceName as FieldType,
              px,
              py,
              Math.max(0, currentFieldValue - amount),
            );
          }
          // Note: If a resource is both in inventory and a field, current logic assumes it's primarily consumed from inventory
          // if present there, otherwise from the field. This might need further refinement based on game design.
        }

        // Produce outputs
        for (const [resourceName, amount] of Object.entries(result.produced)) {
          if (resourceName.startsWith("building_")) {
            const structureTypeString = resourceName.substring(
              "building_".length,
            );
            const structureType = structureTypeString as StructureType;
            const created = this.structureManager.createStructure(
              px,
              py,
              structureType,
              p.id,
              this.tick,
            );
            if (created) {
              // Structure created, deduct some energy for the effort
              p.energy -= 0.1; // Placeholder cost
            }
          } else {
            // It's an inventory item
            p.inventory[resourceName] =
              (p.inventory[resourceName] || 0) + amount;
          }
        }
        // NOTE: Energy deduction removed here - it's handled by AgentBehavior.handleGathering
        // to avoid double consumption of laborUsed
      }
    }
  }

  /**
   * Construir SignatureField desde partículas
   * Crea una estructura compatible con TensionField.calculate()
   */
  private buildSignatureField(): SignatureField {
    const field = new SignatureField(this.width, this.height);

    for (const p of this.particles) {
      if (!p.alive) continue;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

      const signature = getSignature(p.seed);
      field.deposit(x, y, signature, 1.0);
    }

    return field;
  }

  /**
   * Actualizar narrativa (SLOW rate)
   * Integra: SemanticFields, Artifacts, Events, Materialization
   */
  private updateNarrative(): void {
    this.semanticFields.step();

    this.artifacts.update();

    const allCommunities = this.communities.getAll();
    const conflicts = this.tension.getRecentConflicts();

    const worldState: WorldState = {
      tick: this.tick,
      particles: this.particles,
      births: this.births,
      deaths: this.deaths,
      communities: allCommunities.map((c) => ({
        id: c.id,
        population: c.population,
        x: c.centerX,
        y: c.centerY,
      })),
      conflicts: conflicts.map((c) => ({
        x: c.x,
        y: c.y,
        tension: c.tension,
      })),
      artifacts: this.artifacts.getAll(),
    };

    this.events.process(worldState, this.previousWorldState || worldState);
    this.previousWorldState = worldState;

    this.materialization.setTick(this.tick);
    for (const particle of this.particles) {
      if (!particle.alive) continue;

      const estimatedAge = Math.floor(particle.energy * 1000);
      if (this.materialization.canMaterialize(particle, estimatedAge)) {
        this.materialization.materialize(particle, estimatedAge);
      }
    }

    this.applySemanticEffects();
  }

  private previousWorldState?: WorldState;

  /**
   * Aplicar efectos de campos semánticos al mundo
   */
  private applySemanticEffects(): void {
    const joyField = this.semanticFields.getField(SemanticFieldType.JOY);
    const nostalgiaField = this.semanticFields.getField(
      SemanticFieldType.NOSTALGIA,
    );

    if (!joyField || !nostalgiaField) return;

    for (const particle of this.particles) {
      if (!particle.alive) continue;

      const x = Math.floor(particle.x);
      const y = Math.floor(particle.y);

      const joy = joyField.get(x, y);
      const nostalgia = nostalgiaField.get(x, y);

      if (joy > 0.5) {
        particle.energy += 0.01 * joy;
      }

      if (nostalgia > 0.5) {
        particle.energy = Math.min(particle.energy, 0.8);
      }
    }
  }

  /**
   * Actualizar sistemas de escala (SLOW rate)
   * Integra: FlowFields, LOD
   */
  private updateScale(): void {
    const food = this.getField(FieldType.FOOD);
    const water = this.getField(FieldType.WATER);

    if (food) {
      this.flowFields.updateFromField(FieldType.FOOD, food.getBuffer());
    }
    if (water) {
      this.flowFields.updateFromField(FieldType.WATER, water.getBuffer());
    }

    this.lod.clearFocusPoints();

    const communities = this.communities.getAll();
    for (const community of communities) {
      if (community.population > 5) {
        this.lod.addFocusPoint({
          x: community.centerX,
          y: community.centerY,
          radius: community.radius * 2,
          weight: Math.min(1, community.population / 20),
        });
      }
    }

    this.lod.updateLevels();
  }

  /**
   * Actualizar termostatos (SLOW rate)
   */
  private updateThermostats(): void {
    const particleCount = this.getParticleCount();
    const foodAvg = this.getField(FieldType.FOOD)?.getAverage() ?? 0.5;
    const avgEnergy =
      this.particles.reduce((sum, p) => sum + (p.alive ? p.energy : 0), 0) /
      Math.max(1, particleCount);

    this.thermostats.updateAll({
      population: particleCount,
      resources: foodAvg,
      energy: avgEnergy,
    });
  }

  /**
   * Inicializar campos según configuración
   */
  private initializeFields(): void {
    const fieldsToCreate: FieldType[] = [
      FieldType.FOOD,
      FieldType.WATER,
      FieldType.COST,
      FieldType.DANGER,
      FieldType.TREES,
      FieldType.STONE,
      FieldType.TRAIL0,
      FieldType.TRAIL1,
      FieldType.TRAIL2,
      FieldType.TRAIL3,
      FieldType.POPULATION,
      FieldType.LABOR,
    ];

    for (const fieldType of fieldsToCreate) {
      const config = DEFAULT_FIELD_CONFIGS[fieldType];
      const field = new Field(this.width, this.height, config);
      this.fields.set(fieldType, field);
    }
  }

  /**
   * Obtener un campo
   */
  getField(type: FieldType): Field | undefined {
    return this.fields.get(type);
  }

  /**
   * Inyectar InfiniteChunkManager para soporte de mundo infinito
   */
  setInfiniteChunkManager(manager: InfiniteChunkManager): void {
    this.infiniteChunks = manager;
  }

  /**
   * Obtener valor de campo en cualquier coordenada (soporta infinito)
   * Si está fuera del campo original, consulta al chunk manager
   */
  getFieldValueAt(type: FieldType, x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height) {
      const field = this.fields.get(type);
      return field ? field.get(ix, iy) : 0;
    }

    if (this.infiniteChunks) {
      const chunk = this.infiniteChunks.getChunkAt(ix, iy);
      if (chunk) {
        const localX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((iy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.getValue(type, localX, localY);
      }

      const newChunk = this.infiniteChunks.ensureChunkActive(
        Math.floor(ix / CHUNK_SIZE),
        Math.floor(iy / CHUNK_SIZE),
      );
      const localX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((iy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return newChunk.getValue(type, localX, localY);
    }

    return 0;
  }

  /**
   * Establecer valor de campo en cualquier coordenada (soporta infinito)
   */
  setFieldValueAt(type: FieldType, x: number, y: number, value: number): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height) {
      const field = this.fields.get(type);
      if (field) field.set(ix, iy, value);
      return;
    }

    if (this.infiniteChunks) {
      const chunk = this.infiniteChunks.ensureChunkActive(
        Math.floor(ix / CHUNK_SIZE),
        Math.floor(iy / CHUNK_SIZE),
      );
      const localX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((iy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk.setValue(type, localX, localY, value);
    }
  }

  /**
   * Verificar si una posición es válida para movimiento
   * Con chunks infinitos, cualquier posición es válida
   */
  isValidPosition(x: number, y: number): boolean {
    if (this.infiniteChunks) return true;

    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Generar mundo inicial con oases
   */
  generate(seed: number = this.config.seed): void {
    Logger.info(`[World] Generating world with seed ${seed}`);
    const rng = this.createRNG(seed);

    const foodField = this.getField(FieldType.FOOD)!;
    const waterField = this.getField(FieldType.WATER)!;
    const treesField = this.getField(FieldType.TREES)!;
    const costField = this.getField(FieldType.COST)!;

    costField.initWithNoise(0.3, 0.2, seed);

    const oasisCount = 5;
    const oases: Array<{
      x: number;
      y: number;
      radius: number;
      value: number;
    }> = [];

    for (let i = 0; i < oasisCount; i++) {
      oases.push({
        x: Math.floor(rng() * this.width * 0.8 + this.width * 0.1),
        y: Math.floor(rng() * this.height * 0.8 + this.height * 0.1),
        radius: 30 + Math.floor(rng() * 30),
        value: 0.8 + rng() * 0.2,
      });
    }

    oases.push({
      x: Math.floor(this.width / 2),
      y: Math.floor(this.height / 2),
      radius: 50,
      value: 1.0,
    });

    foodField.initWithOases(oases);

    const waterBuffer = waterField.getBuffer();
    for (let i = 0; i < waterBuffer.length; i++) {
      waterBuffer[i] = 0.6 + Math.random() * 0.3;
    }

    treesField.initWithNoise(0.3, 0.3, seed + 1000);

    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);

    // Founders: Stev and Isa
    this.particles.push({
      id: this.particleIdCounter++,
      x: centerX - 3,
      y: centerY,
      vx: 0,
      vy: 0,
      energy: 1.0,
      seed: 0x57455600,
      name: "Stev",
      alive: true,
      state: AgentState.IDLE,
      inventory: { food: 2 },
      memory: {},
    });

    this.particles.push({
      id: this.particleIdCounter++,
      x: centerX + 3,
      y: centerY,
      vx: 0,
      vy: 0,
      energy: 1.0,
      seed: 0x50524f4a,
      name: "Isa",
      alive: true,
      state: AgentState.IDLE,
      inventory: { food: 2 },
      memory: {},
    });

    // Generate 8 additional starting particles around the center (10 total)
    const INITIAL_PARTICLE_COUNT = 8;
    const names = ["Ada", "Leo", "Maya", "Finn", "Zara", "Noah", "Luna", "Kai"];
    for (let i = 0; i < INITIAL_PARTICLE_COUNT; i++) {
      const angle = (i / INITIAL_PARTICLE_COUNT) * Math.PI * 2;
      const dist = 10 + Math.random() * 15;
      const px = Math.floor(centerX + Math.cos(angle) * dist);
      const py = Math.floor(centerY + Math.sin(angle) * dist);

      this.particles.push({
        id: this.particleIdCounter++,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        energy: 0.7 + Math.random() * 0.3,
        seed: Math.floor(Math.random() * 0xffffffff),
        name: names[i] || `Agent${i}`,
        alive: true,
        state: AgentState.IDLE,
        inventory: { food: 1 + Math.random() },
        memory: {},
      });
    }

    Logger.info(
      `[World] Generated ${this.particles.length} particles at center (${centerX}, ${centerY})`,
    );
  }

  /**
   * Spawn partículas en una posición
   */
  spawnParticlesAt(cx: number, cy: number, count: number, seed: number): void {
    const rng = this.createRNG(seed);

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * 20;

      const x = Math.floor(cx + Math.cos(angle) * dist);
      const y = Math.floor(cy + Math.sin(angle) * dist);

      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        this.particles.push({
          id: this.particleIdCounter++,
          x,
          y,
          vx: 0,
          vy: 0,
          energy: 0.5 + rng() * 0.3,
          seed: Math.floor(rng() * 0xffffffff),
          alive: true,
          state: AgentState.IDLE,
          inventory: {},
          memory: {},
        });
      }
    }
  }

  /**
   * Ejecutar un tick de simulación
   * Usa el scheduler para coordinar actualizaciones multi-rate
   */
  step(): void {
    if (this.paused) return;

    const startTime = performance.now();

    this.births = 0;
    this.deaths = 0;

    this.scheduler.step();

    this.updateGrowth();

    this.updatePopulationField();

    this.cleanDeadParticles();

    this.tick++;
    this.lastTickTime = performance.now() - startTime;
  } /**
   * Actualizar todas las partículas
   * NOTA: Usa getFieldValueAt para soporte de mundo infinito
   */
  private updateParticles(): void {
    const food = this.getField(FieldType.FOOD)!;

    const { weights, lifecycle } = this.config;

    const consumption = new Float32Array(this.width * this.height);

    for (const p of this.particles) {
      if (!p.alive) continue;

      if (p.vx === undefined || isNaN(p.vx)) p.vx = 0;
      if (p.vy === undefined || isNaN(p.vy)) p.vy = 0;
      if (isNaN(p.energy)) p.energy = 0.5;

      const protectionBonus = this.structureManager.getProtectionBonus(
        p.x,
        p.y,
      );
      const metabolismReduction = protectionBonus * 0.5;

      const metabolismDrain = lifecycle.baseMetabolism * (1 - metabolismReduction);
      p.energy -= metabolismDrain;

      if (p.energy <= 0) {
        Logger.info(
          `[World] Particle ${p.id} died at tick ${this.tick}, energy=${p.energy.toFixed(3)}`,
        );
        p.alive = false;
        this.deaths++;
        continue;
      }

      // Variables for unused biological logic removed

      // Automatic osmosis feeding REMOVED. Agents must now Eat manually.
      // Water consumption REMOVED. Agents must drink manually.

      p.energy = Math.min(1.0, Math.max(0, p.energy));

      if (p.energy <= 0) {
        p.alive = false;
        this.deaths++;
        continue;
      }

      // Random structure stamping REMOVED. Agents must Build manually.

      const MAX_VELOCITY = 2.0;
      const VELOCITY_DAMPING = 0.85;
      const ACCELERATION = 0.3;

      let targetVx = 0;
      let targetVy = 0;

      // 1. Intent-based Movement (Target)
      if (p.targetX !== undefined && p.targetY !== undefined) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
          targetVx = (dx / dist) * MAX_VELOCITY;
          targetVy = (dy / dist) * MAX_VELOCITY;
        } else {
          // Arrived
          p.vx *= 0.1;
          p.vy *= 0.1;
        }
      } else {
        // 2. Default Gradient Movement (Drift/Explore)
        const dir = this.chooseDirectionInfinite(p, weights);
        targetVx = dir.dx * MAX_VELOCITY;
        targetVy = dir.dy * MAX_VELOCITY;
      }

      p.vx = p.vx * VELOCITY_DAMPING + targetVx * ACCELERATION;
      p.vy = p.vy * VELOCITY_DAMPING + targetVy * ACCELERATION;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > MAX_VELOCITY) {
        p.vx = (p.vx / speed) * MAX_VELOCITY;
        p.vy = (p.vy / speed) * MAX_VELOCITY;
      }

      const newX = p.x + p.vx;
      const newY = p.y + p.vy;

      if (this.isValidPosition(newX, newY)) {
        p.x = newX;
        p.y = newY;

        const movementMagnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        p.energy -= lifecycle.movementCost * movementMagnitude * 0.5;

        this.depositTrailInfinite(p);
      } else {
        p.vx *= -0.5;
        p.vy *= -0.5;
      }

      // Process agent reproduction flag (set by AgentBehavior)
      if (p.wantsToReproduce) {
        this.reproduce(p);
        p.wantsToReproduce = false; // Clear flag after processing
      }
      // NOTE: Water consumption and thirst are now handled in AgentBehavior.ts
      // to avoid duplicate resource consumption
    }

    const foodBuffer = food.getBuffer();
    for (let i = 0; i < consumption.length; i++) {
      foodBuffer[i] = Math.max(0, foodBuffer[i] - consumption[i]);
    }
  }

  /**
   * Elegir dirección de movimiento por gradiente - versión infinita
   * Usa getFieldValueAt para consultar campos fuera del área local
   * Incluye presión de crowding (evitar zonas densas) y exploration (buscar nuevas)
   */
  private chooseDirectionInfinite(
    p: Particle,
    weights: SimulationConfig["weights"],
  ): { dx: number; dy: number } {
    const DIRS = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ];

    let bestScore = -Infinity;
    let bestDir = { dx: 0, dy: 0 };

    const energyPressure = 1.0 - p.energy;
    const explorationBonus = weights.exploration * (1 + energyPressure);

    for (const dir of DIRS) {
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;

      if (!this.isValidPosition(nx, ny)) {
        continue;
      }

      const foodVal = this.getFieldValueAt(FieldType.FOOD, nx, ny);
      const waterVal = this.getFieldValueAt(FieldType.WATER, nx, ny);
      const trailVal = this.getFieldValueAt(FieldType.TRAIL0, nx, ny);
      const dangerVal = this.getFieldValueAt(FieldType.DANGER, nx, ny);
      const costVal = this.getFieldValueAt(FieldType.COST, nx, ny);
      const populationVal = this.getFieldValueAt(FieldType.POPULATION, nx, ny);

      const explorationVal = 1.0 - Math.min(1, trailVal * 2);

      const score =
        weights.food * foodVal +
        weights.water * waterVal +
        weights.trail * trailVal +
        weights.danger * dangerVal +
        weights.cost * costVal +
        weights.crowding * populationVal +
        explorationBonus * explorationVal +
        this.noise(p.seed, nx, ny) * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }

    return bestDir;
  }

  /**
   * Depositar trail según la firma de la partícula
   */
  private depositTrail(p: Particle): void {
    const sig = this.getSignature(p.seed);
    const trailFields = [
      this.getField(FieldType.TRAIL0)!,
      this.getField(FieldType.TRAIL1)!,
      this.getField(FieldType.TRAIL2)!,
      this.getField(FieldType.TRAIL3)!,
    ];

    const px = Math.floor(p.x);
    const py = Math.floor(p.y);

    for (let c = 0; c < 4; c++) {
      trailFields[c].add(px, py, sig[c] * 0.1);
    }
  }

  /**
   * Depositar trail en el mundo infinito
   * Si está dentro del área local, usa los fields locales
   * Si está fuera, actualiza el chunk correspondiente
   */
  private depositTrailInfinite(p: Particle): void {
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);

    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
      this.depositTrail(p);
      return;
    }

    if (this.infiniteChunks) {
      const sig = this.getSignature(p.seed);
      const chunkX = Math.floor(px / CHUNK_SIZE);
      const chunkY = Math.floor(py / CHUNK_SIZE);
      const chunk = this.infiniteChunks.ensureChunkActive(chunkX, chunkY);

      const localX = ((px % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((py % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

      chunk.getField(FieldType.TRAIL0)?.add(localX, localY, sig[0] * 0.1);
      chunk.getField(FieldType.TRAIL1)?.add(localX, localY, sig[1] * 0.1);
      chunk.getField(FieldType.TRAIL2)?.add(localX, localY, sig[2] * 0.1);
      chunk.getField(FieldType.TRAIL3)?.add(localX, localY, sig[3] * 0.1);
    }
  }

  /**
   * Obtener firma de 4 canales desde seed
   */
  private getSignature(seed: number): number[] {
    return [
      ((seed >> 0) & 0xff) / 255,
      ((seed >> 8) & 0xff) / 255,
      ((seed >> 16) & 0xff) / 255,
      ((seed >> 24) & 0xff) / 255,
    ];
  }

  /**
   * Reproducir partícula - REQUIERE recursos disponibles
   * Con cooldown para reproducción más espaciada y realista
   */
  private reproduce(parent: Particle): void {
    const { lifecycle } = this.config;

    // Reduced cooldown from 100 to 50 ticks for more dynamic population
    const REPRODUCTION_COOLDOWN = 50;
    if (
      parent.lastReproductionTick &&
      this.tick - parent.lastReproductionTick < REPRODUCTION_COOLDOWN
    ) {
      // Silent fail to reduce log spam
      return;
    }

    const foodHere = this.getFieldValueAt(FieldType.FOOD, parent.x, parent.y);
    const waterHere = this.getFieldValueAt(FieldType.WATER, parent.x, parent.y);

    // Lowered food requirement from 0.05 to 0.02
    if (foodHere < 0.02) {
      // Silent fail - too common to log
      return;
    }

    const waterBonus = Math.min(1.3, 0.7 + waterHere * 0.6);

    const aliveCount = this.particles.filter((p) => p.alive).length;
    const MAX_GLOBAL_POPULATION = 500;
    if (aliveCount >= MAX_GLOBAL_POPULATION) {
      Logger.warn(`[Reproduction] Failed: Max global population reached`);
      return;
    }

    const localDensity = this.particles.filter(
      (p) =>
        p.alive &&
        Math.abs(p.x - parent.x) <= 40 &&
        Math.abs(p.y - parent.y) <= 40,
    ).length;

    const MAX_LOCAL_DENSITY = 25;
    if (localDensity >= MAX_LOCAL_DENSITY) {
      Logger.warn(`[Reproduction] Failed: High local density (${localDensity})`);
      return;
    }

    const isFounder = parent.seed === 0x57455600 || parent.seed === 0x00495341;
    const founderBonus = isFounder ? 1.5 : 1.0;

    const resourceFactor = Math.min(1, foodHere * 2);
    const densityFactor = 1 - (localDensity / MAX_LOCAL_DENSITY) * 0.4;

    const reproductionChance =
      resourceFactor * densityFactor * waterBonus * founderBonus * 0.8;

    if (Math.random() > reproductionChance) {
      Logger.warn(`[Reproduction] Failed: Chance roll failed (Chance: ${reproductionChance.toFixed(3)})`);
      return;
    }

    const reproductionFoodCost = 0.15;
    this.setFieldValueAt(
      FieldType.FOOD,
      parent.x,
      parent.y,
      Math.max(0, foodHere - reproductionFoodCost),
    );

    parent.energy -= lifecycle.reproductionCost;

    let childSeed = parent.seed;
    for (let i = 0; i < 32; i++) {
      if (Math.random() < lifecycle.mutationRate) {
        childSeed ^= 1 << i;
      }
    }

    const angle = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * 4;
    const cx = Math.floor(parent.x + Math.cos(angle) * dist);
    const cy = Math.floor(parent.y + Math.sin(angle) * dist);

    const spawnFood = this.getFieldValueAt(FieldType.FOOD, cx, cy);
    if (!this.isValidPosition(cx, cy) || spawnFood < 0.1) {
      parent.energy += lifecycle.reproductionCost * 0.3;
      Logger.warn(`[Reproduction] Failed: Invalid spawn position or low food at target`);
      return;
    }

    Logger.info(`[Reproduction] SUCCESS! New agent created from parent ${parent.id}`);

    const newId = this.particleIdCounter++;

    const childEnergy = 0.35 + Math.random() * 0.15;

    this.particles.push({
      id: newId,
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      energy: childEnergy,
      seed: childSeed,
      name: `Child ${newId}`,
      alive: true,
      state: AgentState.IDLE,
      inventory: {},
      memory: {},
    });
    this.births++;
  }

  /**
   * Actualizar difusión/decay de campos
   */
  private updateFields(): void {
    for (const field of this.fields.values()) {
      field.diffuseDecayStep();
    }
  }

  /**
   * Crecimiento ESTRUCTURAL de árboles (SLOW rate)
   * Solo hace crecer los árboles, la producción de comida está en FAST
   */
  private updateTreeGrowth(): void {
    const trees = this.getField(FieldType.TREES)!;
    trees.growthStep();
  }

  /**
   * Producción de comida por árboles (FAST rate) - CICLO ECOLÓGICO
   * Los árboles producen comida cada tick para equilibrar consumo
   * FIXED: Reducido de 0.03 a 0.003 (10x menos) para evitar saturación
   * FIXED: Producción ahora depende de agua cercana
   */
  private updateFoodProduction(): void {
    const food = this.getField(FieldType.FOOD)!;
    const trees = this.getField(FieldType.TREES)!;
    const water = this.getField(FieldType.WATER)!;

    const treesBuffer = trees.getBuffer();
    const foodBuffer = food.getBuffer();
    const waterBuffer = water.getBuffer();

    // Reduced from 0.03 to 0.003 to prevent food saturation
    const baseProductionRate = 0.003;

    for (let i = 0; i < treesBuffer.length; i++) {
      if (treesBuffer[i] > 0.01) {
        // Trees near water produce more (up to 2x), trees without water produce less
        const waterFactor = Math.min(2.0, 0.5 + waterBuffer[i] * 1.5);
        const production = treesBuffer[i] * baseProductionRate * waterFactor;
        foodBuffer[i] = Math.min(
          food.config.maxValue,
          foodBuffer[i] + production,
        );
      }
    }
  }

  private updateGrowth(): void {
    this.updateTreeGrowth();
    this.updateFoodProduction();
  }

  /**
   * Actualizar campo de población
   */
  private updatePopulationField(): void {
    const pop = this.getField(FieldType.POPULATION)!;
    pop.fill(0);

    for (const p of this.particles) {
      if (p.alive) {
        pop.add(p.x, p.y, 1);
      }
    }
  }

  /**
   * Limpiar partículas muertas
   */
  private cleanDeadParticles(): void {
    this.particles = this.particles.filter((p) => p.alive);
  }

  /**
   * Ruido determinístico basado en seed y posición
   */
  private noise(seed: number, x: number, y: number): number {
    const n = seed * 374761393 + x * 668265263 + y * 1274126177;
    return ((n * n * n) >>> 0) / 0xffffffff - 0.5;
  }

  /**
   * Crear RNG con seed
   */
  private createRNG(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  getTick(): number {
    return this.tick;
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  getStructures(): StructureData[] {
    return this.structureManager.getStructuresForClient();
  }

  getStockpiles(): StockpileData[] {
    return this.stockpileManager.serialize();
  }

  getParticleCount(): number {
    return this.particles.filter((p) => p.alive).length;
  }

  isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  reset(): void {
    Logger.info("[World] Resetting simulation");
    this.tick = 0;
    this.particles = [];
    this.particleIdCounter = 0;
    this.births = 0;
    this.deaths = 0;

    for (const field of this.fields.values()) {
      field.fill(0);
    }

    this.generate(Date.now());
  }

  /**
   * Obtener métricas actuales
   */
  getMetrics(): SimulationMetrics {
    const fieldAverages: Record<FieldType, number> = {} as Record<
      FieldType,
      number
    >;

    for (const [type, field] of this.fields) {
      fieldAverages[type] = field.getAverage();
    }

    const structureStats = this.structureManager.getStats();
    const biodiversity = this.getBiodiversityMetrics();
    const emergence = this.getEmergenceMetrics();

    return {
      tick: this.tick,
      tickTimeMs: this.lastTickTime,
      particleCount: this.getParticleCount(),
      totalDensity: this.getField(FieldType.POPULATION)!.getSum(),
      activeChunks: 1,
      fieldAverages,
      births: this.births,
      deaths: this.deaths,
      structureStats,
      biodiversity,
      emergence,
    };
  }

  /**
   * Obtener métricas de emergencia para Prometheus
   */
  getEmergenceMetrics(): EmergenceSnapshot {
    const aliveParticles = this.particles.filter((p) => p.alive);
    const count = aliveParticles.length;

    if (count === 0) {
      return {
        complexity: 0,
        coherence: 0,
        adaptability: 0,
        sustainability: 0,
        entropy: 0,
        autopoiesis: 0,
        novelty: 0,
        stability: 0,
      };
    }

    const seedSet = new Set(aliveParticles.map((p) => p.seed));
    const complexity = Math.min(1, seedSet.size / Math.max(count, 1));

    const communities = this.communities.getAll();
    const coherence =
      communities.length > 0
        ? Math.min(1, communities.length / Math.sqrt(count))
        : 0;

    const avgEnergy =
      aliveParticles.reduce((s, p) => s + (p.energy ?? 0), 0) / count;
    const adaptability = Math.min(1, avgEnergy / 100);

    const totalEvents = this.births + this.deaths;
    const sustainability = totalEvents > 0 ? this.births / totalEvents : 0.5;

    const avgX = aliveParticles.reduce((s, p) => s + p.x, 0) / count;
    const avgY = aliveParticles.reduce((s, p) => s + p.y, 0) / count;
    const varX =
      aliveParticles.reduce((s, p) => s + (p.x - avgX) ** 2, 0) / count;
    const varY =
      aliveParticles.reduce((s, p) => s + (p.y - avgY) ** 2, 0) / count;
    const maxVar = (this.width * this.height) / 4;
    const entropy = Math.min(1, Math.sqrt(varX + varY) / Math.sqrt(maxVar));

    const autopoiesis =
      count > 0
        ? Math.min(1, ((this.births / Math.max(this.tick, 1)) * 100) / count)
        : 0;

    const novelty = Math.min(
      1,
      (this.births + this.deaths) / Math.max(count, 1),
    );

    const tensionStats = this.tension.getStats();
    const stability = 1 - Math.min(1, tensionStats.average);

    return {
      complexity,
      coherence,
      adaptability,
      sustainability,
      entropy,
      autopoiesis,
      novelty,
      stability,
    };
  }

  /**
   * Obtener métricas de biodiversidad
   */
  getBiodiversityMetrics(): BiodiversitySnapshot {
    const aliveParticles = this.particles.filter((p) => p.alive);

    const behaviorCounts: Record<string, number> = {
      forager: 0,
      hunter: 0,
      nomad: 0,
      settler: 0,
    };

    for (const p of aliveParticles) {
      const type = this.getBehaviorType(p.seed);
      behaviorCounts[type] = (behaviorCounts[type] || 0) + 1;
    }

    const total = aliveParticles.length;

    let shannon = 0;
    if (total > 0) {
      for (const count of Object.values(behaviorCounts)) {
        if (count > 0) {
          const p = count / total;
          shannon -= p * Math.log(p);
        }
      }
    }

    let dominantType = "forager";
    let dominantCount = 0;
    for (const [type, count] of Object.entries(behaviorCounts)) {
      if (count > dominantCount) {
        dominantType = type;
        dominantCount = count;
      }
    }

    return {
      behaviorCounts,
      shannonIndex: shannon,
      speciesRichness: Object.values(behaviorCounts).filter((c) => c > 0)
        .length,
      dominantType,
      dominantRatio: total > 0 ? dominantCount / total : 0,
    };
  }

  /**
   * Obtener tipo de comportamiento desde seed
   */
  private getBehaviorType(seed: number): string {
    const type = (seed >> 4) & 0b11;
    switch (type) {
      case 0:
        return "forager";
      case 1:
        return "hunter";
      case 2:
        return "nomad";
      case 3:
        return "settler";
      default:
        return "forager";
    }
  }

  /**
   * Obtener métricas sociales
   */
  getSocialMetrics(): {
    communities: number;
    communitySizes: number[];
    communityStability: number;
    cohesion: number;
    tension: number;
    conflictsActive: number;
    relationships: Record<string, number>;
  } {
    const allCommunities = this.communities.getAll();
    const tensionStats = this.tension.getStats();
    const conflicts = this.tension.getRecentConflicts();

    return {
      communities: allCommunities.length,
      communitySizes: allCommunities.map((c) => c.members.length),
      communityStability:
        allCommunities.length > 0
          ? allCommunities.reduce((s, c) => s + Math.min(1, c.age / 1000), 0) /
          allCommunities.length
          : 0,
      cohesion:
        allCommunities.length > 0
          ? allCommunities.reduce(
            (s, c) => s + c.population / (c.radius * c.radius || 1),
            0,
          ) /
          allCommunities.length /
          10
          : 0,
      tension: tensionStats.average,
      conflictsActive: conflicts.length,
      relationships: {
        cooperation: allCommunities.reduce((s, c) => s + c.members.length, 0),
        conflict: conflicts.length,
      },
    };
  }

  /**
   * Obtener métricas económicas
   */
  getEconomyMetrics(): {
    energyFlow: number;
    scarcityIndex: number;
    stockpiles: Record<string, number>;
    production: Record<string, number>;
    consumption: Record<string, number>;
  } {
    const aliveParticles = this.particles.filter((p) => p.alive);
    const totalEnergy = aliveParticles.reduce((s, p) => s + (p.energy ?? 0), 0);
    const previousEnergy = this.particles.length * 50;

    const foodField = this.getField(FieldType.FOOD);
    const waterField = this.getField(FieldType.WATER);
    const foodAvg = foodField?.getAverage() ?? 0;
    const waterAvg = waterField?.getAverage() ?? 0;

    const scarcityIndex = 1 - Math.min(1, (foodAvg + waterAvg) / 2);

    return {
      energyFlow: totalEnergy - previousEnergy,
      scarcityIndex,
      stockpiles: {
        energy: totalEnergy,
        food: foodField?.getSum() ?? 0,
        water: waterField?.getSum() ?? 0,
      },
      production: {
        food: this.births * 10,
      },
      consumption: {
        food: this.deaths * 5,
      },
    };
  }

  /**
   * Obtener métricas de tiempo
   */
  getTimeMetrics(): {
    timeOfDay: number;
    dayNumber: number;
    phase: number;
    season: number;
    seasonProgress: number;
    lunarPhase: number;
  } {
    const ticksPerDay = 200;
    const ticksPerSeason = ticksPerDay * 10;

    const dayProgress = (this.tick % ticksPerDay) / ticksPerDay;
    const dayNumber = Math.floor(this.tick / ticksPerDay);
    const season = Math.floor((this.tick / ticksPerSeason) % 4);
    const seasonProgress = (this.tick % ticksPerSeason) / ticksPerSeason;
    const lunarPhase = (this.tick % (ticksPerDay * 30)) / (ticksPerDay * 30);

    let phase = 0;
    if (dayProgress < 0.2) phase = 0;
    else if (dayProgress < 0.3) phase = 1;
    else if (dayProgress < 0.7) phase = 2;
    else if (dayProgress < 0.8) phase = 3;
    else phase = 0;

    return {
      timeOfDay: dayProgress,
      dayNumber,
      phase,
      season,
      seasonProgress,
      lunarPhase,
    };
  }

  /**
   * Obtener métricas de quests (placeholder)
   */
  getQuestMetrics(): {
    active: Record<string, number>;
    progress: number;
  } {
    return {
      active: {
        community_growth: 0,
        survival: 0,
        exploration: 0,
      },
      progress: 0,
    };
  }

  /**
   * Obtener métricas de campos
   */
  getFieldMetrics(): Array<{
    fieldType: string;
    avgIntensity: number;
    maxIntensity: number;
    coverage: number;
    gradientStrength: number;
    decayRate: number;
  }> {
    const result: Array<{
      fieldType: string;
      avgIntensity: number;
      maxIntensity: number;
      coverage: number;
      gradientStrength: number;
      decayRate: number;
    }> = [];

    for (const [type, field] of this.fields) {
      const buffer = field.getBuffer();
      let max = 0;
      let nonZero = 0;
      let gradSum = 0;

      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] > max) max = buffer[i];
        if (buffer[i] > 0.001) nonZero++;
      }

      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const i = y * this.width + x;
          const gx = (buffer[i + 1] - buffer[i - 1]) / 2;
          const gy = (buffer[i + this.width] - buffer[i - this.width]) / 2;
          gradSum += Math.sqrt(gx * gx + gy * gy);
        }
      }

      result.push({
        fieldType: type,
        avgIntensity: field.getAverage(),
        maxIntensity: max,
        coverage: nonZero / buffer.length,
        gradientStrength: gradSum / buffer.length,
        decayRate: field.config.decay ?? 0.01,
      });
    }

    return result;
  }

  /**
   * Obtener snapshot de campo para enviar al frontend
   */
  getFieldSnapshot(type: FieldType): Float32Array | undefined {
    return this.getField(type)?.getBuffer();
  }
}
