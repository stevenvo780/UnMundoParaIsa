/**
 * Servidor WebSocket para Un Mundo Para Isa
 * Transmite estado de simulación al frontend
 */

import { WebSocketServer, WebSocket } from 'ws';
import { World } from './core/World.js';
import { 
  ServerMessage, 
  ClientMessage, 
  FieldType,
  SimulationConfig,
  Particle,
} from './types.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const TICK_MS = parseInt(process.env.TICK_MS || '50', 10);

// ============================================
// Estado global
// ============================================

const world = new World();
const clients = new Set<WebSocket>();

// Campos suscritos por cliente
const subscriptions = new Map<WebSocket, Set<FieldType>>();

// ============================================
// WebSocket Server
// ============================================

const wss = new WebSocketServer({ port: PORT });

console.log(`[Server] WebSocket server started on port ${PORT}`);
console.log(`[Server] Tick interval: ${TICK_MS}ms`);

// Generar mundo inicial
world.generate(Date.now());

wss.on('connection', (ws: WebSocket) => {
  console.log('[Server] Client connected');
  clients.add(ws);
  subscriptions.set(ws, new Set(['food', 'water', 'trail0', 'population']));
  
  // Enviar estado inicial
  sendInit(ws);
  
  ws.on('message', (data: Buffer) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      handleClientMessage(ws, msg);
    } catch (e) {
      console.error('[Server] Invalid message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    clients.delete(ws);
    subscriptions.delete(ws);
  });
  
  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err);
    clients.delete(ws);
    subscriptions.delete(ws);
  });
});

// ============================================
// Handlers de mensajes
// ============================================

function handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case 'start':
      world.resume();
      broadcast({ type: 'tick', tick: world.getTick() });
      break;
      
    case 'pause':
      world.pause();
      break;
      
    case 'resume':
      world.resume();
      break;
      
    case 'reset':
      world.reset();
      broadcast({ type: 'init', config: world.config, tick: 0 });
      break;
      
    case 'set_config':
      if (msg.config) {
        // Aplicar cambios de configuración
        Object.assign(world.config, msg.config);
      }
      break;
      
    case 'spawn_particles':
      if (msg.spawn) {
        world.spawnParticlesAt(
          msg.spawn.x,
          msg.spawn.y,
          msg.spawn.count,
          Date.now()
        );
      }
      break;
      
    case 'subscribe_field':
      if (msg.subscribeFields) {
        const subs = subscriptions.get(ws) || new Set();
        for (const field of msg.subscribeFields) {
          subs.add(field);
        }
        subscriptions.set(ws, subs);
      }
      break;
  }
}

function sendInit(ws: WebSocket): void {
  const msg: ServerMessage = {
    type: 'init',
    tick: world.getTick(),
    config: world.config,
    particles: world.getParticles(),
  };
  
  send(ws, msg);
  
  // Enviar campos iniciales
  sendFieldUpdates(ws);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendFieldUpdates(ws: WebSocket): void {
  const subs = subscriptions.get(ws);
  if (!subs) return;
  
  const fields: Partial<Record<FieldType, number[]>> = {};
  
  for (const fieldType of subs) {
    const buffer = world.getFieldSnapshot(fieldType);
    if (buffer) {
      // Convertir Float32Array a array normal para JSON
      fields[fieldType] = Array.from(buffer);
    }
  }
  
  const msg: ServerMessage = {
    type: 'field_update',
    tick: world.getTick(),
    fields: fields as ServerMessage['fields'],
  };
  
  send(ws, msg);
}

// ============================================
// Game Loop
// ============================================

let lastTickTime = Date.now();
let tickCount = 0;

function gameLoop(): void {
  const now = Date.now();
  
  // Solo ejecutar si no está pausado
  if (!world.isPaused()) {
    world.step();
    tickCount++;
    
    // Broadcast tick cada tick
    const particles = world.getParticles();
    
    const tickMsg: ServerMessage = {
      type: 'tick',
      tick: world.getTick(),
      particles: particles.length <= 1000 ? particles : sampleParticles(particles, 1000),
    };
    
    broadcast(tickMsg);
    
    // Enviar campos cada 5 ticks
    if (world.getTick() % 5 === 0) {
      for (const [ws, _subs] of subscriptions) {
        sendFieldUpdates(ws);
      }
    }
    
    // Enviar métricas cada segundo
    if (world.getTick() % 20 === 0) {
      const metricsMsg: ServerMessage = {
        type: 'metrics',
        metrics: world.getMetrics(),
      };
      broadcast(metricsMsg);
    }
  }
  
  // Calcular tiempo hasta el próximo tick
  const elapsed = Date.now() - now;
  const nextTick = Math.max(1, TICK_MS - elapsed);
  
  setTimeout(gameLoop, nextTick);
}

/**
 * Muestrear partículas para reducir bandwidth
 */
function sampleParticles(particles: Particle[], maxCount: number): Particle[] {
  if (particles.length <= maxCount) return particles;
  
  const result: Particle[] = [];
  const step = particles.length / maxCount;
  
  for (let i = 0; i < maxCount; i++) {
    result.push(particles[Math.floor(i * step)]);
  }
  
  return result;
}

// ============================================
// Graceful shutdown
// ============================================

process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  
  for (const client of clients) {
    client.close();
  }
  
  wss.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received');
  process.emit('SIGINT', 'SIGINT');
});

// ============================================
// Start
// ============================================

console.log('[Server] Starting game loop...');
gameLoop();

// Stats cada 10 segundos
setInterval(() => {
  const metrics = world.getMetrics();
  console.log(
    `[Stats] Tick: ${metrics.tick}, ` +
    `Particles: ${metrics.particleCount}, ` +
    `Births: ${metrics.births}, Deaths: ${metrics.deaths}, ` +
    `Time: ${metrics.tickTimeMs.toFixed(2)}ms`
  );
}, 10000);
