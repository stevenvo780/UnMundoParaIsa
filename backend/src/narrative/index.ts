/**
 * Narrative Module - Sistema narrativo emergente
 * Materialización de partículas en personajes con historia
 */

export {
  type SemanticFieldType,
  type SemanticFieldConfig,
  SemanticField,
  SemanticFieldManager,
} from "./SemanticFields";

export {
  type Speaker,
  type Emotion,
  type TimeOfDay,
  type ContextType,
  type ChatFragment,
  type ChatDatabase,
  type ChatStats,
  detectEmotion,
  parseChatsFromJSON,
  ChatManager,
} from "./ChatParser";

export {
  type Artifact,
  type ArtifactType,
  type ArtifactSpawnCondition,
  type ArtifactStats,
  ArtifactManager,
} from "./Artifacts";

export {
  type EventType,
  type NarrativeEvent,
  type EventData,
  type EventTrigger,
  type EventCondition,
  type WorldState,
  type EventStats,
  EventManager,
} from "./Events";

export {
  type EntityType,
  type BaseCharacter,
  type Character,
  type Hero,
  type CharacterEvent,
  type MaterializationStats,
  generateName,
  generateTraits,
  generateTitle,
  MaterializationManager,
} from "./Materialization";
