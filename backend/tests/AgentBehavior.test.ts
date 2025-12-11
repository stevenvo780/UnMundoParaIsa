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
} as unknown as StructureManager;

const mockReactionProcessor = {
  processCell: vi.fn()
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
    (mockQuestManager.getNearestActiveQuest as any).mockReturnValue(null);
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
