/**
 * Cliente WebSocket para comunicación con el backend
 */

import { ServerMessage, ClientMessage, FieldType } from '../types';

type EventHandler = (data: ServerMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private connected = false;
  
  constructor(url: string) {
    this.url = url;
  }
  
  /**
   * Conectar al servidor
   */
  connect(): void {
    if (this.ws) {
      this.ws.close();
    }
    
    console.log(`[WS] Conectando a ${this.url}...`);
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      console.log('[WS] Conectado');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', {} as ServerMessage);
    };
    
    this.ws.onclose = () => {
      console.log('[WS] Desconectado');
      this.connected = false;
      this.emit('disconnected', {} as ServerMessage);
      this.tryReconnect();
    };
    
    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.emit('error', { error: 'WebSocket error' } as unknown as ServerMessage);
    };
    
    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        // Debug: Log chunk messages
        if (msg.type === 'chunk_data') {
          console.log(`[WS] Recibido chunk_data con ${(msg as { chunks?: unknown[] }).chunks?.length ?? 0} chunks`);
        }
        this.emit(msg.type, msg);
      } catch (e) {
        console.error('[WS] Error parseando mensaje:', e);
      }
    };
  }
  
  /**
   * Intentar reconectar
   */
  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Máximo de intentos de reconexión alcanzado');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconectando en ${delay}ms (intento ${this.reconnectAttempts})...`);
    
    setTimeout(() => {
      if (!this.connected) {
        this.connect();
      }
    }, delay);
  }
  
  /**
   * Suscribirse a un evento
   */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }
  
  /**
   * Desuscribirse de un evento
   */
  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }
  
  /**
   * Emitir evento a handlers locales
   */
  private emit(event: string, data: ServerMessage): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (e) {
          console.error(`[WS] Error en handler de ${event}:`, e);
        }
      }
    }
  }
  
  /**
   * Enviar mensaje al servidor
   */
  send(msg: ClientMessage): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] No conectado, mensaje no enviado');
    }
  }
  
  /**
   * Comandos de control
   */
  start(): void {
    this.send({ type: 'start' });
  }
  
  pause(): void {
    this.send({ type: 'pause' });
  }
  
  resume(): void {
    this.send({ type: 'resume' });
  }
  
  reset(): void {
    this.send({ type: 'reset' });
  }
  
  /**
   * Spawn partículas
   */
  spawnParticles(x: number, y: number, count: number): void {
    this.send({
      type: 'spawn_particles',
      spawn: { x, y, count },
    });
  }
  
  /**
   * Suscribirse a campos
   */
  subscribeFields(fields: FieldType[]): void {
    this.send({
      type: 'subscribe_field',
      subscribeFields: fields,
    });
  }
  
  /**
   * Estado de conexión
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Desconectar
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}
