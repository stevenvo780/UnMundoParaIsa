/**
 * Controlador de UI
 */

import { Renderer } from '../render/Renderer';
import { WebSocketClient } from '../network/WebSocketClient';
import { SimulationMetrics, FieldType } from '../types';

export class UIController {
  private renderer: Renderer;
  private client: WebSocketClient;
  
  // Elementos DOM
  private tickDisplay: HTMLElement | null = null;
  private particleCountDisplay: HTMLElement | null = null;
  private fpsDisplay: HTMLElement | null = null;
  private metricsPanel: HTMLElement | null = null;
  
  // Estado
  private isPaused = false;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;
  
  constructor(renderer: Renderer, client: WebSocketClient) {
    this.renderer = renderer;
    this.client = client;
  }
  
  /**
   * Inicializar UI
   */
  init(): void {
    this.createUI();
    this.setupKeyboardShortcuts();
    this.startFPSCounter();
  }
  
  /**
   * Crear elementos de UI
   */
  private createUI(): void {
    // Panel de control
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    controlPanel.innerHTML = `
      <div class="panel-header">
        <h2>Un Mundo Para Isa</h2>
        <span class="connection-status" id="connection-status">⚫ Desconectado</span>
      </div>
      
      <div class="stats">
        <div class="stat">
          <label>Tick:</label>
          <span id="tick-display">0</span>
        </div>
        <div class="stat">
          <label>Partículas:</label>
          <span id="particle-count">0</span>
        </div>
        <div class="stat">
          <label>FPS:</label>
          <span id="fps-display">0</span>
        </div>
      </div>
      
      <div class="controls">
        <button id="btn-pause">⏸ Pausar</button>
        <button id="btn-reset">🔄 Reset</button>
        <button id="btn-spawn">➕ Spawn</button>
      </div>
      
      <div class="field-toggles">
        <h3>Capas</h3>
        <label><input type="checkbox" data-field="food" checked> 🍎 Comida</label>
        <label><input type="checkbox" data-field="water" checked> 💧 Agua</label>
        <label><input type="checkbox" data-field="trail0" checked> 🟡 Trail 0</label>
        <label><input type="checkbox" data-field="trail1"> 🟠 Trail 1</label>
        <label><input type="checkbox" data-field="trail2"> 🔴 Trail 2</label>
        <label><input type="checkbox" data-field="trail3"> 🟣 Trail 3</label>
        <label><input type="checkbox" data-field="danger"> ⚠️ Peligro</label>
        <label><input type="checkbox" data-field="trees"> 🌲 Árboles</label>
      </div>
      
      <div class="metrics" id="metrics-panel">
        <h3>Métricas</h3>
        <div id="metrics-content"></div>
      </div>
      
      <div class="help">
        <h3>Controles</h3>
        <p>🖱️ Arrastrar: Pan</p>
        <p>🖲️ Scroll: Zoom</p>
        <p>⌨️ Espacio: Pausar</p>
        <p>⌨️ R: Reset</p>
        <p>⌨️ Click: Spawn</p>
      </div>
    `;
    
    document.body.appendChild(controlPanel);
    
    // Referencias
    this.tickDisplay = document.getElementById('tick-display');
    this.particleCountDisplay = document.getElementById('particle-count');
    this.fpsDisplay = document.getElementById('fps-display');
    this.metricsPanel = document.getElementById('metrics-content');
    
    // Event listeners
    this.setupControlListeners();
    this.setupFieldToggleListeners();
    this.setupConnectionStatusListener();
  }
  
  /**
   * Configurar listeners de controles
   */
  private setupControlListeners(): void {
    const pauseBtn = document.getElementById('btn-pause');
    const resetBtn = document.getElementById('btn-reset');
    const spawnBtn = document.getElementById('btn-spawn');
    
    pauseBtn?.addEventListener('click', () => {
      this.togglePause();
    });
    
    resetBtn?.addEventListener('click', () => {
      this.client.reset();
    });
    
    spawnBtn?.addEventListener('click', () => {
      // Spawn en el centro
      this.client.spawnParticles(256, 256, 10);
    });
    
    // Click en canvas para spawn
    const canvas = document.querySelector('canvas');
    canvas?.addEventListener('click', (e) => {
      if (e.shiftKey) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.renderer.screenToWorld(screenX, screenY);
        
        if (worldPos.x >= 0 && worldPos.x < 512 && worldPos.y >= 0 && worldPos.y < 512) {
          this.client.spawnParticles(worldPos.x, worldPos.y, 10);
        }
      }
    });
  }
  
  /**
   * Configurar listeners de toggles de campo
   */
  private setupFieldToggleListeners(): void {
    const toggles = document.querySelectorAll('[data-field]');
    
    toggles.forEach((toggle) => {
      toggle.addEventListener('change', (e) => {
        const checkbox = e.target as HTMLInputElement;
        const fieldType = checkbox.dataset.field as FieldType;
        this.renderer.toggleFieldVisibility(fieldType);
      });
    });
  }
  
  /**
   * Configurar listener de estado de conexión
   */
  private setupConnectionStatusListener(): void {
    const statusEl = document.getElementById('connection-status');
    
    this.client.on('connected', () => {
      if (statusEl) {
        statusEl.textContent = '🟢 Conectado';
        statusEl.classList.add('connected');
      }
    });
    
    this.client.on('disconnected', () => {
      if (statusEl) {
        statusEl.textContent = '🔴 Desconectado';
        statusEl.classList.remove('connected');
      }
    });
  }
  
  /**
   * Configurar atajos de teclado
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePause();
          break;
        case 'r':
        case 'R':
          this.client.reset();
          break;
        case 'c':
        case 'C':
          this.renderer.centerView();
          break;
      }
    });
  }
  
  /**
   * Toggle pausa
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      this.client.pause();
    } else {
      this.client.resume();
    }
    
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '▶️ Reanudar' : '⏸ Pausar';
    }
  }
  
  /**
   * Iniciar contador de FPS
   */
  private startFPSCounter(): void {
    setInterval(() => {
      this.fps = this.frameCount;
      this.frameCount = 0;
      
      if (this.fpsDisplay) {
        this.fpsDisplay.textContent = this.fps.toString();
      }
    }, 1000);
    
    const countFrame = () => {
      this.frameCount++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
  }
  
  /**
   * Actualizar display de tick
   */
  updateTick(tick: number): void {
    if (this.tickDisplay) {
      this.tickDisplay.textContent = tick.toString();
    }
  }
  
  /**
   * Actualizar métricas
   */
  updateMetrics(metrics: SimulationMetrics): void {
    if (this.particleCountDisplay) {
      this.particleCountDisplay.textContent = metrics.particleCount.toString();
    }
    
    if (this.metricsPanel) {
      this.metricsPanel.innerHTML = `
        <div class="metric">
          <span>Tiempo tick:</span>
          <span>${metrics.tickTimeMs.toFixed(2)}ms</span>
        </div>
        <div class="metric">
          <span>Nacimientos:</span>
          <span class="birth">${metrics.births}</span>
        </div>
        <div class="metric">
          <span>Muertes:</span>
          <span class="death">${metrics.deaths}</span>
        </div>
        <div class="metric">
          <span>Densidad:</span>
          <span>${metrics.totalDensity.toFixed(0)}</span>
        </div>
      `;
    }
  }
}
