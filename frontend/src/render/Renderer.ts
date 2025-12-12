import { Application, Container, Graphics, Sprite } from "pixi.js";
import { ParticleRenderState } from "../types";
import {
  Particle,
  FieldType,
  WORLD,
  ChunkSnapshot,
  ViewportData,
  STRUCTURE_COLORS,
  AgentState,
  StructureData,
} from "@shared/types";
import { AssetLoader, LoadedAssets } from "./AssetLoader";
import { ChunkRenderer } from "./ChunkRenderer";

const TILE_SIZE = 32;
const TREE_DENSITY = 0.15;
const WATER_THRESHOLD = 0.4;

// Throttle para viewport updates
const VIEWPORT_UPDATE_THROTTLE_MS = 100;

// Interpolación de movimiento
const INTERPOLATION_SPEED = 0.2; // Velocidad de interpolación (0-1)

interface FieldLayer {
  graphics: Graphics;
  data: Float32Array | null;
  visible: boolean;
  color: number;
  alpha: number;
}

export type EntitySelection =
  | { kind: "particle"; particle: Particle }
  | { kind: "structure"; structure: StructureData };

export class Renderer {
  private app: Application | null = null;
  private container: HTMLElement;
  private assetLoader: AssetLoader;
  private assets: LoadedAssets | null = null;

  // Nuevo sistema de chunks
  private chunkRenderer: ChunkRenderer | null = null;

  private worldContainer: Container | null = null;
  private terrainLayer: Container | null = null;
  private waterLayer: Container | null = null;
  private treeLayer: Container | null = null;
  private fieldLayers: Map<FieldType, FieldLayer> = new Map();
  private particleLayer: Container | null = null;
  private structureLayer: Container | null = null; // Nueva capa para estructuras
  private uiLayer: Container | null = null;

  private terrainSprites: Sprite[] = [];
  private waterSprites: Sprite[] = [];
  private treeSprites: Sprite[] = [];
  private particleSprites: Map<number, Sprite> = new Map();
  private structureSprites: Map<number, Graphics> = new Map(); // Sprites de estructuras

  // Estado de partículas con interpolación
  private particleRenderStates: Map<number, ParticleRenderState> = new Map();

  private foodField: Float32Array | null = null;
  private waterField: Float32Array | null = null;
  private particles: Particle[] = [];
  private structures: StructureData[] = [];
  private currentTick = 0;

  private worldWidth = WORLD.WIDTH * TILE_SIZE;
  private worldHeight = WORLD.HEIGHT * TILE_SIZE;

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Tracking de viewport para chunks dinámicos
  private lastViewportUpdate = 0;
  private onViewportChange?: (viewport: ViewportData) => void;
  public onEntitySelected?: (selection: EntitySelection | null) => void;

