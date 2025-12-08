/**
 * AssetLoader - Sistema de carga de sprites para Un Mundo Para Isa
 * 
 * Maneja spritesheets de personajes (4 frames x 4 direcciones)
 * y sprites individuales para terreno, árboles, agua.
 */

import { Assets, Texture, Rectangle } from 'pixi.js';

export interface CharacterTextures {
  frames: Texture[];
}

export interface LoadedAssets {
  terrain: {
    forest: Texture[];
    grassland: Texture[];
  };
  trees: {
    forest: Texture[];
    grassland: Texture[];
  };
  water: Texture[];
  characters: {
    male: CharacterTextures[];
    female: CharacterTextures[];
  };
  items: Map<string, Texture>;
}

const ASSET_BASE = '/assets';

// Dimensiones de frames por tipo de personaje
// man*.png: 128x96 = 4 cols x 3 rows de 32x32
// whomen*.png: 99x72 ≈ 4 cols x 3 rows de ~24x24
const MALE_FRAME_WIDTH = 32;
const MALE_FRAME_HEIGHT = 32;
const FEMALE_FRAME_WIDTH = 24;
const FEMALE_FRAME_HEIGHT = 24;
const CHARACTER_COLS = 4;
const CHARACTER_ROWS = 3;

const ASSET_MANIFEST = {
  terrain: {
    forest: [
      'terrain/grass tile_Forest_0_s99.png',
      'terrain/grass tile_Forest_1_s99.png',
      'terrain/grass tile_Forest_2_s99.png',
      'terrain/grass tile_Forest_3_s99.png',
      'terrain/grass tile_Forest_4_s99.png',
    ],
    grassland: [
      'terrain/grass tile_Grassland_0_s98.png',
      'terrain/grass tile_Grassland_1_s98.png',
      'terrain/grass tile_Grassland_2_s98.png',
      'terrain/grass tile_Grassland_3_s99.png',
      'terrain/grass tile_Grassland_4_s98.png',
    ],
  },
  trees: {
    forest: [
      'trees/tree_Forest_0_s99.png',
      'trees/tree_Forest_1_s99.png',
      'trees/tree_Forest_2_s99.png',
      'trees/tree_Forest_3_s99.png',
      'trees/tree_Forest_4_s99.png',
    ],
    grassland: [
      'trees/tree_Grassland_0_s99.png',
      'trees/tree_Grassland_1_s99.png',
      'trees/tree_Grassland_2_s99.png',
      'trees/tree_Grassland_3_s99.png',
      'trees/tree_Grassland_4_s99.png',
    ],
  },
  water: [
    'water/water tile_Forest_0_s90.png',
    'water/water tile_Forest_1_s82.png',
    'water/water tile_Forest_2_s91.png',
    'water/water tile_Forest_3_s95.png',
    'water/water tile_Forest_4_s94.png',
  ],
  characters: {
    male: [
      'characters/man1.png',
      'characters/man2.png',
      'characters/man3.png',
      'characters/man4.png',
    ],
    female: [
      'characters/whomen1.png',
      'characters/whomen2.png',
      'characters/whomen3.png',
      'characters/whomen4.png',
    ],
  },
  items: [
    'items/apple.png',
    'items/bread.png',
    'items/fish.png',
    'items/meat.png',
    'items/honey.png',
    'items/berries.png',
    'items/antidote.png',
    'items/healing_herb.png',
    'items/herbal_tea.png',
    'items/water_flask.png',
  ],
};

function extractCharacterFrames(texture: Texture, isFemale: boolean): CharacterTextures {
  const frames: Texture[] = [];
  
  const frameWidth = isFemale ? FEMALE_FRAME_WIDTH : MALE_FRAME_WIDTH;
  const frameHeight = isFemale ? FEMALE_FRAME_HEIGHT : MALE_FRAME_HEIGHT;
  
  // Extraemos todos los frames (4 cols x 3 rows = 12 frames)
  for (let row = 0; row < CHARACTER_ROWS; row++) {
    for (let col = 0; col < CHARACTER_COLS; col++) {
      const frame = new Texture({
        source: texture.source,
        frame: new Rectangle(
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight
        ),
      });
      frames.push(frame);
    }
  }
  
  return { frames };
}

export class AssetLoader {
  private static instance: AssetLoader | null = null;
  private assets: LoadedAssets | null = null;
  private loadPromise: Promise<LoadedAssets> | null = null;

  private constructor() {}

  static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  async load(onProgress?: (progress: number) => void): Promise<LoadedAssets> {
    if (this.assets) return this.assets;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad(onProgress);
    this.assets = await this.loadPromise;
    return this.assets;
  }

