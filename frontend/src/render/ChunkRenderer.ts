/**
 * ChunkRenderer - Renderiza chunks dinámicos con PixiJS
 * Maneja terreno, agua, árboles por chunk individual
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ChunkSnapshot, WORLD, FieldType } from '../types';
import { AssetLoader } from './AssetLoader';

const TILE_SIZE = 32;
const WATER_THRESHOLD = 0.4;
const TREE_DENSITY = 0.15;

export interface RenderedChunk {
  cx: number;
  cy: number;
  worldX: number;
  worldY: number;
  container: Container;
  terrainSprites: Sprite[];
  waterSprites: Sprite[];
  treeSprites: Sprite[];
  lastAccessTime: number;
}

export class ChunkRenderer {
  private chunks: Map<string, RenderedChunk> = new Map();
  private assetLoader: AssetLoader;
  private parentContainer: Container;
  
  constructor(parentContainer: Container, assetLoader: AssetLoader) {
    this.parentContainer = parentContainer;
    this.assetLoader = assetLoader;
  }
  
  private keyFor(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }
  
  /**
   * Renderizar un chunk desde sus datos
   */
  renderChunk(snapshot: ChunkSnapshot): RenderedChunk {
    const key = this.keyFor(snapshot.cx, snapshot.cy);
    
    // Debug: mostrar datos del chunk
    const foodLen = snapshot.fields.food?.length ?? 0;
    const waterLen = snapshot.fields.water?.length ?? 0;
    const treesLen = snapshot.fields.trees?.length ?? 0;
    console.log(`[ChunkRenderer] Rendering chunk (${snapshot.cx}, ${snapshot.cy}) - food:${foodLen} water:${waterLen} trees:${treesLen}`);
    
    // Si ya existe, actualizarlo
    let existing = this.chunks.get(key);
    if (existing) {
      this.updateChunk(existing, snapshot);
      return existing;
    }
    
    // Crear nuevo chunk
    const container = new Container();
    container.position.set(snapshot.worldX, snapshot.worldY);
    container.sortableChildren = true;
    
    const chunk: RenderedChunk = {
      cx: snapshot.cx,
      cy: snapshot.cy,
      worldX: snapshot.worldX,
      worldY: snapshot.worldY,
      container,
      terrainSprites: [],
      waterSprites: [],
      treeSprites: [],
      lastAccessTime: Date.now(),
    };
    
    // Generar capas
    this.generateTerrain(chunk, snapshot);
    this.generateWater(chunk, snapshot);
    this.generateTrees(chunk, snapshot);
    
    // Añadir al contenedor padre
    this.parentContainer.addChild(container);
    this.chunks.set(key, chunk);
    
    console.log(`[ChunkRenderer] Rendered chunk (${snapshot.cx}, ${snapshot.cy})`);
    return chunk;
  }
  
  /**
   * Actualizar chunk existente
   */
  private updateChunk(chunk: RenderedChunk, snapshot: ChunkSnapshot): void {
    chunk.lastAccessTime = Date.now();
    // Por ahora solo actualizamos el tiempo de acceso
    // Podríamos actualizar campos si cambian significativamente
  }
  
  /**
   * Generar terreno para un chunk
   */
  private generateTerrain(chunk: RenderedChunk, snapshot: ChunkSnapshot): void {
    const foodField = snapshot.fields.food;
    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);
    
    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;
        
        const foodValue = this.getFieldValue(foodField, tx, ty, snapshot.size);
        const texture = this.assetLoader.getTerrainTile(
          snapshot.cx * tilesPerChunk + tx,
          snapshot.cy * tilesPerChunk + ty,
          foodValue
        );
        
        const sprite = new Sprite(texture);
        sprite.x = localX;
        sprite.y = localY;
        sprite.width = TILE_SIZE + 1;
        sprite.height = TILE_SIZE + 1;
        sprite.zIndex = 0;
        
        chunk.container.addChild(sprite);
        chunk.terrainSprites.push(sprite);
      }
    }
  }
  
  /**
   * Generar agua para un chunk
   */
  private generateWater(chunk: RenderedChunk, snapshot: ChunkSnapshot): void {
    const waterField = snapshot.fields.water;
    if (!waterField) return;
    
    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);
    
    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;
        
        const waterValue = this.getFieldValue(waterField, tx, ty, snapshot.size);
        
        if (waterValue > WATER_THRESHOLD) {
          const texture = this.assetLoader.getWaterTile(
            snapshot.cx * tilesPerChunk + tx,
            snapshot.cy * tilesPerChunk + ty
          );
          
          const sprite = new Sprite(texture);
          sprite.x = localX;
          sprite.y = localY;
          sprite.width = TILE_SIZE + 1;
          sprite.height = TILE_SIZE + 1;
          sprite.alpha = Math.min(1, waterValue);
          sprite.zIndex = 1;
          
          chunk.container.addChild(sprite);
          chunk.waterSprites.push(sprite);
        }
      }
    }
  }
  
  /**
   * Generar árboles para un chunk
   */
  private generateTrees(chunk: RenderedChunk, snapshot: ChunkSnapshot): void {
    const foodField = snapshot.fields.food;
    const treesField = snapshot.fields.trees;
    if (!foodField) return;
    
    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);
    
    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const globalTx = snapshot.cx * tilesPerChunk + tx;
        const globalTy = snapshot.cy * tilesPerChunk + ty;
        
        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;
        
        const foodValue = this.getFieldValue(foodField, tx, ty, snapshot.size);
        const treeValue = treesField ? this.getFieldValue(treesField, tx, ty, snapshot.size) : 0;
        
        // Decidir si colocar árbol
        const pseudoRandom = Math.abs(Math.sin(globalTx * 12.9898 + globalTy * 78.233) * 43758.5453) % 1;
        const shouldPlaceTree = (foodValue > 0.3 || treeValue > 0.3) && pseudoRandom < TREE_DENSITY;
        
        if (shouldPlaceTree) {
          const isForest = foodValue > 0.5 || treeValue > 0.5;
          const texture = this.assetLoader.getTreeTexture(globalTx, globalTy, isForest);
          
          const sprite = new Sprite(texture);
          
          const offsetX = (pseudoRandom - 0.5) * TILE_SIZE * 0.5;
          const offsetY = ((pseudoRandom * 2) % 1 - 0.5) * TILE_SIZE * 0.5;
          
          sprite.x = localX + TILE_SIZE / 2 + offsetX;
          sprite.y = localY + TILE_SIZE + offsetY;
          sprite.anchor.set(0.5, 1);
          
          const scale = 0.3 + (foodValue + treeValue) / 2 * 0.3;
          sprite.scale.set(scale);
          sprite.zIndex = 2 + ty; // Ordenar por Y para profundidad
          
          chunk.container.addChild(sprite);
          chunk.treeSprites.push(sprite);
        }
      }
    }
  }
  
  /**
   * Obtener valor de campo en coordenadas de tile
   */
  private getFieldValue(
    field: number[] | undefined,
    tileX: number,
    tileY: number,
    chunkSize: number
  ): number {
    if (!field || field.length === 0) return 0;
    
    // Calcular índice basado en el tamaño del chunk
    const gridSize = Math.sqrt(field.length);
    const tilesPerChunk = Math.ceil(chunkSize / TILE_SIZE);
    
    // Mapear coordenadas de tile a índice de campo
    const fieldX = Math.floor(tileX * gridSize / tilesPerChunk);
    const fieldY = Math.floor(tileY * gridSize / tilesPerChunk);
    
    if (fieldX < 0 || fieldX >= gridSize || fieldY < 0 || fieldY >= gridSize) return 0;
    
    const index = fieldY * gridSize + fieldX;
    return field[index] ?? 0;
  }
  
  /**
   * Descargar chunk
   */
  unloadChunk(cx: number, cy: number): void {
    const key = this.keyFor(cx, cy);
    const chunk = this.chunks.get(key);
    
    if (chunk) {
      chunk.container.destroy({ children: true });
      this.chunks.delete(key);
      console.log(`[ChunkRenderer] Unloaded chunk (${cx}, ${cy})`);
    }
  }
  
  /**
   * Limpiar chunks antiguos
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    
    for (const [key, chunk] of this.chunks) {
      if (now - chunk.lastAccessTime > maxAge) {
        this.unloadChunk(chunk.cx, chunk.cy);
      }
    }
  }
  
  /**
   * Verificar si chunk está cargado
   */
  hasChunk(cx: number, cy: number): boolean {
    return this.chunks.has(this.keyFor(cx, cy));
  }
  
  /**
   * Obtener chunk renderizado
   */
  getChunk(cx: number, cy: number): RenderedChunk | undefined {
    return this.chunks.get(this.keyFor(cx, cy));
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): { loaded: number; sprites: number } {
    let sprites = 0;
    for (const chunk of this.chunks.values()) {
      sprites += chunk.terrainSprites.length + chunk.waterSprites.length + chunk.treeSprites.length;
    }
    return { loaded: this.chunks.size, sprites };
  }
  
  /**
   * Destruir todos los chunks
   */
  destroy(): void {
    for (const chunk of this.chunks.values()) {
      chunk.container.destroy({ children: true });
    }
    this.chunks.clear();
  }
}
