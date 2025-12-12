/**
 * Servidor WebSocket para Un Mundo Para Isa
 * Transmite estado de simulación al frontend
 * Soporta chunks dinámicos para mundo infinito
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { World } from "./core/World";
import { InfiniteChunkManager } from "./core/InfiniteChunkManager";
import { Logger } from "./utils/Logger";
import {
  ServerMessage,
  ClientMessage,
  FieldType,
  Particle,
  ChunkSnapshot,
  ViewportData,
  ServerMessageType,
  ClientMessageType,
  MAX_PARTICLES_PER_TICK,
} from "./types";
import {
  getMetrics,
  updateSimulationMetrics,
  updateEmergenceMetrics,
  updateBiodiversityMetrics,
  updateSocialMetrics,
  updateEconomyMetrics,
  updateTimeMetrics,
  updateQuestMetrics,
  updateFieldMetrics,
  wsConnectionsActive,
  wsMessagesReceived,
} from "./metrics/prometheus";

const PORT = parseInt(process.env.PORT || "3002", 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT || "9090", 10);
const TICK_MS = parseInt(process.env.TICK_MS || "50", 10);

const world = new World();
const infiniteChunks = new InfiniteChunkManager({ seed: world.config.seed });

world.setInfiniteChunkManager(infiniteChunks);

const clients = new Set<WebSocket>();

const subscriptions = new Map<WebSocket, Set<FieldType>>();

const clientViewports = new Map<WebSocket, ViewportData>();

const wss = new WebSocketServer({ port: PORT });

Logger.info(`[Server] WebSocket server started on port ${PORT}`);
Logger.info(`[Server] Tick interval: ${TICK_MS}ms`);

world.generate(Date.now());

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);
  subscriptions.set(
    ws,
    new Set<FieldType>([
      FieldType.FOOD,
      FieldType.WATER,
      FieldType.TRAIL0,
      FieldType.POPULATION,
    ]),
  );
  wsConnectionsActive.inc();

  sendInit(ws);

  ws.on("message", (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;
      wsMessagesReceived.inc();
      handleClientMessage(ws, msg);
    } catch (e) {
      Logger.error("[Server] Invalid message:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    subscriptions.delete(ws);
    clientViewports.delete(ws);
    wsConnectionsActive.dec();
  });

  ws.on("error", (err) => {
    Logger.error("[Server] WebSocket error:", err);
    clients.delete(ws);
    subscriptions.delete(ws);
    clientViewports.delete(ws);
    wsConnectionsActive.dec();
  });
});

function handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case ClientMessageType.START:
      world.resume();
      broadcast({ type: ServerMessageType.TICK, tick: world.getTick() });
      break;

    case ClientMessageType.PAUSE:
      world.pause();
      break;

    case ClientMessageType.RESUME:
      world.resume();
      break;

    case ClientMessageType.RESET:
      world.reset();
      broadcast({
        type: ServerMessageType.INIT,
        config: world.config,
        tick: 0,
      });
      break;

    case ClientMessageType.SET_CONFIG:
      if (msg.config) {
        Object.assign(world.config, msg.config);
      }
      break;

    case ClientMessageType.SPAWN_PARTICLES:
      if (msg.spawn) {
        world.spawnParticlesAt(
          msg.spawn.x,
          msg.spawn.y,
          msg.spawn.count,
          Date.now(),
        );
      }
      break;

    case ClientMessageType.SUBSCRIBE_FIELD:
      if (msg.subscribeFields) {
        const subs = subscriptions.get(ws) || new Set<FieldType>();
        for (const field of msg.subscribeFields) {
          subs.add(field);
        }
        subscriptions.set(ws, subs);
      }
      break;

    case ClientMessageType.VIEWPORT_UPDATE:
      if (msg.viewport) {
        clientViewports.set(ws, msg.viewport);

        const newChunks = infiniteChunks.updateFromViewport(msg.viewport);
        if (newChunks.length > 0) {
          sendChunkData(ws, newChunks);
        }
      }
      break;

    case ClientMessageType.REQUEST_CHUNKS:
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
  const initialViewport: ViewportData = {
    centerX: 256,
    centerY: 256,
    zoom: 1,
    width: 800,
    height: 600,
  };

  const initialChunks = infiniteChunks.getChunksForViewport(initialViewport);

  const msg: ServerMessage = {
    type: ServerMessageType.INIT,
    tick: world.getTick(),
    config: world.config,
    particles: world.getParticles(),
    structures: world.getStructures(),
  };

  send(ws, msg);

  if (initialChunks.length > 0) {
    sendChunkData(ws, initialChunks);
  }

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
      fields[fieldType] = Array.from(buffer);
    }
  }

  const msg: ServerMessage = {
    type: ServerMessageType.FIELD_UPDATE,
    tick: world.getTick(),
    fields: fields as ServerMessage["fields"],
  };

  send(ws, msg);
}

function sendChunkData(ws: WebSocket, chunks: ChunkSnapshot[]): void {
  const BATCH_SIZE = 10;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const serializedChunks = batch.map((chunk) => ({
      ...chunk,
      fields: Object.fromEntries(
        Object.entries(chunk.fields).map(([key, buffer]) => [
          key,
          buffer ? Array.from(new Float32Array(buffer)) : [],
        ]),
      ),
    }));

    const msg: ServerMessage = {
      type: ServerMessageType.CHUNK_DATA,
      tick: world.getTick(),
      chunks: serializedChunks as unknown as ChunkSnapshot[],
    };

    send(ws, msg);
  }
}

function broadcastChunks(chunks: ChunkSnapshot[]): void {
  for (const client of clients) {
    sendChunkData(client, chunks);
  }
}

function gameLoop(): void {
  const now = Date.now();

  if (!world.isPaused()) {
    world.step();
    infiniteChunks.step();

    const particles = world.getParticles();
    const newChunksFromParticles =
      infiniteChunks.updateFromParticles(particles);
    if (newChunksFromParticles.length > 0) {
      broadcastChunks(newChunksFromParticles);
    }

    if (world.getTick() % 100 === 0) {
      infiniteChunks.cleanup();
    }

    const tickMsg: ServerMessage = {
      type: ServerMessageType.TICK,
      tick: world.getTick(),
      particles:
        particles.length <= MAX_PARTICLES_PER_TICK
          ? particles
          : sampleParticles(particles, MAX_PARTICLES_PER_TICK),
      structures: world.getStructures(),
    };

    broadcast(tickMsg);

    if (world.getTick() % 5 === 0) {
      for (const ws of subscriptions.keys()) {
        sendFieldUpdates(ws);
      }
    }

    if (world.getTick() % 20 === 0) {
      const metrics = world.getMetrics();
      const chunkStats = infiniteChunks.getStats();
      const metricsMsg: ServerMessage = {
        type: ServerMessageType.METRICS,
        metrics: metrics,
      };
      broadcast(metricsMsg);

      const aliveParticles = particles.filter((p) => p.alive);
      const avgEnergy =
        aliveParticles.length > 0
          ? aliveParticles.reduce((sum, p) => sum + (p.energy ?? 0), 0) /
            aliveParticles.length
          : 0;
      const totalEnergy = aliveParticles.reduce(
        (sum, p) => sum + (p.energy ?? 0),
        0,
      );

      const safeAvgEnergy = isNaN(avgEnergy) ? 0 : avgEnergy;

      updateSimulationMetrics({
        tick: world.getTick(),
        particles: metrics.particleCount,
        avgEnergy: safeAvgEnergy,
        totalEnergy: totalEnergy,
        births: metrics.births,
        deaths: metrics.deaths,
        tickTimeMs: metrics.tickTimeMs,
        chunksActive: chunkStats.active,
        chunksCached: chunkStats.dormant,
        structures: metrics.structureStats?.byType,
      });

      const emergenceData =
        metrics.emergence ?? world.getEmergenceMetrics();
      updateEmergenceMetrics(emergenceData);

      const biodiversityData =
        metrics.biodiversity ?? world.getBiodiversityMetrics();
      updateBiodiversityMetrics(biodiversityData);

      const socialData = world.getSocialMetrics();
      updateSocialMetrics(socialData);

      const economyData = world.getEconomyMetrics();
      updateEconomyMetrics(economyData);

      const timeData = world.getTimeMetrics();
      updateTimeMetrics(timeData);

      const questData = world.getQuestMetrics();
      updateQuestMetrics(questData);

      const fieldData = world.getFieldMetrics();
      for (const f of fieldData) {
        updateFieldMetrics(f);
      }
    }
  }

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

process.on("SIGINT", () => {
  Logger.info("[Server] Shutting down...");

  for (const client of clients) {
    client.close();
  }

  wss.close(() => {
    Logger.info("[Server] Closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  Logger.info("[Server] SIGTERM received");
  process.emit("SIGINT", "SIGINT");
});

const metricsServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/metrics") {
      try {
        const metrics = await getMetrics();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.writeHead(200);
        res.end(metrics);
      } catch (_error) {
        res.writeHead(500);
        res.end("Error collecting metrics");
      }
    } else if (req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          tick: world.getTick(),
          particles: world.getParticles().length,
        }),
      );
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  },
);

metricsServer.listen(METRICS_PORT, () => {
  Logger.info(
    `[Server] Prometheus metrics available at http://localhost:${METRICS_PORT}/metrics`,
  );
  Logger.info(
    `[Server] Health check available at http://localhost:${METRICS_PORT}/health`,
  );
});

Logger.info("[Server] Starting game loop...");
gameLoop();

setInterval(() => {
  const metrics = world.getMetrics();
  Logger.info(
    `[Stats] Tick: ${metrics.tick}, ` +
      `Particles: ${metrics.particleCount}, ` +
      `Births: ${metrics.births}, Deaths: ${metrics.deaths}, ` +
      `Time: ${metrics.tickTimeMs.toFixed(2)}ms`,
  );
}, 10000);
