import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentBehaviorSystem } from "./AgentBehavior";
import { World } from "./World";
import { InventorySystem } from "../economy/InventorySystem";
import { StructureManager } from "./StructureManager";
import { ReactionProcessor } from "../economy/Reactions";
import { AgentState, FieldType, Particle } from "../types";

// Mocks
const mockWorld = {
  getFieldValueAt: vi.fn(),
  setFieldValueAt: vi.fn(),
} as unknown as World;

const mockInventorySystem = {
  hasItem: vi.fn(),
  canAddItem: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
} as unknown as InventorySystem;

const mockStructureManager = {
  getNearbyStructures: vi.fn(),
  contributeToStructure: vi.fn(),
} as unknown as StructureManager;

const mockReactionProcessor = {
  performAction: vi.fn()
} as unknown as ReactionProcessor;

describe("AgentBehaviorSystem", () => {
  let behaviorSystem: AgentBehaviorSystem;
  let agent: Particle;

  beforeEach(() => {
    behaviorSystem = new AgentBehaviorSystem(
      mockWorld,
      mockInventorySystem,
      mockStructureManager,
      mockReactionProcessor
    );

    agent = {
      id: 1,
      x: 10,
      y: 10,
      vx: 0,
      vy: 0,
      energy: 1.0,
      seed: 123,
      alive: true,
      state: AgentState.IDLE,
      inventory: {},
      memory: {},
    };

    vi.clearAllMocks();
  });

  describe("IDLE State", () => {
    it("should transition to GATHERING if energy is low", () => {
      agent.energy = 0.3; // Low energy
      behaviorSystem.update(agent);
      expect(agent.state).toBe(AgentState.GATHERING);
      expect(agent.currentAction).toBe("Seeking Food");
    });

    it("should transition to GATHERING if inventory has space and no other tasks", () => {
      agent.energy = 0.8;
      (mockInventorySystem.canAddItem as any).mockReturnValue(true);

      behaviorSystem.update(agent);

      expect(agent.state).toBe(AgentState.GATHERING);
      expect(agent.currentAction).toBe("Gathering Wood");
    });

    it("should transition to WORKING if has resources and construction site exists", () => {
      agent.energy = 0.8;
      // Has wood
      (mockInventorySystem.hasItem as any).mockReturnValue(true);
      // Found structure
      (mockStructureManager.getNearbyStructures as any).mockReturnValue([{ id: 99, x: 20, y: 20, health: 0.5 }]);

      behaviorSystem.update(agent);

      expect(agent.state).toBe(AgentState.WORKING);
      expect(agent.memory.targetStructureId).toBe(99);
    });
  });

  describe("GATHERING State", () => {
    it("should use ReactionProcessor to gather", () => {
      agent.state = AgentState.GATHERING;
      agent.energy = 0.3; // Gathering food

      // Mock reaction result
      (mockReactionProcessor.performAction as any).mockReturnValue({
        executed: true,
        consumed: { [FieldType.FOOD]: 0.1 },
        produced: { food: 1 },
        laborUsed: 0.1
      });

      // Mock field value
      (mockWorld.getFieldValueAt as any).mockReturnValue(1.0);

      behaviorSystem.update(agent);

      expect(mockReactionProcessor.performAction).toHaveBeenCalled();
      expect(mockWorld.setFieldValueAt).toHaveBeenCalled();
    });
  });
});