  // Modo chunks dinámicos - ACTIVADO
  private useChunks = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.assetLoader = AssetLoader.getInstance();
  }

  async init(): Promise<void> {
    this.assets = await this.assetLoader.load();

    this.app = new Application();

    await this.app.init({
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.appendChild(this.app.canvas as HTMLCanvasElement);

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.terrainLayer = new Container();
    this.waterLayer = new Container();
    this.treeLayer = new Container();
    this.structureLayer = new Container(); // Capa de estructuras
    this.particleLayer = new Container();
    this.uiLayer = new Container();

    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.waterLayer);
    this.worldContainer.addChild(this.treeLayer);

    this.initFieldLayers();

    this.worldContainer.addChild(this.structureLayer); // Estructuras debajo de partículas
    this.worldContainer.addChild(this.particleLayer);
    this.app.stage.addChild(this.uiLayer);

    // Inicializar ChunkRenderer
    this.chunkRenderer = new ChunkRenderer(this.terrainLayer, this.assetLoader);

    this.setupCameraControls();

    this.panX = -this.worldWidth / 2 + this.container.clientWidth / 2;
    this.panY = -this.worldHeight / 2 + this.container.clientHeight / 2;
    this.updateTransform();
  }

  private initFieldLayers(): void {
    const fieldConfigs: { type: FieldType; color: number; alpha: number }[] = [
      { type: FieldType.FOOD, color: 0x00ff00, alpha: 0.2 },
      { type: FieldType.WATER, color: 0x0088ff, alpha: 0.2 },
      { type: FieldType.TRAIL0, color: 0xffff00, alpha: 0.15 },
    ];

    for (const config of fieldConfigs) {
      const graphics = new Graphics();
      this.fieldLayers.set(config.type, {
        graphics,
        data: null,
        visible: false,
        color: config.color,
        alpha: config.alpha,
      });

      if (this.worldContainer) {
        this.worldContainer.addChild(graphics);
      }
    }
  }

  private setupCameraControls(): void {
    if (!this.app) return;

    const canvas = this.app.canvas as HTMLCanvasElement;

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldXBefore = (mouseX - this.panX) / this.zoom;
      const worldYBefore = (mouseY - this.panY) / this.zoom;

      this.zoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor));

      this.panX = mouseX - worldXBefore * this.zoom;
      this.panY = mouseY - worldYBefore * this.zoom;

      this.updateTransform();
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.updateTransform();
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      // Si no hubo arrastre, es un click
      if (!this.isDragging) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert to world coordinates
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;

        this.handleMouseClick(worldX, worldY);
      }
      this.isDragging = false;
    });
    canvas.addEventListener("mouseleave", () => {
      this.isDragging = false;
    });
  }

  private updateTransform(): void {
    if (!this.worldContainer) return;
    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.position.set(this.panX, this.panY);

    // Notificar cambio de viewport
    this.notifyViewportChange();
  }

  /**
   * Notificar cambio de viewport para cargar chunks
   */
  private notifyViewportChange(): void {
    const now = Date.now();
    if (now - this.lastViewportUpdate < VIEWPORT_UPDATE_THROTTLE_MS) return;
    this.lastViewportUpdate = now;

    if (this.onViewportChange) {
      const viewport = this.getViewport();
      this.onViewportChange(viewport);
    }
  }

  /**
   * Obtener datos actuales del viewport
   */
  getViewport(): ViewportData {
    const centerX = (-this.panX + this.container.clientWidth / 2) / this.zoom;
    const centerY = (-this.panY + this.container.clientHeight / 2) / this.zoom;

    return {
      centerX,
      centerY,
      zoom: this.zoom,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
  }

  /**
   * Registrar callback para cambios de viewport
   */
  onViewportUpdate(callback: (viewport: ViewportData) => void): void {
    this.onViewportChange = callback;
  }

  /**
   * Recibir y renderizar chunks del backend
   */
  handleChunks(chunks: ChunkSnapshot[]): void {
    if (!this.chunkRenderer || !this.useChunks) return;

    for (const chunk of chunks) {
      this.chunkRenderer.renderChunk(chunk);
    }
  }

  /**
   * Notificar que un chunk fue descargado
   */
  handleChunkUnload(cx: number, cy: number): void {
    if (this.chunkRenderer) {
      this.chunkRenderer.unloadChunk(cx, cy);
    }
  }

  private generateTerrain(): void {
    if (!this.assets || !this.terrainLayer) return;

    this.terrainSprites.forEach((s) => s.destroy());
    this.terrainSprites = [];

    const tilesX = Math.ceil(this.worldWidth / TILE_SIZE);
    const tilesY = Math.ceil(this.worldHeight / TILE_SIZE);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const worldX = tx * TILE_SIZE;
        const worldY = ty * TILE_SIZE;
        const foodValue = this.getFieldValue(this.foodField, worldX, worldY);

        const texture = this.assetLoader.getTerrainTile(tx, ty, foodValue);
        const sprite = new Sprite(texture);
        sprite.x = worldX;
        sprite.y = worldY;
        sprite.width = TILE_SIZE + 1;
        sprite.height = TILE_SIZE + 1;

        this.terrainLayer.addChild(sprite);
        this.terrainSprites.push(sprite);
      }
    }
  }

  private generateWater(): void {
    if (!this.assets || !this.waterLayer || !this.waterField) return;

    this.waterSprites.forEach((s) => s.destroy());
    this.waterSprites = [];

    const tilesX = Math.ceil(this.worldWidth / TILE_SIZE);
    const tilesY = Math.ceil(this.worldHeight / TILE_SIZE);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const worldX = tx * TILE_SIZE;
        const worldY = ty * TILE_SIZE;
        const waterValue = this.getFieldValue(this.waterField, worldX, worldY);

        if (waterValue > WATER_THRESHOLD) {
          const texture = this.assetLoader.getWaterTile(tx, ty);
          const sprite = new Sprite(texture);
          sprite.x = worldX;
          sprite.y = worldY;
          sprite.width = TILE_SIZE + 1;
          sprite.height = TILE_SIZE + 1;
          sprite.alpha = Math.min(1, waterValue);

          this.waterLayer.addChild(sprite);
          this.waterSprites.push(sprite);
        }
      }
    }
  }

  private generateTrees(): void {
    if (!this.assets || !this.treeLayer || !this.foodField) return;

    this.treeSprites.forEach((s) => s.destroy());
    this.treeSprites = [];

    const tilesX = Math.ceil(this.worldWidth / TILE_SIZE);
    const tilesY = Math.ceil(this.worldHeight / TILE_SIZE);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const worldX = tx * TILE_SIZE;
        const worldY = ty * TILE_SIZE;
        const foodValue = this.getFieldValue(this.foodField, worldX, worldY);

        const pseudoRandom =
          Math.abs(Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453) % 1;

        if (foodValue > 0.3 && pseudoRandom < TREE_DENSITY) {
          const isForest = foodValue > 0.5;
          const texture = this.assetLoader.getTreeTexture(tx, ty, isForest);
          const sprite = new Sprite(texture);

          const offsetX = (pseudoRandom - 0.5) * TILE_SIZE * 0.5;
          const offsetY = (((pseudoRandom * 2) % 1) - 0.5) * TILE_SIZE * 0.5;

          sprite.x = worldX + TILE_SIZE / 2 + offsetX;
          sprite.y = worldY + TILE_SIZE + offsetY;
          sprite.anchor.set(0.5, 1);

          const scale = 0.3 + foodValue * 0.3;
          sprite.scale.set(scale);

          this.treeLayer.addChild(sprite);
          this.treeSprites.push(sprite);
        }
      }
    }
  }

  private getFieldValue(
    field: Float32Array | null,
    worldX: number,
    worldY: number,
  ): number {
    if (!field || field.length === 0) return 0;

    // Calcular grid size real basado en el tamaño del array
    const actualGridSize = Math.sqrt(field.length);
    const cellSize = this.worldWidth / actualGridSize;
    const gridX = Math.floor(worldX / cellSize);
    const gridY = Math.floor(worldY / cellSize);

    if (
      gridX < 0 ||
      gridX >= actualGridSize ||
      gridY < 0 ||
      gridY >= actualGridSize
    )
      return 0;

    const index = gridY * actualGridSize + gridX;
    return field[index];
  }

  private _debugGetFieldValueOnce = false;

  update(state: {
    tick: number;
    particles: Particle[];
    fields?: Map<FieldType, Float32Array>;
  }): void {
    this.currentTick = state.tick;
    this.particles = state.particles;

    if (state.fields) {
      const food = state.fields.get(FieldType.FOOD);
      const water = state.fields.get(FieldType.WATER);

      if (food) this.foodField = food;
      if (water) this.waterField = water;

      // Generar terreno legacy solo si NO usamos chunks dinámicos
      if (!this.useChunks) {
        if (this.terrainSprites.length === 0 && this.foodField) {
          this.generateTerrain();
          this.generateTrees();
        }

        if (this.waterSprites.length === 0 && this.waterField) {
          this.generateWater();
        }
      }

      state.fields.forEach((data, type) => {
        const layer = this.fieldLayers.get(type);
        if (layer) layer.data = data;
      });
    }
  }

  private handleMouseClick(worldX: number, worldY: number): void {
    const particleRadius = TILE_SIZE / 2;
    let closestParticle: Particle | null = null;
    let minParticleDistSq = Infinity;

    for (const p of this.particles) {
      if (!p.alive) continue;

      const renderState = this.particleRenderStates.get(p.id);
      const px = renderState ? renderState.displayX : p.x;
      const py = renderState ? renderState.displayY : p.y;

      const dx = px - worldX;
      const dy = py - worldY;
      const distSq = dx * dx + dy * dy;

      if (
        distSq < particleRadius * particleRadius &&
        distSq < minParticleDistSq
      ) {
        minParticleDistSq = distSq;
        closestParticle = p;
      }
    }

    let closestStructure: StructureData | null = null;
    let minStructureDistSq = Infinity;

    for (const s of this.structures) {
      const dx = s.x - worldX;
      const dy = s.y - worldY;
      const distSq = dx * dx + dy * dy;
      const baseRadius = (8 + s.level * 4) / 2;
      const radius = Math.max(baseRadius, TILE_SIZE * 0.4);

      if (distSq < radius * radius && distSq < minStructureDistSq) {
        minStructureDistSq = distSq;
        closestStructure = s;
      }
    }

    let selection: EntitySelection | null = null;

    if (
      closestParticle &&
      minParticleDistSq <= minStructureDistSq
    ) {
      selection = { kind: "particle", particle: closestParticle };
    } else if (closestStructure) {
      selection = { kind: "structure", structure: closestStructure };
    }

    if (this.onEntitySelected) {
      this.onEntitySelected(selection);
    }
  }

  render(): void {
    if (!this.app || !this.particleLayer || !this.assets) return;
    this.renderStructures();
    this.renderParticles();
    this.renderFieldOverlays();
  }

  private renderStructures(): void {
    if (!this.structureLayer) return;

    const currentIds = new Set<number>();

    // Usar colores centralizados desde shared/types
    for (const s of this.structures) {
      currentIds.add(s.id);

      let graphic = this.structureSprites.get(s.id);

      if (!graphic) {
        // Crear nuevo gráfico para la estructura
        graphic = new Graphics();
        this.structureLayer.addChild(graphic);
        this.structureSprites.set(s.id, graphic);
      }

      // Dibujar estructura
      graphic.clear();
      const color = STRUCTURE_COLORS[s.type] || STRUCTURE_COLORS.default;
      const size = 8 + s.level * 4; // Tamaño basado en nivel

      // Borde
      graphic.rect(-size / 2, -size / 2, size, size);
      graphic.fill({ color: 0x000000, alpha: 0.3 });

      // Relleno
      graphic.rect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2);
      graphic.fill({ color, alpha: 0.8 * s.health });

      // Posición en mundo
      graphic.x = s.x * TILE_SIZE + TILE_SIZE / 2;
      graphic.y = s.y * TILE_SIZE + TILE_SIZE / 2;
    }

    // Limpiar estructuras que ya no existen
    for (const [id, graphic] of this.structureSprites) {
      if (!currentIds.has(id)) {
        this.structureLayer.removeChild(graphic);
        this.structureSprites.delete(id);
      }
    }
  }

  private renderParticles(): void {
    if (!this.particleLayer || !this.assets) return;

    const currentIds = new Set<number>();

    for (const p of this.particles) {
      if (!p.alive) continue;

      currentIds.add(p.id);

      // Obtener o crear estado de interpolación
      let renderState = this.particleRenderStates.get(p.id);
      if (!renderState) {
        renderState = {
          ...p,
          displayX: p.x,
          displayY: p.y,
          prevX: p.x,
          prevY: p.y,
        };
        this.particleRenderStates.set(p.id, renderState);
      } else {
        // Actualizar posición objetivo cuando recibimos nuevo estado del servidor
        if (renderState.x !== p.x || renderState.y !== p.y) {
          renderState.prevX = renderState.displayX;
          renderState.prevY = renderState.displayY;
        }
        renderState.x = p.x;
        renderState.y = p.y;
        renderState.vx = p.vx;
        renderState.vy = p.vy;
        renderState.energy = p.energy;
        renderState.alive = p.alive;
      }

      // Interpolación suave hacia la posición objetivo con velocidad adaptativa
      const dx = renderState.x - renderState.displayX;
      const dy = renderState.y - renderState.displayY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Velocidad adaptativa: más rápida para distancias largas
      const adaptiveSpeed =
        distance > 50 ? 0.5 : distance > 20 ? 0.35 : INTERPOLATION_SPEED;

      // Si la velocidad está disponible, usarla para predicción
      if (renderState.vx !== undefined && renderState.vy !== undefined) {
        // Movimiento predictivo: interpolar con velocidad
        renderState.displayX +=
          dx * adaptiveSpeed + (renderState.vx || 0) * 0.3;
        renderState.displayY +=
          dy * adaptiveSpeed + (renderState.vy || 0) * 0.3;
      } else {
        // Fallback: interpolación lineal simple
        renderState.displayX += dx * adaptiveSpeed;
        renderState.displayY += dy * adaptiveSpeed;
      }

      let sprite = this.particleSprites.get(p.id);

      if (!sprite) {
        const isFemale = p.seed % 2 === 0;
        const texture = this.assetLoader.getCharacterFrame(
          p.seed,
          this.currentTick,
          isFemale,
        );
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        this.particleLayer.addChild(sprite);
        this.particleSprites.set(p.id, sprite);
      }

      // Usar posición interpolada para renderizado suave
      // Convertir de coordenadas de grilla a coordenadas de mundo (pixels)
      sprite.x = renderState.displayX * TILE_SIZE;
      sprite.y = renderState.displayY * TILE_SIZE;

      const isFemale = p.seed % 2 === 0;
      sprite.texture = this.assetLoader.getCharacterFrame(
        p.seed,
        this.currentTick,
        isFemale,
      );

      // La energía viene normalizada (0-1), escalar a porcentaje para visualización
      const energyPercent = (p.energy || 0) * 100;
      const healthScale = 0.8 + (energyPercent / 100) * 0.4;
      sprite.scale.set(healthScale);

      // Colorear según estado del agente + energía
      const stateTint = this.getStateIndicatorColor(p.state as AgentState);
      if (stateTint !== 0xffffff) {
        // Estado tiene prioridad si no es neutro
        sprite.tint = stateTint;
      } else if (energyPercent < 30) {
        sprite.tint = 0xff6666; // Baja energía
      } else if (energyPercent < 60) {
        sprite.tint = 0xffff66; // Energía media
      } else {
        sprite.tint = 0xffffff; // Normal
      }

      sprite.visible = true;
    }

    // Limpiar sprites y estados de partículas muertas inmediatamente
    const toDelete: number[] = [];
    this.particleSprites.forEach((sprite, id) => {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.particleRenderStates.delete(id);
        toDelete.push(id);
      }
    });
    // Eliminar referencias después de iterar
    for (const id of toDelete) {
      this.particleSprites.delete(id);
    }
  }

  private renderFieldOverlays(): void {
    this.fieldLayers.forEach((layer) => {
      if (!layer.visible || !layer.data || !layer.graphics) return;

      layer.graphics.clear();

      const cellWidth = this.worldWidth / WORLD.GRID_SIZE;
      const cellHeight = this.worldHeight / WORLD.GRID_SIZE;

      for (let y = 0; y < WORLD.GRID_SIZE; y++) {
        for (let x = 0; x < WORLD.GRID_SIZE; x++) {
          const value = layer.data[y * WORLD.GRID_SIZE + x];
          if (value > 0.05) {
            const alpha = Math.min(layer.alpha, value * layer.alpha);
            layer.graphics.rect(
              x * cellWidth,
              y * cellHeight,
              cellWidth,
              cellHeight,
            );
            layer.graphics.fill({ color: layer.color, alpha });
          }
        }
      }
    });
  }

  /**
   * Obtener color indicador según el estado del agente
   */
  private getStateIndicatorColor(
    state: AgentState | string | undefined,
  ): number {
    switch (state) {
      case AgentState.FLEEING:
        return 0xff4444; // Rojo - huyendo
      case AgentState.GATHERING:
        return 0x44ff44; // Verde - recolectando
      case AgentState.BUILDING:
        return 0xffaa44; // Naranja - construyendo
      case AgentState.WORKING:
        return 0x44aaff; // Azul - trabajando
      case AgentState.RESTING:
        return 0xaaaaff; // Azul claro - descansando
      default:
        return 0xffffff; // Blanco - neutro
    }
  }

  setFieldVisible(type: FieldType, visible: boolean): void {
    const layer = this.fieldLayers.get(type);
    if (layer) {
      layer.visible = visible;
      layer.graphics.visible = visible;
    }
  }

  isFieldVisible(type: FieldType): boolean {
    return this.fieldLayers.get(type)?.visible ?? false;
  }

  toggleFieldVisibility(type: FieldType): void {
    const visible = this.isFieldVisible(type);
    this.setFieldVisible(type, !visible);
  }

  regenerateWorld(): void {
    this.generateTerrain();
    this.generateWater();
    this.generateTrees();
  }

  resize(): void {
    if (!this.app) return;
    this.app.renderer.resize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }

  getApp(): Application | null {
    return this.app;
  }

  getWorldContainer(): Container | null {
    return this.worldContainer;
  }

  // Métodos de compatibilidad con main.ts

  updateParticles(particles: Particle[]): void {
    this.particles = particles;
  }

  updateStructures(structures: StructureData[]): void {
    this.structures = structures;
  }

  updateFields(fields: Partial<Record<FieldType, number[]>>): void {
    const fieldMap = new Map<FieldType, Float32Array>();

    for (const key of Object.keys(fields) as FieldType[]) {
      const data = fields[key];
      if (!data) continue;
      fieldMap.set(key, new Float32Array(data));
    }

    // Actualizar campos internos
    const food = fieldMap.get(FieldType.FOOD);
    const water = fieldMap.get(FieldType.WATER);

    if (food) {
      this.foodField = food;
    }
    if (water) {
      this.waterField = water;
    }

    // Generar terreno legacy la primera vez (solo si NO usamos chunks dinámicos)
    if (!this.useChunks) {
      if (!this._terrainGenerated && this.foodField) {
        this._terrainGenerated = true;
        this.generateTerrain();
        this.generateTrees();
      }

      if (!this._waterGenerated && this.waterField) {
        this._waterGenerated = true;
        this.generateWater();
      }
    }

    // Actualizar capas de campos
    fieldMap.forEach((data, type) => {
      const layer = this.fieldLayers.get(type);
      if (layer) layer.data = data;
    });
  }

  private _terrainGenerated = false;
  private _waterGenerated = false;
  private _foodDebugShown = false;
  private _waterDebugShown = false;

  startRenderLoop(): void {
    if (!this.app) return;

    this.app.ticker.add(() => {
      this.render();
    });
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const worldX = (screenX - this.panX) / this.zoom;
    const worldY = (screenY - this.panY) / this.zoom;
    return { x: worldX, y: worldY };
  }

  centerView(): void {
    this.panX = -this.worldWidth / 2 + this.container.clientWidth / 2;
    this.panY = -this.worldHeight / 2 + this.container.clientHeight / 2;
    this.zoom = 1;
    this.updateTransform();
  }
}
