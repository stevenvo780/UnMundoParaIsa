import "./style.css";
import { Renderer } from "./render/Renderer";
import { WebSocketClient } from "./network/WebSocketClient";
import { ViewportData, ChunkSnapshot } from "./types";
import { createRoot } from "react-dom/client";
import { App } from "./ui/components/App";

// ============================================
// Punto de entrada principal
// ============================================

async function main() {
  console.log("[App] Un Mundo Para Isa - Iniciando...");

  // Obtener el canvas-container específico para el renderer
  const container = document.getElementById("canvas-container");
  if (!container) {
    throw new Error("No se encontró el contenedor #canvas-container");
  }

  // Remover el canvas placeholder existente (será reemplazado por PixiJS)
  const existingCanvas = document.getElementById("world-canvas");
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // Inicializar renderer
  const renderer = new Renderer(container);
  await renderer.init();

  // Conectar al backend - usa /ws relativo para funcionar via nginx proxy
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl =
    import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`;
  const client = new WebSocketClient(wsUrl);

  // Inicializar UI (React)
  const uiRoot = document.getElementById("ui-root");
  if (uiRoot) {
    const root = createRoot(uiRoot);
    root.render(<App client={client} renderer={renderer} />);
  } else {
    console.error("UI Root not found!");
  }

  // Registrar callback de viewport para chunks dinámicos
  renderer.onViewportUpdate((viewport: ViewportData) => {
    client.send({
      type: "viewport_update",
      viewport,
    });
  });

  // Conectar eventos
  client.on("tick", (data) => {
    if (data.particles) {
      renderer.updateParticles(data.particles);
    }
    if (data.structures) {
      renderer.updateStructures(data.structures);
    }
    // Tick update for UI is handled within React components via subscription
  });

  client.on("field_update", (data) => {
    if (data.fields) {
      renderer.updateFields(data.fields as Record<string, number[]>);
    }
  });

  // Nuevo: manejar chunks dinámicos
  client.on("chunk_data", (data) => {
    if (data.chunks) {
      // console.log(`[App] Recibidos ${(data.chunks as ChunkSnapshot[]).length} chunks`);
      renderer.handleChunks(data.chunks as ChunkSnapshot[]);
    }
  });

  client.on("chunk_unload", (data: unknown) => {
    const unloadData = data as { cx?: number; cy?: number };
    if (unloadData.cx !== undefined && unloadData.cy !== undefined) {
      renderer.handleChunkUnload(unloadData.cx, unloadData.cy);
    }
  });

  client.on("metrics", (data) => {
    // Metrics handled by React
  });

  client.on("init", (data) => {
    console.log("[App] Recibido estado inicial");

    // Ocultar pantalla de carga handled by React/App state if we wanted,
    // but we just removed the loading spinner from HTML so it's fine.

    if (data.particles) {
      renderer.updateParticles(data.particles);
    }

    if (data.structures) {
      renderer.updateStructures(data.structures);
    }

    // Enviar viewport inicial para recibir chunks
    const viewport = renderer.getViewport();
    client.send({
      type: "viewport_update",
      viewport,
    });
  });

  // Conectar
  client.connect();

  // Iniciar render loop
  renderer.startRenderLoop();

  console.log("[App] Iniciado correctamente");
}

main().catch((err) => {
  console.error("[App] Error fatal:", err);
});
