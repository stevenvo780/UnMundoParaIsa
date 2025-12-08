import './style.css';
import { Renderer } from './render/Renderer';
import { WebSocketClient } from './network/WebSocketClient';
import { UIController } from './ui/UIController';

// ============================================
// Punto de entrada principal
// ============================================

async function main() {
  console.log('[App] Un Mundo Para Isa - Iniciando...');
  
  // Crear canvas
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('No se encontró el contenedor #app');
  }
  
  // Inicializar renderer
  const renderer = new Renderer(container);
  await renderer.init();
  
  // Conectar al backend
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
  const client = new WebSocketClient(wsUrl);
  
  // Inicializar UI
  const ui = new UIController(renderer, client);
  ui.init();
  
  // Conectar eventos
  client.on('tick', (data) => {
    if (data.particles) {
      renderer.updateParticles(data.particles);
    }
    if (data.tick !== undefined) {
      ui.updateTick(data.tick);
    }
  });
  
  client.on('field_update', (data) => {
    if (data.fields) {
      renderer.updateFields(data.fields as Record<string, number[]>);
    }
  });
  
  client.on('metrics', (data) => {
    if (data.metrics) {
      ui.updateMetrics(data.metrics);
    }
  });
  
  client.on('init', (data) => {
    console.log('[App] Recibido estado inicial');
    if (data.particles) {
      renderer.updateParticles(data.particles);
    }
  });
  
  // Conectar
  client.connect();
  
  // Iniciar render loop
  renderer.startRenderLoop();
  
  console.log('[App] Iniciado correctamente');
}

main().catch((err) => {
  console.error('[App] Error fatal:', err);
});
