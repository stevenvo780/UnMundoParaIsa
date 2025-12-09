/**
 * World - Gestiona todos los campos y la simulación global
 * Integra: Chunks, Scheduler, Economy, Social, Narrative, Scale
 */

import { Field } from './Field.js';
import { ChunkManager } from './ChunkManager.js';
import { Scheduler } from './Scheduler.js';
import { 
  FieldType, 
  FieldConfig, 
  DEFAULT_FIELD_CONFIGS,
  SimulationConfig,
  DEFAULT_CONFIG,
  SimulationMetrics,
  Particle,
  idx,
} from '../types.js';

// Economy
import { DemandManager } from '../economy/Demand.js';
import { ReactionProcessor } from '../economy/Reactions.js';
import { ResourceFlowSystem } from '../economy/Advection.js';
import { StockpileManager } from '../economy/Stockpiles.js';

// Social
import { getSignature, SignatureField } from '../social/Signatures.js';
import { CommunityDetector } from '../social/Communities.js';
import { TensionField } from '../social/Tension.js';

// Narrative
import { SemanticFieldManager } from '../narrative/SemanticFields.js';
import { ArtifactManager } from '../narrative/Artifacts.js';
import { EventManager, WorldState } from '../narrative/Events.js';
import { MaterializationManager } from '../narrative/Materialization.js';

// Scale
import { FlowFieldManager } from '../scale/FlowFields.js';
import { LODManager } from '../scale/LOD.js';
import { ThermostatBank, WorldBalancer } from '../scale/Thermostats.js';
import { InfiniteChunkManager } from './InfiniteChunkManager.js';
import { CHUNK_SIZE } from './Chunk.js';

// Structures
import { StructureManager } from './StructureManager.js';

export class World {
  readonly width: number;
  readonly height: number;
  readonly config: SimulationConfig;
  
  // Referencia al chunk manager infinito (inyectado desde server)
  private infiniteChunks?: InfiniteChunkManager;
  
  // Sistema de estructuras emergentes
  private structureManager!: StructureManager;
  
  // Core
  private fields: Map<FieldType, Field> = new Map();
  private particles: Particle[] = [];
  private particleIdCounter = 0;
  
  private tick = 0;
  private paused = false;
  private lastTickTime = 0;
  
  // Métricas
  private births = 0;
  private deaths = 0;
  
  // === Nuevos sistemas integrados ===
  
  // Core - Chunks y Scheduler
  private chunkManager!: ChunkManager;
  private scheduler!: Scheduler;
  
  // Economy
  private demandManager!: DemandManager;
  private reactionProcessor!: ReactionProcessor;
  private resourceFlow!: ResourceFlowSystem;
  private stockpiles!: StockpileManager;
  
  // Social
  private communities!: CommunityDetector;
  private tension!: TensionField;
  
  // Narrative
  private semanticFields!: SemanticFieldManager;
  private artifacts!: ArtifactManager;
  private events!: EventManager;
  private materialization!: MaterializationManager;
  
  // Scale
  private flowFields!: FlowFieldManager;
  private lod!: LODManager;
  private thermostats!: ThermostatBank;
  private balancer!: WorldBalancer;
  
  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.width = this.config.worldWidth;
    this.height = this.config.worldHeight;
    
    // Inicializar campos base
    this.initializeFields();
    
