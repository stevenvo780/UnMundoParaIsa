import { describe, it, expect, beforeEach } from "vitest";
import {
  DemandField,
  DemandManager,
  DEFAULT_DEMAND_CONFIGS,
} from '../src/economy/Demand';

describe("DemandField", () => {
  let demandField: DemandField;

  beforeEach(() => {
    demandField = new DemandField(64, 64, "food");
  });

  describe("initialization", () => {
    it("should create field with correct dimensions", () => {
      expect(demandField.width).toBe(64);
      expect(demandField.height).toBe(64);
    });

    it("should have correct resource type", () => {
      expect(demandField.resourceType).toBe("food");
    });

    it("should use default config for known resources", () => {
      expect(demandField.config).toEqual(DEFAULT_DEMAND_CONFIGS.food);
    });

    it("should start with zero demand", () => {
      const value = demandField.get(32, 32);
      expect(value).toBe(0);
    });
  });

  describe("update", () => {
    it("should calculate demand from population and resources", () => {
      const population = new Float32Array(64 * 64);
      const resources = new Float32Array(64 * 64);

      // Alta población, bajos recursos = alta demanda
      const i = 32 * 64 + 32;
      population[i] = 1.0;
      resources[i] = 0.1;

      demandField.update(population, resources);

      const demand = demandField.get(32, 32);
      expect(demand).toBeGreaterThan(0);
    });

    it("should have low demand when resources are abundant", () => {
      const population = new Float32Array(64 * 64);
      const resources = new Float32Array(64 * 64);

      const i = 32 * 64 + 32;
      population[i] = 0.5;
      resources[i] = 1.0; // Muchos recursos

      demandField.update(population, resources);

      const demandHigh = demandField.get(32, 32);

      // Comparar con situación de escasez
      resources[i] = 0.1;
      demandField.update(population, resources);

      const demandLow = demandField.get(32, 32);

      expect(demandLow).toBeGreaterThan(demandHigh);
    });
  });

  describe("getTotalDemand", () => {
    it("should sum all demand values", () => {
      const population = new Float32Array(64 * 64);
      const resources = new Float32Array(64 * 64);

      // Crear demanda en varios puntos
      for (let i = 0; i < 10; i++) {
        population[i] = 1.0;
        resources[i] = 0.1;
      }

      demandField.update(population, resources);

      const total = demandField.getTotalDemand();
      expect(total).toBeGreaterThan(0);
    });
  });
});

describe("DemandManager", () => {
  let manager: DemandManager;

  beforeEach(() => {
    manager = new DemandManager(64, 64);
  });

  describe("initialization", () => {
    it("should create manager", () => {
      expect(manager).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update all demand fields without error", () => {
      const population = new Float32Array(64 * 64);
      const resources = new Map<string, Float32Array>();
      resources.set("food", new Float32Array(64 * 64));
      resources.set("water", new Float32Array(64 * 64));

      expect(() => manager.update(population, resources)).not.toThrow();
    });
  });

  describe("getDemandField", () => {
    it("should return DemandField for known resource", () => {
      const field = manager.getDemandField("food");
      expect(field).toBeDefined();
      expect(field?.resourceType).toBe("food");
    });
  });

  describe("getTotalDemands", () => {
    it("should return totals for all resources", () => {
      const totals = manager.getTotalDemands();
      expect(totals).toHaveProperty("food");
      expect(typeof totals.food).toBe("number");
    });
  });
});
