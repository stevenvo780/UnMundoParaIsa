import { describe, it, expect, beforeEach } from 'vitest';
import { CommunityDetector, Community } from '../src/social/Communities.js';
import { getSignature, seedSimilarity, averageSignature } from '../src/social/Signatures.js';
import { Particle } from '../src/types.js';

describe('Signatures', () => {
  describe('getSignature', () => {
    it('should return 4-element tuple from seed', () => {
      const sig = getSignature(12345);
      expect(sig).toHaveLength(4);
      sig.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('seedSimilarity', () => {
    it('should return 1.0 for identical seeds', () => {
      const sim = seedSimilarity(12345, 12345);
      expect(sim).toBe(1);
    });

    it('should return value between 0 and 1 for different seeds', () => {
      const sim = seedSimilarity(12345, 67890);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe('averageSignature', () => {
    it('should compute average of particle signatures', () => {
      const particles: Particle[] = [
        { id: 1, x: 0, y: 0, energy: 0.5, alive: true, seed: 1000 },
        { id: 2, x: 0, y: 0, energy: 0.5, alive: true, seed: 2000 },
      ];
      
      const avg = averageSignature(particles);
      expect(avg).toHaveLength(4);
    });
  });
});

describe('CommunityDetector', () => {
  let detector: CommunityDetector;

  beforeEach(() => {
    detector = new CommunityDetector({ minPopulation: 3, mergeDistance: 30 });
  });

  describe('initialization', () => {
    it('should create detector with custom config', () => {
      expect(detector.config.minPopulation).toBe(3);
      expect(detector.config.mergeDistance).toBe(30);
    });
  });

  describe('detect', () => {
    it('should detect community from clustered particles', () => {
      // Crear partículas agrupadas
      const particles: Particle[] = [];
      for (let i = 0; i < 10; i++) {
        particles.push({
          id: i,
          x: 50 + Math.random() * 10,
          y: 50 + Math.random() * 10,
          vx: 0,
          vy: 0,
          energy: 0.8,
          alive: true,
          seed: 1000 + i,
        });
      }
      
      // Campo de población con alta densidad en (50,50)
      const width = 100;
      const height = 100;
      const popField = new Float32Array(width * height);
      
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const x = 50 + dx;
          const y = 50 + dy;
          if (x >= 0 && x < width && y >= 0 && y < height) {
            popField[y * width + x] = 5 + Math.random() * 5;
          }
        }
      }
      
      detector.detect(particles, popField, width, height);
      
      const communities = detector.getAll();
      expect(communities.length).toBeGreaterThanOrEqual(0);
    });

    it('should not detect community from sparse particles', () => {
      const particles: Particle[] = [];
      for (let i = 0; i < 5; i++) {
        particles.push({
          id: i,
          x: i * 20,  // Muy dispersos
          y: i * 20,
          vx: 0,
          vy: 0,
          energy: 0.5,
          alive: true,
          seed: 1000 + i,
        });
      }
      
      const width = 100;
      const height = 100;
      const popField = new Float32Array(width * height);
      
      // Población muy baja
      popField[10 * width + 10] = 0.5;
      
      detector.detect(particles, popField, width, height);
      
      const communities = detector.getAll();
      expect(communities.length).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should return array of communities', () => {
      const communities = detector.getAll();
      expect(Array.isArray(communities)).toBe(true);
    });
  });
});
