/**
 * Narrative Module - Sistema narrativo emergente
 * Materialización de partículas en personajes con historia
 */

// Semantic Fields - Campos emocionales
export {
  type SemanticFieldType,
  type SemanticFieldConfig,
  SemanticField,
  SemanticFieldManager
} from './SemanticFields.js';

// Chat Parser - Procesamiento de fragmentos
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
  ChatManager
} from './ChatParser.js';

// Artifacts - Objetos descubribles
export {
  type Artifact,
  type ArtifactType,
  type ArtifactSpawnCondition,
  type ArtifactStats,
  ArtifactManager
} from './Artifacts.js';

// Events - Sistema de eventos
export {
  type EventType,
  type NarrativeEvent,
  type EventData,
  type EventTrigger,
  type EventCondition,
  type WorldState,
  type EventStats,
  EventManager
} from './Events.js';

// Materialization - Partícula → Personaje → Héroe
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
  MaterializationManager
} from './Materialization.js';
