/**
 * Cliente WebSocket para comunicación con el backend
 */

import {
  ServerMessage,
  ClientMessage,
  FieldType,
  ClientMessageType,
} from "../types";

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

    this.ws = new WebSocket(this.url);

    this.ws.onopen = (): void => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit("connected", {} as ServerMessage);
    };

    this.ws.onclose = (): void => {
      this.connected = false;
      this.emit("disconnected", {} as ServerMessage);
      this.tryReconnect();
    };

    this.ws.onerror = (err: Event): void => {
      console.error("[WS] Error:", err);
      this.emit("error", {
        error: "WebSocket error",
      } as unknown as ServerMessage);
    };

    this.ws.onmessage = (event: MessageEvent<string>): void => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.emit(msg.type, msg);
      } catch (e) {
        console.error("[WS] Error parseando mensaje:", e);
      }
    };
  }

  /**
   * Intentar reconectar
   */
  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

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
    }
  }

  /**
   * Comandos de control
   */
  start(): void {
    this.send({ type: ClientMessageType.START });
  }

  pause(): void {
    this.send({ type: ClientMessageType.PAUSE });
  }

  resume(): void {
    this.send({ type: ClientMessageType.RESUME });
  }

  reset(): void {
    this.send({ type: ClientMessageType.RESET });
  }

  /**
   * Spawn partículas
   */
  spawnParticles(x: number, y: number, count: number): void {
    this.send({
      type: ClientMessageType.SPAWN_PARTICLES,
      spawn: { x, y, count },
    });
  }

  /**
   * Suscribirse a campos
   */
  subscribeFields(fields: FieldType[]): void {
    this.send({
      type: ClientMessageType.SUBSCRIBE_FIELD,
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
