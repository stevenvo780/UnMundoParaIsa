/**
 * ChunkRenderer - Renderiza chunks dinámicos con PixiJS
 * Maneja terreno, agua, árboles por chunk individual
 * Soporta biomas con colores distintivos
 */

import { Container, Sprite } from "pixi.js";
import {
  ChunkSnapshot,
  BiomeType,
  BIOME_COLORS,
  BIOME_ORDER,
} from "@shared/types";
import { AssetLoader } from "./AssetLoader";

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
    const biomeData = this.normalizeBiomeData(snapshot.biomes);

    // Si ya existe, actualizarlo
    const existing = this.chunks.get(key);
    if (existing) {
      this.updateChunk(existing, snapshot, biomeData);
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
    this.generateTerrain(chunk, snapshot, biomeData);
    this.generateWater(chunk, snapshot, biomeData);
    this.generateTrees(chunk, snapshot, biomeData);

    // Añadir al contenedor padre
    this.parentContainer.addChild(container);
    this.chunks.set(key, chunk);

    return chunk;
  }

  /**
   * Actualizar chunk existente
   */
  private updateChunk(
    chunk: RenderedChunk,
    _snapshot: ChunkSnapshot,
    _biomes?: Uint8Array,
  ): void {
    chunk.lastAccessTime = Date.now();
    // Por ahora solo actualizamos el tiempo de acceso
    // Podríamos actualizar campos si cambian significativamente
  }

  /**
   * Normalizar data de biomas recibida en el snapshot
   */
  private normalizeBiomeData(
    data: ChunkSnapshot["biomes"],
  ): Uint8Array | undefined {
    if (!data) return undefined;

    if (Array.isArray(data)) {
      return Uint8Array.from(data);
    }

    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }

    return undefined;
  }

  /**
   * Generar terreno para un chunk con colores de bioma
   */
  private generateTerrain(
    chunk: RenderedChunk,
    snapshot: ChunkSnapshot,
    biomes?: Uint8Array,
  ): void {
    const foodField = snapshot.fields.food;
    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);

    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;

        // Obtener bioma para este tile
        const biomeIndex = this.getBiomeIndex(biomes, tx, ty, snapshot.size);
        const biome = BIOME_ORDER[biomeIndex] || BiomeType.GRASSLAND;
        const biomeColor = BIOME_COLORS[biome] || 0x7cb342;

        const foodValue = this.getFieldValue(
          foodField as number[],
          tx,
          ty,
          snapshot.size,
        );

        // Seleccionar textura base según bioma
        const isForest =
          biome === BiomeType.FOREST || biome === BiomeType.SWAMP;
        const texture = this.assetLoader.getTerrainTile(
          snapshot.cx * tilesPerChunk + tx,
          snapshot.cy * tilesPerChunk + ty,
          isForest ? 0.5 : foodValue,
        );

        const sprite = new Sprite(texture);
        sprite.x = localX;
        sprite.y = localY;
        sprite.width = TILE_SIZE + 1;
        sprite.height = TILE_SIZE + 1;
        sprite.zIndex = 0;

        // Aplicar tint del bioma
        sprite.tint = biomeColor;

        // Biomas de agua tienen alpha diferente
        if (biome === BiomeType.OCEAN || biome === BiomeType.LAKE) {
          sprite.alpha = 0.9;
        }

        chunk.container.addChild(sprite);
        chunk.terrainSprites.push(sprite);
      }
    }
  }

  /**
   * Obtener índice de bioma para un tile
   */
  private getBiomeIndex(
    biomes: Uint8Array | undefined,
    tileX: number,
    tileY: number,
    chunkSize: number,
  ): number {
    if (!biomes || biomes.length === 0) return 0; // Default to GRASSLAND

    const tilesPerChunk = Math.ceil(chunkSize / TILE_SIZE);

    // Mapear tile a índice en el array de biomas
    // biomes tiene un valor por cada unidad (64x64 = 4096 valores)
    const biomesPerRow = Math.sqrt(biomes.length);
    const fx = Math.floor((tileX * biomesPerRow) / tilesPerChunk);
    const fy = Math.floor((tileY * biomesPerRow) / tilesPerChunk);

    const index = fy * biomesPerRow + fx;
    return biomes[Math.min(index, biomes.length - 1)] || 0;
  }

  /**
   * Generar agua para un chunk (basado en biomas de agua)
   */
  private generateWater(
    chunk: RenderedChunk,
    snapshot: ChunkSnapshot,
    biomes?: Uint8Array,
  ): void {
    const waterField = snapshot.fields.water;
    if (!waterField && !biomes) return;

    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);

    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;

        // Verificar si el bioma es agua
        const biomeIndex = this.getBiomeIndex(biomes, tx, ty, snapshot.size);
        const biome = BIOME_ORDER[biomeIndex] || BiomeType.GRASSLAND;
        const isWaterBiome =
          biome === BiomeType.OCEAN ||
          biome === BiomeType.LAKE ||
          biome === BiomeType.RIVER;

        const waterValue = this.getFieldValue(
          waterField as number[],
          tx,
          ty,
          snapshot.size,
        );

        // Renderizar agua si el campo de agua es alto O si es bioma de agua
        if (waterValue > WATER_THRESHOLD || isWaterBiome) {
          const texture = this.assetLoader.getWaterTile(
            snapshot.cx * tilesPerChunk + tx,
            snapshot.cy * tilesPerChunk + ty,
          );

          const sprite = new Sprite(texture);
          sprite.x = localX;
          sprite.y = localY;
          sprite.width = TILE_SIZE + 1;
          sprite.height = TILE_SIZE + 1;

          // Alpha basado en tipo de agua
          if (isWaterBiome) {
            sprite.alpha = biome === BiomeType.OCEAN ? 1.0 : 0.85;
            // Tint para distinguir océano de lago
            sprite.tint = BIOME_COLORS[biome];
          } else {
            sprite.alpha = Math.min(1, waterValue);
          }

          sprite.zIndex = 1;

          chunk.container.addChild(sprite);
          chunk.waterSprites.push(sprite);
        }
      }
    }
  }

  /**
   * Generar árboles para un chunk (basado en biomas)
   */
  private generateTrees(
    chunk: RenderedChunk,
    snapshot: ChunkSnapshot,
    biomes?: Uint8Array,
  ): void {
    const foodField = snapshot.fields.food;
    const treesField = snapshot.fields.trees;
    const tilesPerChunk = Math.ceil(snapshot.size / TILE_SIZE);

    for (let ty = 0; ty < tilesPerChunk; ty++) {
      for (let tx = 0; tx < tilesPerChunk; tx++) {
        const globalTx = snapshot.cx * tilesPerChunk + tx;
        const globalTy = snapshot.cy * tilesPerChunk + ty;

        const localX = tx * TILE_SIZE;
        const localY = ty * TILE_SIZE;

        // Obtener bioma
        const biomeIndex = this.getBiomeIndex(biomes, tx, ty, snapshot.size);
        const biome = BIOME_ORDER[biomeIndex] || BiomeType.GRASSLAND;

        // No poner árboles en biomas sin vegetación
        const noTreeBiomes = [
          BiomeType.OCEAN,
          BiomeType.LAKE,
          BiomeType.BEACH,
          BiomeType.DESERT,
          BiomeType.MOUNTAIN,
          BiomeType.RIVER,
        ];
        if (noTreeBiomes.includes(biome)) continue;

        const foodValue = this.getFieldValue(
          foodField as number[],
          tx,
          ty,
          snapshot.size,
        );
        const treeValue = treesField
          ? this.getFieldValue(treesField as number[], tx, ty, snapshot.size)
          : 0;

        // Densidad de árboles por bioma
        let biomeDensity = TREE_DENSITY;
        if (biome === BiomeType.FOREST) biomeDensity = 0.4;
        else if (biome === BiomeType.SWAMP) biomeDensity = 0.25;
        else if (biome === BiomeType.WETLAND) biomeDensity = 0.15;
        else if (biome === BiomeType.TUNDRA) biomeDensity = 0.05;
        else if (biome === BiomeType.GRASSLAND) biomeDensity = 0.1;

        // Decidir si colocar árbol
        const pseudoRandom =
          Math.abs(
            Math.sin(globalTx * 12.9898 + globalTy * 78.233) * 43758.5453,
          ) % 1;
        const shouldPlaceTree = pseudoRandom < biomeDensity || treeValue > 0.5;

        if (shouldPlaceTree) {
          const isForest =
            biome === BiomeType.FOREST ||
            biome === BiomeType.SWAMP ||
            treeValue > 0.5;
          const texture = this.assetLoader.getTreeTexture(
            globalTx,
            globalTy,
            isForest,
          );

          const sprite = new Sprite(texture);

          const offsetX = (pseudoRandom - 0.5) * TILE_SIZE * 0.5;
          const offsetY = (((pseudoRandom * 2) % 1) - 0.5) * TILE_SIZE * 0.5;

          sprite.x = localX + TILE_SIZE / 2 + offsetX;
          sprite.y = localY + TILE_SIZE + offsetY;
          sprite.anchor.set(0.5, 1);

          // Escala basada en bioma
          let scale = 0.3 + ((foodValue + treeValue) / 2) * 0.3;
          if (biome === BiomeType.FOREST) scale *= 1.2;
          if (biome === BiomeType.TUNDRA) scale *= 0.7;

          sprite.scale.set(scale);
          sprite.zIndex = 2 + ty; // Ordenar por Y para profundidad

          // Tint sutil para bioma
          if (biome === BiomeType.TUNDRA) sprite.tint = 0xdddddd;
          if (biome === BiomeType.SWAMP) sprite.tint = 0x88aa88;

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
    chunkSize: number,
  ): number {
    if (!field || field.length === 0) return 0;

    // Calcular índice basado en el tamaño del chunk
    const gridSize = Math.sqrt(field.length);
    const tilesPerChunk = Math.ceil(chunkSize / TILE_SIZE);

    // Mapear coordenadas de tile a índice de campo
    const fieldX = Math.floor((tileX * gridSize) / tilesPerChunk);
    const fieldY = Math.floor((tileY * gridSize) / tilesPerChunk);

    if (fieldX < 0 || fieldX >= gridSize || fieldY < 0 || fieldY >= gridSize)
      return 0;

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
    }
  }

  /**
   * Limpiar chunks antiguos
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();

    for (const chunk of this.chunks.values()) {
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
      sprites +=
        chunk.terrainSprites.length +
        chunk.waterSprites.length +
        chunk.treeSprites.length;
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
