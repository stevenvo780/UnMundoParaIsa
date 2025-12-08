/**
 * Renderer con PixiJS para visualizar la simulación
 */

import { Application, Container, Graphics } from 'pixi.js';
import { Particle, FieldType, WORLD } from '@shared/types';

interface FieldLayer {
  graphics: Graphics;
  data: Float32Array | null;
  visible: boolean;
  color: number;
  alpha: number;
}

export class Renderer {
  private app: Application | null = null;
  private container: HTMLElement;
  
  // Capas
  private backgroundLayer: Container | null = null;
  private fieldLayers: Map<FieldType, FieldLayer> = new Map();
  private particleLayer: Container | null = null;
  private uiLayer: Container | null = null;
  
  // Partículas
  private particleGraphics: Graphics[] = [];
  private particles: Particle[] = [];
  
  // Estado
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  /**
   * Inicializar PixiJS
   */
  async init(): Promise<void> {
    this.app = new Application();
    
    await this.app.init({
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    this.container.appendChild(this.app.canvas);
    
    // Crear capas
    this.backgroundLayer = new Container();
    this.particleLayer = new Container();
    this.uiLayer = new Container();
    
    this.app.stage.addChild(this.backgroundLayer);
    this.app.stage.addChild(this.particleLayer);
    this.app.stage.addChild(this.uiLayer);
    
    // Inicializar capas de campo
    this.initFieldLayers();
    
    // Eventos de input
    this.setupInputHandlers();
    
    // Resize
    window.addEventListener('resize', () => this.handleResize());
    
    // Centrar vista
    this.centerView();
    
    console.log('[Renderer] Inicializado');
  }
  
  /**
   * Inicializar capas de campos
   */
  private initFieldLayers(): void {
    const fieldConfigs: Array<{ type: FieldType; color: number; alpha: number }> = [
      { type: 'food', color: 0x4caf50, alpha: 0.6 },
      { type: 'water', color: 0x2196f3, alpha: 0.5 },
      { type: 'trail0', color: 0xffeb3b, alpha: 0.3 },
      { type: 'trail1', color: 0xff9800, alpha: 0.3 },
      { type: 'trail2', color: 0xe91e63, alpha: 0.3 },
      { type: 'trail3', color: 0x9c27b0, alpha: 0.3 },
      { type: 'danger', color: 0xf44336, alpha: 0.5 },
      { type: 'trees', color: 0x2e7d32, alpha: 0.4 },
      { type: 'population', color: 0xffffff, alpha: 0.2 },
    ];
    
    for (const config of fieldConfigs) {
      const graphics = new Graphics();
      this.backgroundLayer?.addChild(graphics);
      
      this.fieldLayers.set(config.type, {
        graphics,
        data: null,
        visible: ['food', 'water', 'trail0'].includes(config.type),
        color: config.color,
        alpha: config.alpha,
      });
    }
  }
  
  /**
   * Setup de handlers de input
   */
  private setupInputHandlers(): void {
    if (!this.app) return;
    
    const canvas = this.app.canvas;
    
    // Pan
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });
    
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
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
    
    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });
    
    // Zoom
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));
      
      // Zoom hacia el cursor
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - this.panX) / this.zoom;
      const worldY = (mouseY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      this.panX = mouseX - worldX * this.zoom;
      this.panY = mouseY - worldY * this.zoom;
      
      this.updateTransform();
    });
  }
  
  /**
   * Actualizar transformación
   */
  private updateTransform(): void {
    if (!this.backgroundLayer || !this.particleLayer) return;
    
    this.backgroundLayer.x = this.panX;
    this.backgroundLayer.y = this.panY;
    this.backgroundLayer.scale.set(this.zoom);
    
    this.particleLayer.x = this.panX;
    this.particleLayer.y = this.panY;
    this.particleLayer.scale.set(this.zoom);
  }
  
  /**
   * Centrar vista
   */
  centerView(): void {
    if (!this.app) return;
    
    const canvasWidth = this.app.screen.width;
    const canvasHeight = this.app.screen.height;
    
    this.zoom = Math.min(canvasWidth / WORLD.WIDTH, canvasHeight / WORLD.HEIGHT) * 0.9;
    this.panX = (canvasWidth - WORLD.WIDTH * this.zoom) / 2;
    this.panY = (canvasHeight - WORLD.HEIGHT * this.zoom) / 2;
    
    this.updateTransform();
  }
  
  /**
   * Handle resize
   */
  private handleResize(): void {
    if (!this.app) return;
    
    this.app.renderer.resize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    
    this.centerView();
  }
  
  /**
   * Actualizar campos desde el servidor
   */
  updateFields(fields: Partial<Record<FieldType, number[]>>): void {
    for (const [fieldType, data] of Object.entries(fields)) {
      const layer = this.fieldLayers.get(fieldType as FieldType);
      if (layer && data) {
        layer.data = new Float32Array(data);
      }
    }
  }
  
  /**
   * Actualizar partículas
   */
  updateParticles(particles: Particle[]): void {
    this.particles = particles;
  }
  
  /**
   * Render frame
   */
  render(): void {
    // Render fields
    this.renderFields();
    
    // Render particles
    this.renderParticles();
  }
  
  /**
   * Renderizar campos
   */
  private renderFields(): void {
    const cellSize = 4; // Tamaño de celda para optimización
    
    for (const [fieldType, layer] of this.fieldLayers) {
      if (!layer.visible || !layer.data) continue;
      
      const graphics = layer.graphics;
      graphics.clear();
      
      const { color, alpha, data } = layer;
      
      // Renderizar en bloques para optimización
      for (let y = 0; y < WORLD.HEIGHT; y += cellSize) {
        for (let x = 0; x < WORLD.WIDTH; x += cellSize) {
          // Valor promedio en el bloque
          let sum = 0;
          let count = 0;
          
          for (let dy = 0; dy < cellSize && y + dy < WORLD.HEIGHT; dy++) {
            for (let dx = 0; dx < cellSize && x + dx < WORLD.WIDTH; dx++) {
              const idx = (y + dy) * WORLD.WIDTH + (x + dx);
              sum += data[idx];
              count++;
            }
          }
          
          const value = sum / count;
          if (value > 0.01) {
            graphics.rect(x, y, cellSize, cellSize);
            graphics.fill({ color, alpha: alpha * value });
          }
        }
      }
    }
  }
  
  /**
   * Renderizar partículas
   */
  private renderParticles(): void {
    if (!this.particleLayer) return;
    
    // Limpiar partículas anteriores
    while (this.particleLayer.children.length > 0) {
      this.particleLayer.removeChildAt(0);
    }
    
    // Dibujar partículas
    const graphics = new Graphics();
    
    for (const p of this.particles) {
      if (!p.alive) continue;
      
      // Color basado en energía y seed
      const hue = (p.seed % 360);
      const saturation = 70 + p.energy * 30;
      const lightness = 40 + p.energy * 30;
      
      const color = this.hslToHex(hue, saturation, lightness);
      const size = 2 + p.energy * 2;
      
      graphics.circle(p.x, p.y, size);
      graphics.fill({ color, alpha: 0.8 + p.energy * 0.2 });
    }
    
    this.particleLayer.addChild(graphics);
  }
  
  /**
   * Convertir HSL a hex
   */
  private hslToHex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return (r << 16) + (g << 8) + b;
  }
  
  /**
   * Iniciar render loop
   */
  startRenderLoop(): void {
    if (!this.app) return;
    
    this.app.ticker.add(() => {
      this.render();
    });
  }
  
  /**
   * Toggle visibilidad de campo
   */
  toggleFieldVisibility(fieldType: FieldType): void {
    const layer = this.fieldLayers.get(fieldType);
    if (layer) {
      layer.visible = !layer.visible;
      if (!layer.visible) {
        layer.graphics.clear();
      }
    }
  }
  
  /**
   * Obtener coordenadas del mundo desde posición de pantalla
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: Math.floor((screenX - this.panX) / this.zoom),
      y: Math.floor((screenY - this.panY) / this.zoom),
    };
  }
  
  /**
   * Destruir renderer
   */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }
}
