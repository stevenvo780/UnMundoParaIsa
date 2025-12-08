/**
 * DialogUI.ts - Interfaz de Diálogos Narrativos
 * 
 * Muestra fragmentos de diálogos descubiertos cuando
 * los personajes o artefactos son encontrados.
 */

export interface DialogFragment {
  id: string;
  text: string;
  speaker?: string;
  emotion?: 'joy' | 'nostalgia' | 'love' | 'sadness' | 'neutral';
  timestamp: number;
  x: number;
  y: number;
  artifactId?: string;
  characterId?: string;
}

export interface DialogUIConfig {
  maxVisibleDialogs: number;
  dialogDuration: number;      // ms
  fadeOutDuration: number;     // ms
  offsetY: number;             // pixels above entity
  maxWidth: number;            // max bubble width
  fontSize: number;
  fontFamily: string;
}

interface ActiveDialog {
  fragment: DialogFragment;
  element: HTMLDivElement;
  startTime: number;
  opacity: number;
}

/**
 * Controlador de UI para diálogos narrativos
 */
export class DialogUIController {
  private container: HTMLDivElement;
  private activeDialogs: Map<string, ActiveDialog> = new Map();
  private config: DialogUIConfig;
  private canvas: HTMLCanvasElement;
  private worldWidth: number;
  private worldHeight: number;

  constructor(
    parentElement: HTMLElement,
    canvas: HTMLCanvasElement,
    worldWidth: number = 512,
    worldHeight: number = 512,
    config: Partial<DialogUIConfig> = {}
  ) {
    this.canvas = canvas;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.config = {
      maxVisibleDialogs: config.maxVisibleDialogs ?? 5,
      dialogDuration: config.dialogDuration ?? 5000,
      fadeOutDuration: config.fadeOutDuration ?? 1000,
      offsetY: config.offsetY ?? 40,
      maxWidth: config.maxWidth ?? 200,
      fontSize: config.fontSize ?? 14,
      fontFamily: config.fontFamily ?? 'Georgia, serif',
    };

    // Crear contenedor de diálogos
    this.container = document.createElement('div');
    this.container.className = 'dialog-container';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      z-index: 100;
    `;
    parentElement.appendChild(this.container);

    // Agregar estilos
    this.injectStyles();
  }

  /**
   * Inyectar estilos CSS
   */
  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .dialog-bubble {
        position: absolute;
        max-width: ${this.config.maxWidth}px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        font-family: ${this.config.fontFamily};
        font-size: ${this.config.fontSize}px;
        line-height: 1.4;
        text-align: center;
        transform: translateX(-50%);
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .dialog-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid rgba(255, 255, 255, 0.95);
      }

      .dialog-bubble .speaker {
        font-weight: bold;
        margin-bottom: 4px;
        font-size: 12px;
        color: #666;
      }

      .dialog-bubble .text {
        color: #333;
      }

      .dialog-bubble.emotion-joy {
        background: linear-gradient(135deg, #fff9e6, #fff3cc);
        border: 1px solid #ffd700;
      }

      .dialog-bubble.emotion-nostalgia {
        background: linear-gradient(135deg, #f5e6ff, #e6ccff);
        border: 1px solid #9966cc;
      }

      .dialog-bubble.emotion-love {
        background: linear-gradient(135deg, #ffe6e6, #ffcccc);
        border: 1px solid #ff6666;
      }

      .dialog-bubble.emotion-sadness {
        background: linear-gradient(135deg, #e6f2ff, #cce5ff);
        border: 1px solid #6699cc;
      }

      @keyframes dialog-appear {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .dialog-bubble.appearing {
        animation: dialog-appear 0.3s ease forwards;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Mostrar un fragmento de diálogo
   */
  showDialog(fragment: DialogFragment): void {
    // Verificar límite
    if (this.activeDialogs.size >= this.config.maxVisibleDialogs) {
      // Remover el más antiguo
      const oldest = this.getOldestDialog();
      if (oldest) {
        this.removeDialog(oldest);
      }
    }

    // Crear elemento de burbuja
    const element = document.createElement('div');
    element.className = `dialog-bubble appearing emotion-${fragment.emotion ?? 'neutral'}`;

    // Speaker si existe
    if (fragment.speaker) {
      const speakerEl = document.createElement('div');
      speakerEl.className = 'speaker';
      speakerEl.textContent = fragment.speaker;
      element.appendChild(speakerEl);
    }

    // Texto
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = `"${fragment.text}"`;
    element.appendChild(textEl);

    // Posicionar
    this.positionBubble(element, fragment.x, fragment.y);

    this.container.appendChild(element);

    this.activeDialogs.set(fragment.id, {
      fragment,
      element,
      startTime: Date.now(),
      opacity: 1,
    });
  }

  /**
   * Posicionar burbuja según coordenadas del mundo
   */
  private positionBubble(element: HTMLDivElement, worldX: number, worldY: number): void {
    const canvasRect = this.canvas.getBoundingClientRect();
    
    // Convertir coordenadas del mundo a pixels del canvas
    const scaleX = canvasRect.width / this.worldWidth;
    const scaleY = canvasRect.height / this.worldHeight;

    const screenX = canvasRect.left + worldX * scaleX;
    const screenY = canvasRect.top + worldY * scaleY - this.config.offsetY;

    element.style.left = `${screenX}px`;
    element.style.top = `${screenY}px`;
  }

  /**
   * Actualizar posiciones y estados
   */
  update(cameraX: number = 0, cameraY: number = 0, zoom: number = 1): void {
    const now = Date.now();

    for (const [id, dialog] of this.activeDialogs) {
      const elapsed = now - dialog.startTime;

      if (elapsed >= this.config.dialogDuration + this.config.fadeOutDuration) {
        this.removeDialog(id);
        continue;
      }

      // Fade out
      if (elapsed >= this.config.dialogDuration) {
        const fadeProgress = (elapsed - this.config.dialogDuration) / this.config.fadeOutDuration;
        dialog.opacity = 1 - fadeProgress;
        dialog.element.style.opacity = dialog.opacity.toString();
      }

      // Actualizar posición con cámara
      this.positionBubble(
        dialog.element,
        (dialog.fragment.x - cameraX) * zoom,
        (dialog.fragment.y - cameraY) * zoom
      );
    }
  }

  /**
   * Remover un diálogo
   */
  removeDialog(id: string): void {
    const dialog = this.activeDialogs.get(id);
    if (dialog) {
      dialog.element.remove();
      this.activeDialogs.delete(id);
    }
  }

  /**
   * Obtener ID del diálogo más antiguo
   */
  private getOldestDialog(): string | null {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, dialog] of this.activeDialogs) {
      if (dialog.startTime < oldestTime) {
        oldestTime = dialog.startTime;
        oldest = id;
      }
    }

    return oldest;
  }

  /**
   * Limpiar todos los diálogos
   */
  clear(): void {
    for (const id of this.activeDialogs.keys()) {
      this.removeDialog(id);
    }
  }

  /**
   * Procesar fragmentos desde el servidor
   */
  processServerFragments(fragments: DialogFragment[]): void {
    for (const fragment of fragments) {
      if (!this.activeDialogs.has(fragment.id)) {
        this.showDialog(fragment);
      }
    }
  }

  /**
   * Destruir el controlador
   */
  destroy(): void {
    this.clear();
    this.container.remove();
  }
}
