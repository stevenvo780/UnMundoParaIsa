/**
 * Signatures - Sistema de firmas genéticas
 * Cada partícula tiene un seed de 32 bits que define su "firma"
 * La firma se descompone en 4 canales (8 bits cada uno)
 */

import { Particle } from "../types";

/**
 * Extraer firma de 4 canales desde seed
 * Cada canal es un valor 0-1
 */
export function getSignature(seed: number): [number, number, number, number] {
  return [
    ((seed >>> 0) & 0xff) / 255,
    ((seed >>> 8) & 0xff) / 255,
    ((seed >>> 16) & 0xff) / 255,
    ((seed >>> 24) & 0xff) / 255,
  ];
}

/**
 * Calcular distancia de Hamming entre dos seeds
 * Cuenta bits diferentes
 */
export function hammingDistance(seed1: number, seed2: number): number {
  let xor = seed1 ^ seed2;
  let count = 0;

  while (xor !== 0) {
    count += xor & 1;
    xor >>>= 1;
  }

  return count;
}

/**
 * Calcular similitud entre dos seeds (0-1)
 * 1 = idénticos, 0 = completamente diferentes
 */
export function seedSimilarity(seed1: number, seed2: number): number {
  const distance = hammingDistance(seed1, seed2);
  return 1 - distance / 32; // 32 bits máximo
}

/**
 * Verificar si dos partículas son "familia"
 * Umbral de similitud >= 0.75 (8 bits o menos diferentes)
 */
export function areFamily(
  p1: Particle,
  p2: Particle,
  threshold: number = 0.75,
): boolean {
  return seedSimilarity(p1.seed, p2.seed) >= threshold;
}

/**
 * Calcular firma promedio de un grupo de partículas
 */
export function averageSignature(
  particles: Particle[],
): [number, number, number, number] {
  if (particles.length === 0) {
    return [0, 0, 0, 0];
  }

  const sum = [0, 0, 0, 0];

  for (const p of particles) {
    const sig = getSignature(p.seed);
    sum[0] += sig[0];
    sum[1] += sig[1];
    sum[2] += sig[2];
    sum[3] += sig[3];
  }

  const n = particles.length;
  return [sum[0] / n, sum[1] / n, sum[2] / n, sum[3] / n];
}

/**
 * Calcular entropía de firmas en una zona
 * Alta entropía = mezcla de diferentes familias
 * Baja entropía = zona homogénea
 */
export function signatureEntropy(
  signatures: Array<[number, number, number, number]>,
): number {
  if (signatures.length < 2) return 0;

  let totalVariance = 0;

  for (let c = 0; c < 4; c++) {
    const values = signatures.map((s) => s[c]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    totalVariance += variance;
  }

  return Math.min(1, totalVariance / (4 * 0.25));
}

/**
 * SignatureField - Campo que acumula firmas depositadas
 */
export class SignatureField {
  readonly width: number;
  readonly height: number;
  readonly channels: 4;

  private data: Float32Array;
  private counts: Uint16Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.channels = 4;

    this.data = new Float32Array(width * height * 4);
    this.counts = new Uint16Array(width * height);
  }

  /**
   * Depositar firma en posición
   */
  deposit(
    x: number,
    y: number,
    signature: [number, number, number, number],
    strength: number = 0.1,
  ): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const i = (y * this.width + x) * 4;
    const ci = y * this.width + x;

    const count = this.counts[ci];
    const weight = Math.min(strength, 1);

    for (let c = 0; c < 4; c++) {
      this.data[i + c] =
        this.data[i + c] * (1 - weight) + signature[c] * weight;
    }

    this.counts[ci] = Math.min(65535, count + 1);
  }

  /**
   * Obtener firma dominante en posición
   */
  get(x: number, y: number): [number, number, number, number] {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }

    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /**
   * Obtener conteo de deposiciones
   */
  getCount(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.counts[y * this.width + x];
  }

  /**
   * Calcular similitud de una firma con la dominante local
   */
  getSimilarity(
    x: number,
    y: number,
    signature: [number, number, number, number],
  ): number {
    const local = this.get(x, y);

    let sumSq = 0;
    for (let c = 0; c < 4; c++) {
      sumSq += (local[c] - signature[c]) ** 2;
    }

    return 1 - Math.sqrt(sumSq) / 2;
  }

  /**
   * Aplicar decay al campo
   */
  decay(rate: number = 0.05): void {
    const decayFactor = 1 - rate;
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= decayFactor;
    }
  }

  /**
   * Obtener entropía en una región
   */
  getEntropyInRegion(cx: number, cy: number, radius: number): number {
    const signatures: Array<[number, number, number, number]> = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (this.getCount(x, y) > 0) {
          signatures.push(this.get(x, y));
        }
      }
    }

    return signatureEntropy(signatures);
  }

  /**
   * Obtener buffer para visualización (canal específico)
   */
  getChannelBuffer(channel: 0 | 1 | 2 | 3): Float32Array {
    const result = new Float32Array(this.width * this.height);

    for (let i = 0; i < result.length; i++) {
      result[i] = this.data[i * 4 + channel];
    }

    return result;
  }

  /**
   * Resetear campo
   */
  reset(): void {
    this.data.fill(0);
    this.counts.fill(0);
  }
}
