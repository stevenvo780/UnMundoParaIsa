/**
 * Stockpiles - Zonas de almacenamiento con baja difusión
 * Los recursos se acumulan y persisten en stockpiles
 */

export interface StockpileConfig {
  maxCapacity: number;       // Capacidad máxima por tipo
  inputRate: number;         // Velocidad de entrada
  outputRate: number;        // Velocidad de salida
  decayRate: number;         // Decay dentro del stockpile (muy bajo)
  radius: number;            // Radio de efecto
}

const DEFAULT_STOCKPILE_CONFIG: StockpileConfig = {
  maxCapacity: 100,
  inputRate: 0.5,
  outputRate: 0.3,
  decayRate: 0.001,
  radius: 3,
};

export interface Stockpile {
  id: number;
  x: number;
  y: number;
  config: StockpileConfig;
  inventory: Record<string, number>;
  lastAccess: number;
}

/**
 * StockpileManager - Gestiona stockpiles en el mundo
 */
export class StockpileManager {
  private stockpiles: Map<number, Stockpile> = new Map();
  private nextId = 1;
  private spatialIndex: Map<string, number[]> = new Map();  // "x,y" -> stockpile ids
  
  readonly width: number;
  readonly height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  
  /**
   * Crear un stockpile
   */
  create(x: number, y: number, config?: Partial<StockpileConfig>): Stockpile {
    const stockpile: Stockpile = {
      id: this.nextId++,
      x,
      y,
      config: { ...DEFAULT_STOCKPILE_CONFIG, ...config },
      inventory: {},
      lastAccess: Date.now(),
    };
    
    this.stockpiles.set(stockpile.id, stockpile);
    this.updateSpatialIndex(stockpile);
    
    return stockpile;
  }
  
  /**
   * Actualizar índice espacial
   */
  private updateSpatialIndex(stockpile: Stockpile): void {
    const { x, y, config } = stockpile;
    const { radius } = config;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || px >= this.width || py < 0 || py >= this.height) continue;
        
        const key = `${px},${py}`;
        const ids = this.spatialIndex.get(key) || [];
        if (!ids.includes(stockpile.id)) {
          ids.push(stockpile.id);
          this.spatialIndex.set(key, ids);
        }
      }
    }
  }
  
  /**
   * Obtener stockpile por ID
   */
  get(id: number): Stockpile | undefined {
    return this.stockpiles.get(id);
  }
  
  /**
   * Obtener stockpiles en posición
   */
  getAt(x: number, y: number): Stockpile[] {
    const key = `${x},${y}`;
    const ids = this.spatialIndex.get(key) || [];
    return ids.map(id => this.stockpiles.get(id)).filter(s => s !== undefined) as Stockpile[];
  }
  
  /**
   * Depositar recurso en stockpile
   */
  deposit(stockpileId: number, resource: string, amount: number): number {
    const stockpile = this.stockpiles.get(stockpileId);
    if (!stockpile) return 0;
    
    const current = stockpile.inventory[resource] || 0;
    const maxDeposit = Math.min(
      amount * stockpile.config.inputRate,
      stockpile.config.maxCapacity - current
    );
    
    if (maxDeposit <= 0) return 0;
    
    stockpile.inventory[resource] = current + maxDeposit;
    stockpile.lastAccess = Date.now();
    
    return maxDeposit;
  }
  
  /**
   * Retirar recurso de stockpile
   */
  withdraw(stockpileId: number, resource: string, amount: number): number {
    const stockpile = this.stockpiles.get(stockpileId);
    if (!stockpile) return 0;
    
    const current = stockpile.inventory[resource] || 0;
    const maxWithdraw = Math.min(
      amount,
      current * stockpile.config.outputRate
    );
    
    if (maxWithdraw <= 0) return 0;
    
    stockpile.inventory[resource] = current - maxWithdraw;
    stockpile.lastAccess = Date.now();
    
    return maxWithdraw;
  }
  
  /**
   * Aplicar decay a todos los stockpiles
   */
  applyDecay(): void {
    for (const stockpile of this.stockpiles.values()) {
      for (const resource of Object.keys(stockpile.inventory)) {
        stockpile.inventory[resource] *= (1 - stockpile.config.decayRate);
        
        // Limpiar valores muy pequeños
        if (stockpile.inventory[resource] < 0.001) {
          delete stockpile.inventory[resource];
        }
      }
    }
  }
  
  /**
   * Eliminar stockpile
   */
  remove(id: number): boolean {
    const stockpile = this.stockpiles.get(id);
    if (!stockpile) return false;
    
    // Limpiar índice espacial
    const { x, y, config } = stockpile;
    const { radius } = config;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        const key = `${px},${py}`;
        const ids = this.spatialIndex.get(key);
        if (ids) {
          const idx = ids.indexOf(id);
          if (idx !== -1) {
            ids.splice(idx, 1);
            if (ids.length === 0) {
              this.spatialIndex.delete(key);
            }
          }
        }
      }
    }
    
    return this.stockpiles.delete(id);
  }
  
  /**
   * Obtener todos los stockpiles
   */
  getAll(): Stockpile[] {
    return Array.from(this.stockpiles.values());
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): StockpileStats {
    let totalCapacity = 0;
    let totalStored = 0;
    const byResource: Record<string, number> = {};
    
    for (const stockpile of this.stockpiles.values()) {
      totalCapacity += stockpile.config.maxCapacity;
      
      for (const [resource, amount] of Object.entries(stockpile.inventory)) {
        totalStored += amount;
        byResource[resource] = (byResource[resource] || 0) + amount;
      }
    }
    
    return {
      count: this.stockpiles.size,
      totalCapacity,
      totalStored,
      utilization: totalCapacity > 0 ? totalStored / totalCapacity : 0,
      byResource,
    };
  }
  
  /**
   * Serializar para persistencia
   */
  serialize(): StockpileData[] {
    return Array.from(this.stockpiles.values()).map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      config: s.config,
      inventory: { ...s.inventory },
    }));
  }
  
  /**
   * Deserializar
   */
  load(data: StockpileData[]): void {
    this.stockpiles.clear();
    this.spatialIndex.clear();
    
    for (const d of data) {
      const stockpile: Stockpile = {
        id: d.id,
        x: d.x,
        y: d.y,
        config: d.config,
        inventory: d.inventory,
        lastAccess: Date.now(),
      };
      
      this.stockpiles.set(stockpile.id, stockpile);
      this.updateSpatialIndex(stockpile);
      
      if (d.id >= this.nextId) {
        this.nextId = d.id + 1;
      }
    }
  }
}

export interface StockpileStats {
  count: number;
  totalCapacity: number;
  totalStored: number;
  utilization: number;
  byResource: Record<string, number>;
}

export interface StockpileData {
  id: number;
  x: number;
  y: number;
  config: StockpileConfig;
  inventory: Record<string, number>;
}