  private async doLoad(onProgress?: (progress: number) => void): Promise<LoadedAssets> {
    console.log('[AssetLoader] Iniciando carga de assets...');
    
    const allAssetPaths: string[] = [];
    allAssetPaths.push(...ASSET_MANIFEST.terrain.forest);
    allAssetPaths.push(...ASSET_MANIFEST.terrain.grassland);
    allAssetPaths.push(...ASSET_MANIFEST.trees.forest);
    allAssetPaths.push(...ASSET_MANIFEST.trees.grassland);
    allAssetPaths.push(...ASSET_MANIFEST.water);
    allAssetPaths.push(...ASSET_MANIFEST.characters.male);
    allAssetPaths.push(...ASSET_MANIFEST.characters.female);
    allAssetPaths.push(...ASSET_MANIFEST.items);
    
    const assetBundle: Record<string, string> = {};
    for (const path of allAssetPaths) {
      assetBundle[path] = `${ASSET_BASE}/${path}`;
    }
    
    Assets.addBundle('world', assetBundle);
    
    const textures = await Assets.loadBundle('world', (progress) => {
      if (onProgress) onProgress(progress);
    });
    
    const loadedAssets: LoadedAssets = {
      terrain: {
        forest: ASSET_MANIFEST.terrain.forest.map(p => textures[p] as Texture),
        grassland: ASSET_MANIFEST.terrain.grassland.map(p => textures[p] as Texture),
      },
      trees: {
        forest: ASSET_MANIFEST.trees.forest.map(p => textures[p] as Texture),
        grassland: ASSET_MANIFEST.trees.grassland.map(p => textures[p] as Texture),
      },
      water: ASSET_MANIFEST.water.map(p => textures[p] as Texture),
      characters: {
        male: ASSET_MANIFEST.characters.male.map(p => 
          extractCharacterFrames(textures[p] as Texture, false)
        ),
        female: ASSET_MANIFEST.characters.female.map(p => 
          extractCharacterFrames(textures[p] as Texture, true)
        ),
      },
      items: new Map(),
    };
    
    for (const itemPath of ASSET_MANIFEST.items) {
      const name = itemPath.replace('items/', '').replace('.png', '');
      loadedAssets.items.set(name, textures[itemPath] as Texture);
    }
    
    console.log('[AssetLoader] Assets cargados:', {
      terrain: loadedAssets.terrain.forest.length + loadedAssets.terrain.grassland.length,
      trees: loadedAssets.trees.forest.length + loadedAssets.trees.grassland.length,
      water: loadedAssets.water.length,
      characters: loadedAssets.characters.male.length + loadedAssets.characters.female.length,
      items: loadedAssets.items.size,
    });
    
    return loadedAssets;
  }

  getAssets(): LoadedAssets | null {
    return this.assets;
  }

  isLoaded(): boolean {
    return this.assets !== null;
  }

  getCharacterFrame(seed: number, tick: number = 0, isFemale: boolean = false): Texture {
    if (!this.assets) throw new Error('Assets no cargados');
    
    const characters = isFemale ? this.assets.characters.female : this.assets.characters.male;
    const charIndex = Math.abs(seed) % characters.length;
    
    // 12 frames total (4 cols x 3 rows)
    // Animación: ciclar entre los 4 frames de la primera fila (idle/walk)
    const frameIndex = Math.floor(tick / 10) % 4;
    
    return characters[charIndex].frames[frameIndex];
  }

  getTerrainTile(x: number, y: number, foodValue: number = 0): Texture {
    if (!this.assets) throw new Error('Assets no cargados');
    
    const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1);
    const isForest = foodValue > 0.3 || noise > 0;
    
    const tiles = isForest ? this.assets.terrain.forest : this.assets.terrain.grassland;
    const index = Math.abs(Math.floor(x * 7 + y * 13)) % tiles.length;
    
    return tiles[index];
  }

  getTreeTexture(x: number, y: number, isForest: boolean = true): Texture {
    if (!this.assets) throw new Error('Assets no cargados');
    
    const trees = isForest ? this.assets.trees.forest : this.assets.trees.grassland;
    const index = Math.abs(Math.floor(x * 11 + y * 17)) % trees.length;
    
    return trees[index];
  }

  getWaterTile(x: number, y: number): Texture {
    if (!this.assets) throw new Error('Assets no cargados');
    
    const index = Math.abs(Math.floor(x * 3 + y * 5)) % this.assets.water.length;
    return this.assets.water[index];
  }
}