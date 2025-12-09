/**
 * ChatParser - Procesa fragmentos de chat de Isa/Steven
 * Extrae emociones y crea triggers para el mundo
 */

export type Speaker = "isa" | "stev";
export type Emotion =
  | "joy"
  | "nostalgia"
  | "love"
  | "wonder"
  | "melancholy"
  | "neutral";
export type TimeOfDay = "dawn" | "day" | "dusk" | "night" | "any";
export type ContextType =
  | "pair"
  | "birth"
  | "death"
  | "community"
  | "discovery"
  | "conflict"
  | "any";

export interface ChatFragment {
  id: string;
  date: string;
  speaker: Speaker;
  text: string;
  emotion: Emotion;
  intensity: number;
  trigger?: {
    field?: string;
    threshold?: number;
    time?: TimeOfDay;
    context?: ContextType;
  };
  discovered: boolean;
  discoveredAt?: number;
}

export interface ChatDatabase {
  fragments: ChatFragment[];
  metadata: {
    source: string;
    dateRange: { start: string; end: string };
    totalFragments: number;
    byEmotion: Record<Emotion, number>;
    bySpeaker: Record<Speaker, number>;
  };
}

/**
 * Detectar emoción de un texto (heurística simple)
 */
export function detectEmotion(text: string): {
  emotion: Emotion;
  intensity: number;
} {
  const lower = text.toLowerCase();

  const patterns: Record<Emotion, { words: string[]; baseIntensity: number }> =
    {
      joy: {
        words: [
          "jaja",
          "haha",
          "😂",
          "😊",
          "🥰",
          "feliz",
          "happy",
          "genial",
          "increíble",
          "wonderful",
          "amazing",
          "love",
          "te amo",
          "te quiero",
          "❤️",
          "💕",
        ],
        baseIntensity: 0.7,
      },
      love: {
        words: [
          "te amo",
          "i love you",
          "mi amor",
          "my love",
          "beso",
          "kiss",
          "abrazo",
          "hug",
          "❤️",
          "💕",
          "💗",
          "heart",
          "corazón",
          "forever",
          "siempre",
        ],
        baseIntensity: 0.9,
      },
      nostalgia: {
        words: [
          "recuerdo",
          "remember",
          "antes",
          "cuando",
          "aquella vez",
          "miss",
          "extraño",
          "ojalá",
          "wish",
          "tiempo",
          "años",
        ],
        baseIntensity: 0.6,
      },
      wonder: {
        words: [
          "wow",
          "increíble",
          "amazing",
          "beautiful",
          "hermoso",
          "✨",
          "🌟",
          "mira",
          "look",
          "descubrí",
          "found",
        ],
        baseIntensity: 0.65,
      },
      melancholy: {
        words: [
          "triste",
          "sad",
          "difícil",
          "hard",
          "llorar",
          "cry",
          "dolor",
          "pain",
          "solo",
          "alone",
          "lejos",
          "far",
          "extraño",
          "miss",
        ],
        baseIntensity: 0.5,
      },
      neutral: {
        words: [],
        baseIntensity: 0.3,
      },
    };

  let bestMatch: Emotion = "neutral";
  let bestScore = 0;
  let intensity = 0.3;

  for (const [emotion, config] of Object.entries(patterns) as [
    Emotion,
    typeof patterns.joy,
  ][]) {
    let score = 0;
    for (const word of config.words) {
      if (lower.includes(word)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = emotion;
      intensity = config.baseIntensity;
    }
  }

  if (text.includes("!"))
    intensity = Math.min(1, intensity + 0.1 * (text.match(/!/g)?.length || 0));
  if (text.includes("?")) intensity = Math.min(1, intensity + 0.05);
  if (text === text.toUpperCase() && text.length > 3)
    intensity = Math.min(1, intensity + 0.15);

  return { emotion: bestMatch, intensity };
}

/**
 * Parsear JSON de chats
 */
export function parseChatsFromJSON(jsonData: any): ChatFragment[] {
  const fragments: ChatFragment[] = [];
  let id = 0;

  if (Array.isArray(jsonData)) {
    for (const item of jsonData) {
      const fragment = parseItem(item, id++);
      if (fragment) fragments.push(fragment);
    }
  } else if (jsonData.messages) {
    for (const msg of jsonData.messages) {
      const fragment = parseItem(msg, id++);
      if (fragment) fragments.push(fragment);
    }
  }

  return fragments;
}

function parseItem(item: any, id: number): ChatFragment | null {
  if (!item.text && !item.message && !item.content) return null;

  const text = item.text || item.message || item.content;
  if (!text || typeof text !== "string" || text.length < 5) return null;

  const speaker: Speaker =
    item.speaker === "isa" || item.sender === "isa" || item.from === "isa"
      ? "isa"
      : item.speaker === "stev" ||
          item.sender === "stev" ||
          item.from === "stev"
        ? "stev"
        : item.is_from_me || item.isFromMe
          ? "stev"
          : "isa";

  const { emotion, intensity } = detectEmotion(text);

  return {
    id: `chat_${id}`,
    date:
      item.date ||
      item.timestamp ||
      item.created_at ||
      new Date().toISOString(),
    speaker,
    text: text.substring(0, 500),
    emotion,
    intensity,
    trigger: generateTrigger(emotion, intensity),
    discovered: false,
  };
}

/**
 * Generar trigger automático basado en emoción
 */
function generateTrigger(
  emotion: Emotion,
  intensity: number,
): ChatFragment["trigger"] {
  const triggers: Record<Emotion, Partial<ChatFragment["trigger"]>> = {
    joy: { field: "joy", context: "any" },
    love: { field: "love", context: "pair" },
    nostalgia: { field: "nostalgia", time: "dusk" },
    wonder: { field: "wonder", context: "discovery" },
    melancholy: { field: "melancholy", time: "night" },
    neutral: { context: "any" },
  };

  return {
    ...triggers[emotion],
    threshold: 0.3 + (1 - intensity) * 0.5,
  };
}

/**
 * ChatManager - Gestiona la base de datos de chats
 */
export class ChatManager {
  private fragments: ChatFragment[] = [];
  private discoveredCount = 0;

  /**
   * Cargar fragmentos
   */
  load(fragments: ChatFragment[]): void {
    this.fragments = fragments;
    this.discoveredCount = fragments.filter((f) => f.discovered).length;
  }

  /**
   * Cargar desde JSON
   */
  loadFromJSON(jsonData: any): void {
    this.fragments = parseChatsFromJSON(jsonData);
    this.discoveredCount = 0;
  }

  /**
   * Obtener fragmentos por emoción
   */
  getByEmotion(emotion: Emotion): ChatFragment[] {
    return this.fragments.filter((f) => f.emotion === emotion);
  }

  /**
   * Obtener fragmentos no descubiertos
   */
  getUndiscovered(): ChatFragment[] {
    return this.fragments.filter((f) => !f.discovered);
  }

  /**
   * Obtener fragmento aleatorio que cumple condiciones
   */
  getMatchingFragment(
    emotion?: Emotion,
    context?: ContextType,
    time?: TimeOfDay,
  ): ChatFragment | null {
    const candidates = this.fragments.filter((f) => {
      if (f.discovered) return false;
      if (emotion && f.emotion !== emotion) return false;
      if (
        context &&
        f.trigger?.context &&
        f.trigger.context !== "any" &&
        f.trigger.context !== context
      )
        return false;
      if (
        time &&
        f.trigger?.time &&
        f.trigger.time !== "any" &&
        f.trigger.time !== time
      )
        return false;
      return true;
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.intensity - a.intensity);

    const idx = Math.floor(Math.random() * Math.min(3, candidates.length));
    return candidates[idx];
  }

  /**
   * Marcar fragmento como descubierto
   */
  discover(id: string, tick: number): boolean {
    const fragment = this.fragments.find((f) => f.id === id);
    if (!fragment || fragment.discovered) return false;

    fragment.discovered = true;
    fragment.discoveredAt = tick;
    this.discoveredCount++;

    return true;
  }

  /**
   * Obtener estadísticas
   */
  getStats(): ChatStats {
    const byEmotion: Record<Emotion, number> = {
      joy: 0,
      love: 0,
      nostalgia: 0,
      wonder: 0,
      melancholy: 0,
      neutral: 0,
    };
    const bySpeaker: Record<Speaker, number> = { isa: 0, stev: 0 };

    for (const f of this.fragments) {
      byEmotion[f.emotion]++;
      bySpeaker[f.speaker]++;
    }

    return {
      total: this.fragments.length,
      discovered: this.discoveredCount,
      remaining: this.fragments.length - this.discoveredCount,
      byEmotion,
      bySpeaker,
    };
  }

  /**
   * Serializar para persistencia
   */
  serialize(): ChatFragment[] {
    return this.fragments;
  }
}

export interface ChatStats {
  total: number;
  discovered: number;
  remaining: number;
  byEmotion: Record<Emotion, number>;
  bySpeaker: Record<Speaker, number>;
}