    // Inicializar sistemas
    this.initializeSystems();
  }
  
  /**
   * Inicializar todos los subsistemas
   */
  private initializeSystems(): void {
    // Core
    this.chunkManager = new ChunkManager();
    this.scheduler = new Scheduler();
    
    // Economy
    this.demandManager = new DemandManager(this.width, this.height);
    this.reactionProcessor = new ReactionProcessor();
    this.resourceFlow = new ResourceFlowSystem(this.width, this.height, ['food', 'water', 'stone']);
    this.stockpiles = new StockpileManager(this.width, this.height);
    
    // Social
    this.communities = new CommunityDetector();
    this.tension = new TensionField(this.width, this.height);
    
    // Narrative
    this.semanticFields = new SemanticFieldManager(this.width, this.height);
    this.artifacts = new ArtifactManager(this.width, this.height);
    this.events = new EventManager();
    this.materialization = new MaterializationManager();
    
    // Scale
    this.flowFields = new FlowFieldManager();
    this.lod = new LODManager();
    this.thermostats = new ThermostatBank();
    this.balancer = new WorldBalancer(this.thermostats);
    
    // Structures
    this.structureManager = new StructureManager();
    
    // Registrar tareas en scheduler
    this.registerScheduledTasks();
    
    console.log('[World] Todos los sistemas inicializados');
  }
  
  /**
   * Registrar tareas con diferentes frecuencias
   */
  private registerScheduledTasks(): void {
    // FAST (cada tick): movimiento partículas, consumo
    this.scheduler.register({
      id: 'particles',
      rate: 'FAST',
      fn: () => this.updateParticles(),
      priority: 1
    });
    this.scheduler.register({
      id: 'fields',
      rate: 'FAST',
      fn: () => this.updateFields(),
      priority: 2
    });
    
    // MEDIUM (cada 5 ticks): economía, social
    this.scheduler.register({
      id: 'economy',
      rate: 'MEDIUM',
      fn: () => this.updateEconomy(),
      priority: 10
    });
    this.scheduler.register({
      id: 'social',
      rate: 'MEDIUM',
      fn: () => this.updateSocial(),
      priority: 11
    });
    
    // SLOW (cada 20 ticks): narrativa, escala, termostatos, estructuras
    this.scheduler.register({
      id: 'narrative',
      rate: 'SLOW',
      fn: () => this.updateNarrative(),
      priority: 20
    });
    this.scheduler.register({
      id: 'scale',
      rate: 'SLOW',
      fn: () => this.updateScale(),
      priority: 21
    });
    this.scheduler.register({
      id: 'thermostats',
      rate: 'SLOW',
      fn: () => this.updateThermostats(),
      priority: 22
    });
    this.scheduler.register({
      id: 'structures',
      rate: 'SLOW',
      fn: () => this.structureManager.update(this.tick),
      priority: 23
    });
  }
  
  // === Métodos de actualización por subsistema ===
  
  /**
   * Actualizar economía (MEDIUM rate)
   * Integra: Demand, Reactions, Advection, Stockpiles
   */
  private updateEconomy(): void {
    // 1. Obtener campos necesarios
    const populationField = this.getField('population')?.getBuffer();
    const laborField = this.getField('labor')?.getBuffer();
    const foodField = this.getField('food');
    const waterField = this.getField('water');
    
    if (!populationField || !foodField || !waterField) return;
    
    // 2. Actualizar campos de demanda
    const resourceFields = new Map<string, Float32Array>();
    resourceFields.set('food', foodField.getBuffer());
    resourceFields.set('water', waterField.getBuffer());
    
    const treesField = this.getField('trees');
    const stoneField = this.getField('stone');
    if (treesField) resourceFields.set('trees', treesField.getBuffer());
    if (stoneField) resourceFields.set('stone', stoneField.getBuffer());
    
    this.demandManager.update(populationField, resourceFields);
    
    // 3. Procesar reacciones donde hay labor
    if (laborField) {
      // Crear snapshot de recursos locales
      for (let y = 0; y < this.height; y += 8) {  // Muestreo cada 8 celdas
        for (let x = 0; x < this.width; x += 8) {
          const i = y * this.width + x;
          if (laborField[i] > 0.1) {
            // Crear contexto de recursos locales
            const localResources: Record<string, number> = {
              food: foodField.get(x, y),
              water: waterField.get(x, y),
            };
            
            const labor = laborField[i];
            const buildings = new Set<string>();  // TODO: sistema de edificios
            const population = populationField[i];
            const fieldValues: Record<string, number> = { ...localResources };
            
            // Probar cada reacción
            for (const reaction of this.reactionProcessor.getReactions()) {
              if (this.reactionProcessor.canExecute(
                reaction, localResources, labor, buildings, population, fieldValues
              )) {
                // Ejecutar y aplicar outputs
                const result = this.reactionProcessor.execute(reaction, localResources, labor);
                if (result.executed) {
                  for (const [resource, amount] of Object.entries(result.produced)) {
                    const field = this.getField(resource as FieldType);
                    if (field) {
                      field.add(x, y, (amount as number) * 0.01);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // 4. Advección de recursos (flujo hacia demanda)
    const foodDemand = this.demandManager.getDemandField('food');
    if (foodDemand) {
      // Construir arrays de gradiente
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
        'food',
        gradX,
        gradY,
        foodField.getBuffer()
      );
      // Copiar valores advectados de vuelta al campo
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
    // 1. Obtener campos necesarios
    const populationField = this.getField('population')?.getBuffer();
    const foodField = this.getField('food')?.getBuffer();
    const waterField = this.getField('water')?.getBuffer();
    
    if (!populationField || !foodField || !waterField) return;
    
    // 2. Construir SignatureField desde partículas
    const signatureField = this.buildSignatureField();
    
    // 3. Detectar comunidades
    this.communities.detect(
      this.particles,
      populationField,
      this.width,
      this.height
    );
    
    // 4. Calcular tensión social
    this.tension.calculate(
      signatureField,
      populationField,
      { food: foodField, water: waterField }
    );
    
    // 5. Detectar y procesar conflictos si hay alta tensión
    const conflicts = this.tension.detectConflicts(this.tick);
    for (const conflict of conflicts) {
      // Dispersar partículas en zona de conflicto
      const radius = 5;
      for (const particle of this.particles) {
        if (!particle.alive) continue;
        const dx = particle.x - conflict.x;
        const dy = particle.y - conflict.y;
        if (Math.sqrt(dx * dx + dy * dy) < radius) {
          // Dispersar: mover hacia afuera
          const angle = Math.atan2(dy, dx);
          particle.x += Math.cos(angle) * 2;
          particle.y += Math.sin(angle) * 2;
          particle.energy -= 0.1 * conflict.tension;  // Desgaste por conflicto
        }
      }
    }
  }
  
  /**
   * Construir SignatureField desde partículas
   * Crea una estructura compatible con TensionField.calculate()
   */
  private buildSignatureField(): SignatureField {
    const field = new SignatureField(this.width, this.height);
    
    // Depositar firmas de partículas
    for (const p of this.particles) {
      if (!p.alive) continue;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
      
      // Convertir seed a signature
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
    // 1. Actualizar campos semánticos
    this.semanticFields.step();
    
    // 2. Actualizar artefactos
    this.artifacts.update();
    
    // 3. Construir estado actual para eventos
    const allCommunities = this.communities.getAll();
    const tensionStats = this.tension.getStats();
    const conflicts = this.tension.getRecentConflicts();
    
    const worldState: WorldState = {
      tick: this.tick,
      particles: this.particles,
      births: this.births,
      deaths: this.deaths,
      communities: allCommunities.map(c => ({
        id: c.id,
        population: c.population,
        x: c.centerX,
        y: c.centerY,
      })),
      conflicts: conflicts.map(c => ({
        x: c.x,
        y: c.y,
        tension: c.tension,
      })),
      artifacts: this.artifacts.getAll(),
    };
    
    // 4. Procesar eventos narrativos
    const events = this.events.process(worldState, this.previousWorldState || worldState);
    this.previousWorldState = worldState;
    
    // 5. Materializar personajes de partículas longevas
    this.materialization.setTick(this.tick);
    for (const particle of this.particles) {
      if (!particle.alive) continue;
      
      // Usar tick actual como estimación de edad (tick - estimated birth)
      const estimatedAge = Math.floor(particle.energy * 1000);  // Aproximación
      if (this.materialization.canMaterialize(particle, estimatedAge)) {
        const character = this.materialization.materialize(particle, estimatedAge);
        console.log(`[Narrative] Personaje materializado: ${character.name}`);
      }
    }
    
    // 6. Aplicar efectos semánticos al mundo
    this.applySemanticEffects();
  }
  
  // Estado anterior para comparación de eventos
  private previousWorldState?: WorldState;
  
  /**
   * Aplicar efectos de campos semánticos al mundo
   */
  private applySemanticEffects(): void {
    const joyField = this.semanticFields.getField('joy');
    const nostalgiaField = this.semanticFields.getField('nostalgia');
    
    if (!joyField || !nostalgiaField) return;
    
    // Joy aumenta reproducción, nostalgia reduce movimiento
    for (const particle of this.particles) {
      if (!particle.alive) continue;
      
      const x = Math.floor(particle.x);
      const y = Math.floor(particle.y);
      
      const joy = joyField.get(x, y);
      const nostalgia = nostalgiaField.get(x, y);
      
      // Bonus de energía por joy
      if (joy > 0.5) {
        particle.energy += 0.01 * joy;
      }
      
      // Reducir velocidad por nostalgia (simulado con energía)
      if (nostalgia > 0.5) {
        // Las partículas en zonas nostálgicas tienden a quedarse
        particle.energy = Math.min(particle.energy, 0.8);  // Cap de energía
      }
    }
  }
  
  /**
   * Actualizar sistemas de escala (SLOW rate)
   * Integra: FlowFields, LOD
   */
  private updateScale(): void {
    // 1. Actualizar FlowFields desde campos de recursos
    const food = this.getField('food');
    const water = this.getField('water');
    
    if (food) {
      this.flowFields.updateFromField('food', food.getBuffer());
    }
    if (water) {
      this.flowFields.updateFromField('water', water.getBuffer());
    }
    
    // 2. Actualizar LOD (Level of Detail)
    // Agregar puntos de foco basados en comunidades activas
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
    
    // Recalcular niveles LOD
    this.lod.updateLevels();
  }
  
  /**
   * Actualizar termostatos (SLOW rate)
   */
  private updateThermostats(): void {
    const particleCount = this.getParticleCount();
    const foodAvg = this.getField('food')?.getAverage() ?? 0.5;
    const avgEnergy = this.particles.reduce((sum, p) => sum + (p.alive ? p.energy : 0), 0) / Math.max(1, particleCount);
    
    // Actualizar termostatos
    this.thermostats.updateAll({
      population: particleCount,
      resources: foodAvg,
      energy: avgEnergy
    });
    
    // Obtener parámetros ajustados para uso futuro
    const _params = this.balancer.getAdjustedParameters();
  }
  
  /**
   * Inicializar campos según configuración
   */
  private initializeFields(): void {
    const fieldsToCreate: FieldType[] = [
      'food', 'water', 'cost', 'danger', 'trees', 'stone',
      'trail0', 'trail1', 'trail2', 'trail3',
      'population', 'labor'
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
    console.log('[World] InfiniteChunkManager inyectado para soporte de mundo infinito');
  }
  
  /**
   * Obtener valor de campo en cualquier coordenada (soporta infinito)
   * Si está fuera del campo original, consulta al chunk manager
   */
  getFieldValueAt(type: FieldType, x: number, y: number): number {
    // Truncar coordenadas a enteros
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    
    // Primero intentar en el campo local
    if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height) {
      const field = this.fields.get(type);
      return field ? field.get(ix, iy) : 0;
    }
    
    // Fuera del rango local: consultar chunk infinito
    if (this.infiniteChunks) {
      const chunk = this.infiniteChunks.getChunkAt(ix, iy);
      if (chunk) {
        const localX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((iy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.getValue(type, localX, localY);
      }
      // Si no hay chunk, generarlo
      const newChunk = this.infiniteChunks.ensureChunkActive(
        Math.floor(ix / CHUNK_SIZE),
        Math.floor(iy / CHUNK_SIZE)
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
    // Truncar coordenadas a enteros
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    
    // En campo local
    if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height) {
      const field = this.fields.get(type);
      if (field) field.set(ix, iy, value);
      return;
    }
    
    // En chunk infinito
    if (this.infiniteChunks) {
      const chunk = this.infiniteChunks.ensureChunkActive(
        Math.floor(ix / CHUNK_SIZE),
        Math.floor(iy / CHUNK_SIZE)
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
    // Con mundo infinito, todo es válido
    if (this.infiniteChunks) return true;
    // Sin mundo infinito, limitar al área original
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
  
  /**
   * Generar mundo inicial con oases
   */
  generate(seed: number = this.config.seed): void {
    const rng = this.createRNG(seed);
    
    // Generar oases de comida
    const foodField = this.getField('food')!;
    const waterField = this.getField('water')!;
    const treesField = this.getField('trees')!;
    const costField = this.getField('cost')!;
    
    // Base noise para terreno
    costField.initWithNoise(0.3, 0.2, seed);
    
    // Crear oases
    const oasisCount = 5;
    const oases: Array<{ x: number; y: number; radius: number; value: number }> = [];
    
    for (let i = 0; i < oasisCount; i++) {
      oases.push({
        x: Math.floor(rng() * this.width * 0.8 + this.width * 0.1),
        y: Math.floor(rng() * this.height * 0.8 + this.height * 0.1),
        radius: 30 + Math.floor(rng() * 30),
        value: 0.8 + rng() * 0.2,
      });
    }
    
    // Oasis central garantizado
    oases.push({
      x: Math.floor(this.width / 2),
      y: Math.floor(this.height / 2),
      radius: 50,
      value: 1.0,
    });
    
    foodField.initWithOases(oases);
    
    // Debug food
    const foodSum = foodField.getSum();
    const foodMax = foodField.getMax();
    console.log(`[World] Food field: sum=${foodSum.toFixed(2)}, max=${foodMax.toFixed(3)}, size=${foodField.width}x${foodField.height}`);
    
    // Agua en algunos oases - usar oases más grandes
    const waterOases = oases.slice(0, 3).map(o => {
      console.log(`[World] Water oasis: x=${o.x}, y=${o.y}, radius=${(o.radius * 0.7).toFixed(1)} (field size: ${waterField.width}x${waterField.height})`);
      return {
        ...o,
        radius: Math.max(20, o.radius * 0.7), // Mínimo 20 de radio
        value: 0.9,
      };
    });
    waterField.initWithOases(waterOases);
    
    // Debug: verificar agua
    const waterSum = waterField.getSum();
    const waterMax = waterField.getMax();
    console.log(`[World] Water field: sum=${waterSum.toFixed(2)}, max=${waterMax.toFixed(3)}, oases=${waterOases.length}`);
    
    // Árboles dispersos
    treesField.initWithNoise(0.3, 0.3, seed + 1000);
    
    // Spawn partículas iniciales en el centro
    this.spawnParticlesAt(
      Math.floor(this.width / 2),
      Math.floor(this.height / 2),
      50,
      seed
    );
    
    console.log(`[World] Generated with ${oases.length} oases, ${this.particles.length} particles`);
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
          vx: 0,  // Velocidad inicial
          vy: 0,
          energy: 0.5 + rng() * 0.3,
          seed: Math.floor(rng() * 0xFFFFFFFF),
          alive: true,
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
    
    // Reset contadores
    this.births = 0;
    this.deaths = 0;
    
    // Ejecutar scheduler (gestiona FAST/MEDIUM/SLOW)
    const schedulerMetrics = this.scheduler.step();
    
    // 3. Crecimiento de recursos (siempre, por ahora fuera del scheduler)
    this.updateGrowth();
    
    // 4. Actualizar campo de población
    this.updatePopulationField();
    
    // 5. Limpiar partículas muertas
    this.cleanDeadParticles();

    this.tick++;
    this.lastTickTime = performance.now() - startTime;
    
    // Log cada 100 ticks para monitoreo
    if (this.tick % 100 === 0) {
      const alive = this.particles.filter(p => p.alive).length;
      const energySum = this.particles.reduce((s, p) => {
        const energy = p.alive ? (p.energy ?? 0) : 0;
        return s + (isNaN(energy) ? 0 : energy);
      }, 0);
      const avgEnergy = alive > 0 ? energySum / alive : 0;
      const foodSum = this.getField('food')?.getSum() ?? 0;
      console.log(`[World] Tick ${this.tick} | Alive: ${alive} | AvgEnergy: ${avgEnergy.toFixed(3)} | Food: ${foodSum.toFixed(0)} | Births: ${this.births} | Deaths: ${this.deaths}`);
    }
  }  /**
   * Actualizar todas las partículas
   * NOTA: Usa getFieldValueAt para soporte de mundo infinito
   */
  private updateParticles(): void {
    const food = this.getField('food')!;
    const water = this.getField('water')!;
    const trail0 = this.getField('trail0')!;
    const danger = this.getField('danger')!;
    const cost = this.getField('cost')!;
    
    const { weights, lifecycle } = this.config;
    
    // Buffer de consumo (solo para área local)
    const consumption = new Float32Array(this.width * this.height);
    
    for (const p of this.particles) {
      if (!p.alive) continue;
      
      // === INICIALIZAR VELOCIDAD SI NO EXISTE ===
      if (p.vx === undefined || isNaN(p.vx)) p.vx = 0;
      if (p.vy === undefined || isNaN(p.vy)) p.vy = 0;
      if (isNaN(p.energy)) p.energy = 0.5;
      
      // === PROTECCIÓN DE ESTRUCTURAS ===
      // Las partículas cerca de estructuras gastan menos energía
      const protectionBonus = this.structureManager.getProtectionBonus(p.x, p.y);
      const metabolismReduction = protectionBonus * 0.5; // Hasta 50% menos metabolismo
      
      // Metabolismo base (reducido si hay protección)
      p.energy -= lifecycle.baseMetabolism * (1 - metabolismReduction);
      
      // Muerte por falta de energía
      if (p.energy <= 0) {
        p.alive = false;
        this.deaths++;
        if (this.tick % 100 === 0 || this.deaths <= 3) {
          console.log(`[Death] Particle ${p.id} died at (${p.x},${p.y}) - tick ${this.tick}`);
        }
        continue;
      }
      
      // Consumir recursos - usar getFieldValueAt para soporte infinito
      // (getFieldValueAt ya trunca coordenadas internamente)
      const foodHere = this.getFieldValueAt('food', p.x, p.y);
      const waterHere = this.getFieldValueAt('water', p.x, p.y);
      
      const consume = Math.min(0.1, foodHere) * lifecycle.consumptionEfficiency;
      p.energy += consume;
      
      // Truncar posición para índices
      const px = Math.floor(p.x);
      const py = Math.floor(p.y);
      
      // Solo actualizar buffer de consumo si está en área local
      if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
        consumption[idx(px, py, this.width)] += consume / lifecycle.consumptionEfficiency;
      } else {
        // En chunks infinitos, reducir directamente el valor
        const newFoodValue = Math.max(0, foodHere - consume / lifecycle.consumptionEfficiency);
        this.setFieldValueAt('food', p.x, p.y, newFoodValue);
      }
      
      // También necesita agua
      if (waterHere < 0.1) {
        p.energy -= 0.005; // Deshidratación
      }
      
      // Clamp energía
      p.energy = Math.min(1.0, p.energy);
      
      // === INTENTAR CONSTRUIR ESTRUCTURA ===
      // Partículas con alta energía en zonas frecuentadas construyen
      if (p.energy > 0.65 && Math.random() < 0.08) {
        const trailHere = this.getFieldValueAt('trail0', p.x, p.y);
        this.structureManager.tryCreateStructure(
          p.x, p.y, trailHere, foodHere, p.energy, p.id, this.tick
        );
      }
      
      // === MOVIMIENTO FLUIDO CON VELOCIDAD ===
      // Calcular dirección objetivo por gradiente
      const dir = this.chooseDirectionInfinite(p, weights);
      
      // Convertir dirección discreta a velocidad objetivo
      const MAX_VELOCITY = 2.0;
      const VELOCITY_DAMPING = 0.85;
      const ACCELERATION = 0.3;
      
      const targetVx = dir.dx * MAX_VELOCITY;
      const targetVy = dir.dy * MAX_VELOCITY;
      
      // Interpolar velocidad actual hacia objetivo (suavizado)
      p.vx = p.vx * VELOCITY_DAMPING + targetVx * ACCELERATION;
      p.vy = p.vy * VELOCITY_DAMPING + targetVy * ACCELERATION;
      
      // Clamp velocidad máxima
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > MAX_VELOCITY) {
        p.vx = (p.vx / speed) * MAX_VELOCITY;
        p.vy = (p.vy / speed) * MAX_VELOCITY;
      }
      
      // Aplicar velocidad a posición
      const newX = p.x + p.vx;
      const newY = p.y + p.vy;
      
      // Permitir movimiento infinito
      if (this.isValidPosition(newX, newY)) {
        p.x = newX;
        p.y = newY;
        
        // Coste de movimiento proporcional a velocidad
        const movementMagnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        p.energy -= lifecycle.movementCost * movementMagnitude * 0.5;
        
        // Depositar trail
        this.depositTrailInfinite(p);
      } else {
        // Rebote suave en límites inválidos
        p.vx *= -0.5;
        p.vy *= -0.5;
      }
      
      // Reproducción
      if (p.energy >= lifecycle.reproductionThreshold) {
        this.reproduce(p);
      }
    }
    
    // Aplicar consumo al campo de comida
    const foodBuffer = food.getBuffer();
    for (let i = 0; i < consumption.length; i++) {
      foodBuffer[i] = Math.max(0, foodBuffer[i] - consumption[i]);
    }
  }
  
  /**
   * Elegir dirección de movimiento por gradiente
   */
  private chooseDirection(
    p: Particle,
    weights: SimulationConfig['weights'],
    food: Field,
    water: Field,
    trail: Field,
    danger: Field,
    cost: Field
  ): { dx: number; dy: number } {
    const DIRS = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
    ];
    
    let bestScore = -Infinity;
    let bestDir = { dx: 0, dy: 0 };
    
    for (const dir of DIRS) {
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;
      
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
        continue;
      }
      
      const score =
        weights.food * food.get(nx, ny) +
        weights.water * water.get(nx, ny) +
        weights.trail * trail.get(nx, ny) +
        weights.danger * danger.get(nx, ny) +
        weights.cost * cost.get(nx, ny) +
        this.noise(p.seed, nx, ny) * 0.1;
      
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    
    return bestDir;
  }
  
  /**
   * Elegir dirección de movimiento por gradiente - versión infinita
   * Usa getFieldValueAt para consultar campos fuera del área local
   * Incluye presión de crowding (evitar zonas densas) y exploration (buscar nuevas)
   */
  private chooseDirectionInfinite(
    p: Particle,
    weights: SimulationConfig['weights']
  ): { dx: number; dy: number } {
    const DIRS = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
    ];
    
    let bestScore = -Infinity;
    let bestDir = { dx: 0, dy: 0 };
    
    // Factor de presión: cuando energía baja, aumenta exploración
    const energyPressure = 1.0 - p.energy;  // 0 cuando lleno, 1 cuando hambriento
    const explorationBonus = weights.exploration * (1 + energyPressure);
    
    for (const dir of DIRS) {
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;
      
      // No limitar a bordes del mundo - ahora es infinito
      if (!this.isValidPosition(nx, ny)) {
        continue;
      }
      
      // Obtener valores de campo
      const foodVal = this.getFieldValueAt('food', nx, ny);
      const waterVal = this.getFieldValueAt('water', nx, ny);
      const trailVal = this.getFieldValueAt('trail0', nx, ny);
      const dangerVal = this.getFieldValueAt('danger', nx, ny);
      const costVal = this.getFieldValueAt('cost', nx, ny);
      const populationVal = this.getFieldValueAt('population', nx, ny);
      
      // Calcular score con crowding y exploration
      // - crowding: evitar zonas con alta densidad de población
      // - exploration: bonus por bajo trail (zonas no visitadas)
      const explorationVal = 1.0 - Math.min(1, trailVal * 2);  // 1 si no hay trail, 0 si hay mucho
      
      const score =
        weights.food * foodVal +
        weights.water * waterVal +
        weights.trail * trailVal +
        weights.danger * dangerVal +
        weights.cost * costVal +
        weights.crowding * populationVal +  // Negativo: evitar zonas pobladas
        explorationBonus * explorationVal + // Positivo: buscar zonas nuevas
        this.noise(p.seed, nx, ny) * 0.3;   // Aumentado ruido para dispersión
      
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
      this.getField('trail0')!,
      this.getField('trail1')!,
      this.getField('trail2')!,
      this.getField('trail3')!,
    ];
    
    // Truncar coordenadas a enteros
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
    // Truncar coordenadas
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);
    
    // Si está dentro del área local, usar método normal
    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
      this.depositTrail(p);
      return;
    }
    
    // Fuera del área local: depositar en chunk infinito
    if (this.infiniteChunks) {
      const sig = this.getSignature(p.seed);
      const chunkX = Math.floor(px / CHUNK_SIZE);
      const chunkY = Math.floor(py / CHUNK_SIZE);
      const chunk = this.infiniteChunks.ensureChunkActive(chunkX, chunkY);
      
      // Calcular coordenadas locales dentro del chunk (ya enteras)
      const localX = ((px % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((py % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      
      // Añadir trail a los 4 canales del chunk usando Field.add()
      chunk.getField('trail0')?.add(localX, localY, sig[0] * 0.1);
      chunk.getField('trail1')?.add(localX, localY, sig[1] * 0.1);
      chunk.getField('trail2')?.add(localX, localY, sig[2] * 0.1);
      chunk.getField('trail3')?.add(localX, localY, sig[3] * 0.1);
    }
  }
  
  /**
   * Obtener firma de 4 canales desde seed
   */
  private getSignature(seed: number): number[] {
    return [
      ((seed >> 0) & 0xFF) / 255,
      ((seed >> 8) & 0xFF) / 255,
      ((seed >> 16) & 0xFF) / 255,
      ((seed >> 24) & 0xFF) / 255,
    ];
  }
  
  /**
   * Reproducir partícula (con control de densidad)
   */
  private reproduce(parent: Particle): void {
    const { lifecycle } = this.config;
    
    // === Control de densidad ===
    // Calcular densidad local (partículas en un radio de 10)
    const localDensity = this.particles.filter(p => 
      p.alive && 
      Math.abs(p.x - parent.x) <= 10 && 
      Math.abs(p.y - parent.y) <= 10
    ).length;
    
    // Si hay demasiadas partículas cerca, NO reproducir
    // Esto simula competencia por espacio/recursos
    const MAX_LOCAL_DENSITY = 25; // máximo ~25 partículas en área 20x20
    if (localDensity >= MAX_LOCAL_DENSITY) {
      return; // Sin coste - simplemente no se reproduce
    }
    
    // Probabilidad de éxito disminuye con densidad
    const reproductionChance = 1 - (localDensity / MAX_LOCAL_DENSITY);
    if (Math.random() > reproductionChance) {
      return; // Falló - sin coste
    }
    
    // Coste de reproducción
    parent.energy -= lifecycle.reproductionCost;
    
    // Mutar seed
    let childSeed = parent.seed;
    for (let i = 0; i < 32; i++) {
      if (Math.random() < lifecycle.mutationRate) {
        childSeed ^= (1 << i);
      }
    }
    
    // Spawn cerca del padre
    const angle = Math.random() * Math.PI * 2;
    const dist = 1 + Math.random() * 3;
    const cx = Math.floor(parent.x + Math.cos(angle) * dist);
    const cy = Math.floor(parent.y + Math.sin(angle) * dist);
    
    // Permitir spawn en mundo infinito (sin límites estrictos)
    if (this.isValidPosition(cx, cy)) {
      const newId = this.particleIdCounter++;
      this.particles.push({
        id: newId,
        x: cx,
        y: cy,
        vx: 0,  // Velocidad inicial
        vy: 0,
        energy: lifecycle.reproductionCost * 0.7, // Hijos nacen con menos energía
        seed: childSeed,
        alive: true,
      });
      this.births++;
      if (this.tick % 200 === 0 || this.births <= 3) {
        console.log(`[Birth] Particle ${newId} born at (${cx},${cy}) from parent ${parent.id} - tick ${this.tick}`);
      }
    }
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
   * Actualizar crecimiento de recursos
   */
  private updateGrowth(): void {
    const food = this.getField('food')!;
    const trees = this.getField('trees')!;
    
    food.growthStep();
    trees.growthStep();
  }
  
  /**
   * Actualizar campo de población
   */
  private updatePopulationField(): void {
    const pop = this.getField('population')!;
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
    this.particles = this.particles.filter(p => p.alive);
  }
  
  /**
   * Ruido determinístico basado en seed y posición
   */
  private noise(seed: number, x: number, y: number): number {
    const n = seed * 374761393 + x * 668265263 + y * 1274126177;
    return ((n * n * n) >>> 0) / 0xFFFFFFFF - 0.5;
  }
  
  /**
   * Crear RNG con seed
   */
  private createRNG(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7FFFFFFF;
      return s / 0x7FFFFFFF;
    };
  }
  
  // ============================================
  // Getters y control
  // ============================================
  
  getTick(): number {
    return this.tick;
  }
  
  getParticles(): Particle[] {
    return this.particles;
  }
  
  getStructures(): Array<{
    id: number;
    type: string;
    x: number;
    y: number;
    level: number;
    health: number;
  }> {
    return this.structureManager.getStructuresForClient();
  }
  
  getParticleCount(): number {
    return this.particles.filter(p => p.alive).length;
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
    const fieldAverages: Record<FieldType, number> = {} as Record<FieldType, number>;
    
    for (const [type, field] of this.fields) {
      fieldAverages[type] = field.getAverage();
    }
    
    return {
      tick: this.tick,
      tickTimeMs: this.lastTickTime,
      particleCount: this.getParticleCount(),
      totalDensity: this.getField('population')!.getSum(),
      activeChunks: 1, // Por ahora solo un chunk global
      fieldAverages,
      births: this.births,
      deaths: this.deaths,
    };
  }
  
  /**
   * Obtener métricas de emergencia para Prometheus
   */
  getEmergenceMetrics(): {
    complexity: number;
    coherence: number;
    adaptability: number;
    sustainability: number;
    entropy: number;
    autopoiesis: number;
    novelty: number;
    stability: number;
  } {
    const aliveParticles = this.particles.filter(p => p.alive);
    const count = aliveParticles.length;
    
    if (count === 0) {
      return { complexity: 0, coherence: 0, adaptability: 0, sustainability: 0, entropy: 0, autopoiesis: 0, novelty: 0, stability: 0 };
    }
    
    // Calcular diversidad de seeds (complejidad)
    const seedSet = new Set(aliveParticles.map(p => p.seed));
    const complexity = Math.min(1, seedSet.size / Math.max(count, 1));
    
    // Coherencia: qué tan agrupadas están las partículas
    const communities = this.communities.getAll();
    const coherence = communities.length > 0 ? Math.min(1, communities.length / Math.sqrt(count)) : 0;
    
    // Adaptabilidad: ratio de energía promedio sobre máximo teórico
    const avgEnergy = aliveParticles.reduce((s, p) => s + (p.energy ?? 0), 0) / count;
    const adaptability = Math.min(1, avgEnergy / 100);
    
    // Sostenibilidad: balance nacimientos/muertes
    const totalEvents = this.births + this.deaths;
    const sustainability = totalEvents > 0 ? this.births / totalEvents : 0.5;
    
    // Entropía: dispersión de partículas (varianza de posiciones)
    const avgX = aliveParticles.reduce((s, p) => s + p.x, 0) / count;
    const avgY = aliveParticles.reduce((s, p) => s + p.y, 0) / count;
    const varX = aliveParticles.reduce((s, p) => s + (p.x - avgX) ** 2, 0) / count;
    const varY = aliveParticles.reduce((s, p) => s + (p.y - avgY) ** 2, 0) / count;
    const maxVar = (this.width * this.height) / 4;
    const entropy = Math.min(1, Math.sqrt(varX + varY) / Math.sqrt(maxVar));
    
    // Autopoiesis: capacidad de reproducción (births/population)
    const autopoiesis = count > 0 ? Math.min(1, (this.births / Math.max(this.tick, 1)) * 100 / count) : 0;
    
    // Novedad: variación reciente (aproximado)
    const novelty = Math.min(1, (this.births + this.deaths) / Math.max(count, 1));
    
    // Estabilidad: inverso de la tensión
    const tensionStats = this.tension.getStats();
    const stability = 1 - Math.min(1, tensionStats.average);
    
    return { complexity, coherence, adaptability, sustainability, entropy, autopoiesis, novelty, stability };
  }
  
  /**
   * Obtener métricas de biodiversidad
   */
  getBiodiversityMetrics(): {
    behaviorCounts: Record<string, number>;
    shannonIndex: number;
    speciesRichness: number;
    dominantType: string;
    dominantRatio: number;
  } {
    const aliveParticles = this.particles.filter(p => p.alive);
    
    // Clasificar por tipo de comportamiento basado en seed
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
    
    // Índice de Shannon
    let shannon = 0;
    if (total > 0) {
      for (const count of Object.values(behaviorCounts)) {
        if (count > 0) {
          const p = count / total;
          shannon -= p * Math.log(p);
        }
      }
    }
    
    // Tipo dominante
    let dominantType = 'forager';
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
      speciesRichness: Object.values(behaviorCounts).filter(c => c > 0).length,
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
      case 0: return 'forager';
      case 1: return 'hunter';
      case 2: return 'nomad';
      case 3: return 'settler';
      default: return 'forager';
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
      communitySizes: allCommunities.map(c => c.members.length),
      communityStability: allCommunities.length > 0 
        ? allCommunities.reduce((s, c) => s + Math.min(1, c.age / 1000), 0) / allCommunities.length 
        : 0,
      cohesion: allCommunities.length > 0 
        ? allCommunities.reduce((s, c) => s + c.population / (c.radius * c.radius || 1), 0) / allCommunities.length / 10 
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
    const aliveParticles = this.particles.filter(p => p.alive);
    const totalEnergy = aliveParticles.reduce((s, p) => s + (p.energy ?? 0), 0);
    const previousEnergy = this.particles.length * 50; // baseline
    
    // Calcular escasez basada en campos de recursos
    const foodField = this.getField('food');
    const waterField = this.getField('water');
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
        food: this.births * 10, // aproximado
      },
      consumption: {
        food: this.deaths * 5, // aproximado
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
    const seasonProgress = ((this.tick % ticksPerSeason) / ticksPerSeason);
    const lunarPhase = (this.tick % (ticksPerDay * 30)) / (ticksPerDay * 30);
    
    // Fase del día: 0=noche, 1=amanecer, 2=día, 3=atardecer
    let phase = 0;
    if (dayProgress < 0.2) phase = 0; // noche
    else if (dayProgress < 0.3) phase = 1; // amanecer
    else if (dayProgress < 0.7) phase = 2; // día
    else if (dayProgress < 0.8) phase = 3; // atardecer
    else phase = 0; // noche
    
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
    // Por ahora placeholder - se integrará con EmergentQuests
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
      
      // Calcular gradiente promedio manualmente
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
