import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentBehaviorSystem } from "../src/core/AgentBehavior";
import { World } from "../src/core/World";
import { InventorySystem } from "../src/economy/InventorySystem";
import { StructureManager } from "../src/core/StructureManager";
import { ReactionProcessor } from "../src/economy/Reactions";
import { AgentState, FieldType, Particle } from "../src/types";

import { QuestManager } from "../src/quests/EmergentQuests";

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
  getStructuresByOwner: vi.fn(),
  createStructure: vi.fn(),
} as unknown as StructureManager;

const mockReactionProcessor = {
  processCell: vi.fn().mockReturnValue([]),
} as unknown as ReactionProcessor;

const mockQuestManager = {
  getNearestActiveQuest: vi.fn(),
} as unknown as QuestManager;

describe("AgentBehaviorSystem", () => {
  let behaviorSystem: AgentBehaviorSystem;
  let agent: Particle;

  beforeEach(() => {
    behaviorSystem = new AgentBehaviorSystem(
      mockWorld,
      mockInventorySystem,
      mockStructureManager,
      mockReactionProcessor,
      mockQuestManager
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
    (mockStructureManager.getNearbyStructures as any).mockReturnValue([]);
    (mockStructureManager.getStructuresByOwner as any).mockReturnValue([]);
    (mockStructureManager.createStructure as any).mockReturnValue(null);
    (mockQuestManager.getNearestActiveQuest as any).mockReturnValue(null);
    (mockInventorySystem.canAddItem as any).mockReturnValue(true);
    (mockInventorySystem.hasItem as any).mockReturnValue(false);
    (mockReactionProcessor.processCell as any).mockReturnValue([]);
  });

  describe("IDLE State", () => {
    it("should transition to GATHERING if energy is low", () => {
      agent.energy = 0.3; // Low energy

      // Mock successful food gathering
      (mockReactionProcessor.processCell as any).mockReturnValue([{
        executed: true,
        consumed: {},
        produced: { food: 1 },
        laborUsed: 0.1
      }]);

      behaviorSystem.update(agent);
      expect(agent.state).toBe(AgentState.GATHERING);
      // expect(agent.currentAction).toBe("Seeking Food"); // Old reactive string
      expect(agent.currentAction).toBe("Gathering food"); // New generic string
    });

    it("should transition to GATHERING if inventory has space and no other tasks", () => {
      // Mock successful wood gathering
      (mockReactionProcessor.processCell as any).mockReturnValue([{
        executed: true,
        consumed: {},
        produced: { wood: 1 },
        laborUsed: 0.1
      }]);

      behaviorSystem.update(agent);

      expect(agent.state).toBe(AgentState.GATHERING);
      expect(agent.currentAction).toBe("Gathering trees");
    });

    it("should transition to WORKING if resources and construction site exist", () => {
      agent.energy = 0.8;
      (mockInventorySystem.canAddItem as any).mockReturnValue(false); // Force Agent to use resources instead of gathering more
      (mockInventorySystem.hasItem as any).mockReturnValue(true);
      (mockStructureManager.getNearbyStructures as any).mockReturnValue([
        { id: 100, x: 12, y: 12, health: 0.5 },
      ]); behaviorSystem.update(agent);

      expect(agent.state).toBe(AgentState.WORKING);
      expect(agent.memory.targetStructureId).toBe(100);
    });
  });

  describe("GATHERING State", () => {
    it("should use ReactionProcessor to gather", () => {
      agent.state = AgentState.GATHERING;
      agent.energy = 0.3; // Gathering food

      // Mock reaction result
      (mockReactionProcessor.processCell as any).mockReturnValue([{
        executed: true,
        consumed: { [FieldType.FOOD]: 0.1 },
        produced: { food: 1 },
        laborUsed: 0.1
      }]);

      // Mock field value
      (mockWorld.getFieldValueAt as any).mockReturnValue(1.0);

      behaviorSystem.update(agent);

      expect(mockReactionProcessor.processCell).toHaveBeenCalled();
      expect(mockWorld.setFieldValueAt).toHaveBeenCalled();
    });
  });
});
