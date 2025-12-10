import { describe, it, expect } from "vitest";
import { Particle } from "../src/types.js";

/**
 * Helper para crear partículas de prueba
 */
function createTestParticle(
  id: number,
  x: number,
  y: number,
  energy: number = 0.5,
): Particle {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    energy,
    seed: Math.floor(Math.random() * 0xffffffff),
    alive: true,
  };
}

describe("Particle", () => {
  describe("createTestParticle", () => {
    it("should create particle with specified values", () => {
      const particle = createTestParticle(0, 100, 100);

      expect(particle.id).toBe(0);
      expect(particle.x).toBe(100);
      expect(particle.y).toBe(100);
      expect(particle.alive).toBe(true);
    });

    it("should create particle with custom energy", () => {
      const particle = createTestParticle(1, 50, 50, 0.8);

      expect(particle.energy).toBe(0.8);
    });

    it("should have a seed", () => {
      const particle = createTestParticle(1, 100, 100);

      expect(typeof particle.seed).toBe("number");
      expect(particle.seed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("particle interface", () => {
    it("should have all required properties", () => {
      const particle: Particle = {
        id: 0,
        x: 256,
        y: 256,
        vx: 0,
        vy: 0,
        energy: 0.75,
        seed: 12345,
        alive: true,
      };

      expect(particle.id).toBeDefined();
      expect(particle.x).toBeDefined();
      expect(particle.y).toBeDefined();
      expect(particle.vx).toBeDefined();
      expect(particle.vy).toBeDefined();
      expect(particle.energy).toBeDefined();
      expect(particle.seed).toBeDefined();
      expect(particle.alive).toBeDefined();
    });

    it("should allow modification", () => {
      const particle = createTestParticle(0, 100, 100);

      particle.x = 200;
      particle.y = 300;
      particle.energy = 0.25;
      particle.alive = false;

      expect(particle.x).toBe(200);
      expect(particle.y).toBe(300);
      expect(particle.energy).toBe(0.25);
      expect(particle.alive).toBe(false);
    });
  });

  describe("energy constraints", () => {
    it("should allow energy values between 0 and 1", () => {
      const p1 = createTestParticle(0, 0, 0, 0);
      const p2 = createTestParticle(1, 0, 0, 1);
      const p3 = createTestParticle(2, 0, 0, 0.5);

      expect(p1.energy).toBe(0);
      expect(p2.energy).toBe(1);
      expect(p3.energy).toBe(0.5);
    });
  });
});
