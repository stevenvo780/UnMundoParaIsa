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
import { getSignature } from '../social/Signatures.js';
import { CommunityDetector } from '../social/Communities.js';
import { TensionField } from '../social/Tension.js';

// Narrative
import { SemanticFieldManager } from '../narrative/SemanticFields.js';
import { ArtifactManager } from '../narrative/Artifacts.js';
import { EventManager } from '../narrative/Events.js';
import { MaterializationManager } from '../narrative/Materialization.js';

// Scale
import { FlowFieldManager } from '../scale/FlowFields.js';
import { LODManager } from '../scale/LOD.js';
import { ThermostatBank, WorldBalancer } from '../scale/Thermostats.js';

export class World {
  readonly width: number;
  readonly height: number;
  readonly config: SimulationConfig;
  
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
    
    // SLOW (cada 20 ticks): narrativa, escala, termostatos
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
  }
  
  // === Métodos de actualización por subsistema ===
  
  /**
   * Actualizar economía (MEDIUM rate)
   * TODO: Integrar métodos reales cuando APIs estén finalizadas
   */
  private updateEconomy(): void {
    // Placeholder - integración pendiente
    // Los managers están inicializados pero sus APIs necesitan refinamiento
  }
  
  /**
   * Actualizar sistemas sociales (MEDIUM rate)
   */
  private updateSocial(): void {
    // Placeholder - integración pendiente
    // CommunityDetector y TensionField tienen APIs específicas
  }
  
  /**
   * Actualizar narrativa (SLOW rate)
   */
  private updateNarrative(): void {
    // Placeholder - integración pendiente
    // SemanticFields, Artifacts, Materialization conectados
  }
  
  /**
   * Actualizar sistemas de escala (SLOW rate)
   */
  private updateScale(): void {
    // LOD y FlowFields update
    const food = this.getField('food');
    if (food) {
      this.flowFields.updateFromField('food', food.getBuffer());
    }
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
    
    // Agua en algunos oases
    const waterOases = oases.slice(0, 3).map(o => ({
      ...o,
      radius: o.radius * 0.7,
      value: 0.9,
    }));
    waterField.initWithOases(waterOases);
    
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
  }
  
  /**
   * Actualizar todas las partículas
   */
  private updateParticles(): void {
    const food = this.getField('food')!;
    const water = this.getField('water')!;
    const trail0 = this.getField('trail0')!;
    const danger = this.getField('danger')!;
    const cost = this.getField('cost')!;
    
    const { weights, lifecycle } = this.config;
    
    // Buffer de consumo
    const consumption = new Float32Array(this.width * this.height);
    
    for (const p of this.particles) {
      if (!p.alive) continue;
      
      // Metabolismo base
      p.energy -= lifecycle.baseMetabolism;
      
      // Muerte por falta de energía
      if (p.energy <= 0) {
        p.alive = false;
        this.deaths++;
        continue;
      }
      
      // Consumir recursos
      const foodHere = food.get(p.x, p.y);
      const waterHere = water.get(p.x, p.y);
      
      const consume = Math.min(0.1, foodHere) * lifecycle.consumptionEfficiency;
      p.energy += consume;
      consumption[idx(p.x, p.y, this.width)] += consume / lifecycle.consumptionEfficiency;
      
      // También necesita agua
      if (waterHere < 0.1) {
        p.energy -= 0.005; // Deshidratación
      }
      
      // Clamp energía
      p.energy = Math.min(1.0, p.energy);
      
      // Movimiento por gradiente
      const dir = this.chooseDirection(p, weights, food, water, trail0, danger, cost);
      
      if (dir.dx !== 0 || dir.dy !== 0) {
        const newX = p.x + dir.dx;
        const newY = p.y + dir.dy;
        
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          p.x = newX;
          p.y = newY;
          p.energy -= lifecycle.movementCost;
          
          // Depositar trail
          this.depositTrail(p);
        }
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
    
    for (let c = 0; c < 4; c++) {
      trailFields[c].add(p.x, p.y, sig[c] * 0.1);
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
   * Reproducir partícula
   */
  private reproduce(parent: Particle): void {
    const { lifecycle } = this.config;
    
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
    
    if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
      this.particles.push({
        id: this.particleIdCounter++,
        x: cx,
        y: cy,
        energy: lifecycle.reproductionCost * 0.8,
        seed: childSeed,
        alive: true,
      });
      this.births++;
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
   * Obtener snapshot de campo para enviar al frontend
   */
  getFieldSnapshot(type: FieldType): Float32Array | undefined {
    return this.getField(type)?.getBuffer();
  }
}
