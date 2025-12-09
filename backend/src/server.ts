/**
 * Servidor WebSocket para Un Mundo Para Isa
 * Transmite estado de simulación al frontend
 * Soporta chunks dinámicos para mundo infinito
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { World } from './core/World.js';
import { InfiniteChunkManager } from './core/InfiniteChunkManager.js';
import { 
  ServerMessage, 
  ClientMessage, 
  FieldType,
  SimulationConfig,
  Particle,
  ChunkSnapshot,
  ViewportData,
} from './types.js';
import {
  getMetrics,
  updateSimulationMetrics,
  wsConnectionsActive,
  wsMessagesReceived,
  wsMessagesSent,
  chunksGenerated,
} from './metrics/prometheus.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9090', 10);
const TICK_MS = parseInt(process.env.TICK_MS || '50', 10);

// ============================================
// Estado global
// ============================================

const world = new World();
const infiniteChunks = new InfiniteChunkManager({ seed: world.config.seed });

// Inyectar InfiniteChunkManager en World para movimiento infinito de partículas
world.setInfiniteChunkManager(infiniteChunks);

const clients = new Set<WebSocket>();

// Campos suscritos por cliente
const subscriptions = new Map<WebSocket, Set<FieldType>>();

// Viewports por cliente
const clientViewports = new Map<WebSocket, ViewportData>();

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
  wsConnectionsActive.inc();
  
  // Enviar estado inicial
  sendInit(ws);
  
  ws.on('message', (data: Buffer) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      wsMessagesReceived.inc();
      handleClientMessage(ws, msg);
    } catch (e) {
      console.error('[Server] Invalid message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    clients.delete(ws);
    subscriptions.delete(ws);
    clientViewports.delete(ws);
    wsConnectionsActive.dec();
  });
  
  ws.on('error', (err) => {
    console.error('[Server] WebSocket error:', err);
    clients.delete(ws);
    subscriptions.delete(ws);
    clientViewports.delete(ws);
    wsConnectionsActive.dec();
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
    
    case 'viewport_update':
      if (msg.viewport) {
        clientViewports.set(ws, msg.viewport);
        // Generar chunks visibles y enviarlos
        const newChunks = infiniteChunks.updateFromViewport(msg.viewport);
        if (newChunks.length > 0) {
          sendChunkData(ws, newChunks);
        }
      }
      break;
    
    case 'request_chunks':
      if (msg.chunkRequests) {
        const chunks: ChunkSnapshot[] = [];
        for (const coord of msg.chunkRequests) {
          const chunk = infiniteChunks.ensureChunkActive(coord.cx, coord.cy);
          chunks.push(infiniteChunks.serializeChunk(chunk));
        }
        sendChunkData(ws, chunks);
      }
      break;
  }
}

function sendInit(ws: WebSocket): void {
  // Generar chunks iniciales alrededor del centro
  const initialViewport: ViewportData = {
    centerX: 256,
    centerY: 256,
    zoom: 1,
    width: 800,
    height: 600,
  };
  
  console.log(`[Server] Getting all visible chunks for viewport center (${initialViewport.centerX}, ${initialViewport.centerY})`);
  // Usar getChunksForViewport para obtener TODOS los chunks visibles, no solo los nuevos
  const initialChunks = infiniteChunks.getChunksForViewport(initialViewport);
  console.log(`[Server] Got ${initialChunks.length} chunks for initial viewport`);
  
  const msg: ServerMessage = {
    type: 'init',
    tick: world.getTick(),
    config: world.config,
    particles: world.getParticles(),
    structures: world.getStructures(),
  };
  
  send(ws, msg);
  
  // Enviar chunks iniciales
  if (initialChunks.length > 0) {
    console.log(`[Server] Sending ${initialChunks.length} initial chunks: ${initialChunks.slice(0, 5).map(c => `(${c.cx},${c.cy})`).join(', ')}...`);
    sendChunkData(ws, initialChunks);
  }
  
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

function sendChunkData(ws: WebSocket, chunks: ChunkSnapshot[]): void {
  // Enviar en batches para evitar mensajes demasiado grandes
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    // Serializar chunks para JSON
    const serializedChunks = batch.map(chunk => ({
      ...chunk,
      fields: Object.fromEntries(
        Object.entries(chunk.fields).map(([key, buffer]) => [
          key,
          buffer ? Array.from(new Float32Array(buffer)) : []
        ])
      ),
    }));
    
    const msg: ServerMessage = {
      type: 'chunk_data',
      tick: world.getTick(),
      chunks: serializedChunks as unknown as ChunkSnapshot[],
    };
    
    send(ws, msg);
  }
  
  console.log(`[Server] Sent ${chunks.length} chunks in ${Math.ceil(chunks.length / BATCH_SIZE)} batches`);
}

function broadcastChunks(chunks: ChunkSnapshot[]): void {
  for (const client of clients) {
    sendChunkData(client, chunks);
  }
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
    infiniteChunks.step();
    tickCount++;
    
    // Actualizar chunks desde posición de partículas
    const particles = world.getParticles();
    const newChunksFromParticles = infiniteChunks.updateFromParticles(particles);
    if (newChunksFromParticles.length > 0) {
      broadcastChunks(newChunksFromParticles);
    }
    
    // Limpiar chunks antiguos cada 100 ticks
    if (world.getTick() % 100 === 0) {
      infiniteChunks.cleanup();
    }
    
    // Broadcast tick cada tick
    const tickMsg: ServerMessage = {
      type: 'tick',
      tick: world.getTick(),
      particles: particles.length <= 1000 ? particles : sampleParticles(particles, 1000),
      structures: world.getStructures(), // Incluir estructuras
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
      const metrics = world.getMetrics();
      const chunkStats = infiniteChunks.getStats();
      const metricsMsg: ServerMessage = {
        type: 'metrics',
        metrics: metrics,
      };
      broadcast(metricsMsg);
      
      // Calcular energía promedio desde partículas
      const aliveParticles = particles.filter(p => p.alive);
      const avgEnergy = aliveParticles.length > 0 
        ? aliveParticles.reduce((sum, p) => sum + (p.energy ?? 0), 0) / aliveParticles.length 
        : 0;
      
      // Protección contra NaN
      const safeAvgEnergy = isNaN(avgEnergy) ? 0 : avgEnergy;
      
      // Actualizar métricas de Prometheus
      updateSimulationMetrics({
        tick: world.getTick(),
        particles: metrics.particleCount,
        avgEnergy: safeAvgEnergy,
        births: metrics.births,
        deaths: metrics.deaths,
        tickTimeMs: metrics.tickTimeMs,
        chunksActive: chunkStats.active,
        chunksCached: chunkStats.dormant,
      });
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
// Prometheus Metrics HTTP Server
// ============================================

const metricsServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/metrics') {
    try {
      const metrics = await getMetrics();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.writeHead(200);
      res.end(metrics);
    } catch (error) {
      res.writeHead(500);
      res.end('Error collecting metrics');
    }
  } else if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'ok', 
      tick: world.getTick(),
      particles: world.getParticles().length,
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

metricsServer.listen(METRICS_PORT, () => {
  console.log(`[Server] Prometheus metrics available at http://localhost:${METRICS_PORT}/metrics`);
  console.log(`[Server] Health check available at http://localhost:${METRICS_PORT}/health`);
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
