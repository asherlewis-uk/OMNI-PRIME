import Dexie from "dexie";
import type { GenesisData, GenesisContext, UseCaseType, SkillLevel, ContentTone, WorkStyle } from "@/types/genesis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cached genesis profile entry.
 */
interface CachedGenesisProfile {
  id: string;
  data: GenesisData;
  timestamp: number;
}

/**
 * Context injection options.
 */
export interface InjectionOptions {
  /** Include expertise guidance */
  includeExpertise?: boolean;

  /** Include tone guidance */
  includeTone?: boolean;

  /** Include work style guidance */
  includeWorkStyle?: boolean;

  /** Include tool preferences */
  includeTools?: boolean;

  /** Custom prefix for context block */
  contextPrefix?: string;

  /** Custom suffix for context block */
  contextSuffix?: string;

  /** Format style */
  format?: "detailed" | "compact" | "minimal";
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEXIE DATABASE FOR CLIENT-SIDE CACHING
// ═══════════════════════════════════════════════════════════════════════════════

class GenesisDatabase extends Dexie {
  profiles!: Dexie.Table<CachedGenesisProfile, string>;

  constructor() {
    super("OmniPrimeGenesis");
    this.version(1).stores({
      profiles: "id, timestamp",
    });
  }
}

const dexie = new GenesisDatabase();

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT INJECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ContextInjector {
  private cache: CachedGenesisProfile | null = null;
  private readonly CACHE_KEY = "omni_prime_genesis_profile";
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Initialize cache on construction
    this.initialize().catch(console.error);
  }

  /**
   * Initialize the injector by loading from IndexedDB.
   */
  async initialize(): Promise<void> {
    try {
      const stored = await dexie.profiles.get(this.CACHE_KEY);
      if (stored && Date.now() - stored.timestamp < this.CACHE_TTL) {
        this.cache = stored;
      }
    } catch (error) {
      console.error("Failed to initialize ContextInjector:", error);
    }
  }

  /**
   * Cache the genesis profile.
   */
  async cacheProfile(data: GenesisData): Promise<void> {
    const entry: CachedGenesisProfile = {
      id: this.CACHE_KEY,
      data,
      timestamp: Date.now(),
    };

    this.cache = entry;

    try {
      await dexie.profiles.put(entry);
    } catch (error) {
      console.error("Failed to cache genesis profile:", error);
    }
  }

  /**
   * Get the cached genesis profile.
   */
  getProfile(): GenesisData | null {
    return this.cache?.data ?? null;
  }

  /**
   * Check if a profile is cached.
   */
  hasProfile(): boolean {
    return this.cache !== null;
  }

  /**
   * Clear the cached profile.
   */
  async clearProfile(): Promise<void> {
    this.cache = null;
    try {
      await dexie.profiles.delete(this.CACHE_KEY);
    } catch (error) {
      console.error("Failed to clear genesis profile:", error);
    }
  }

  /**
   * Generate the full genesis context string for injection.
   */
  getGenesisContext(options: InjectionOptions = {}): string {
    if (!this.cache?.data) {
      return "";
    }

    const data = this.cache.data;
    const format = options.format ?? "detailed";

    switch (format) {
      case "minimal":
        return this.formatMinimalContext(data, options);
      case "compact":
        return this.formatCompactContext(data, options);
      case "detailed":
      default:
        return this.formatDetailedContext(data, options);
    }
  }

  /**
   * Generate structured context components.
   */
  getContextComponents(): GenesisContext {
    if (!this.cache?.data) {
      return {
        formattedContext: "",
        expertiseGuidance: "",
        toneGuidance: "",
        workStyleGuidance: "",
      };
    }

    const data = this.cache.data;

    return {
      formattedContext: this.getGenesisContext(),
      expertiseGuidance: this.getExpertiseGuidance(data.skillLevel),
      toneGuidance: this.getToneGuidance(data.contentTone),
      workStyleGuidance: this.getWorkStyleGuidance(data.workStyle),
    };
  }

  /**
   * Build a complete system prompt with injected context.
   */
  buildSystemPrompt(
    basePrompt: string,
    options: InjectionOptions & { position?: "start" | "end" } = {}
  ): string {
    const context = this.getGenesisContext(options);

    if (!context) {
      return basePrompt;
    }

    const position = options.position ?? "end";

    if (position === "start") {
      return `${context}\n\n${basePrompt}`;
    } else {
      return `${basePrompt}\n\n${context}`;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // FORMATTING METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private formatDetailedContext(
    data: GenesisData,
    options: InjectionOptions
  ): string {
    const lines: string[] = [
      options.contextPrefix ?? "[OMNI-PRIME USER CONTEXT]",
      "─".repeat(40),
      "",
      "Identity Profile:",
      `• Role: ${this.formatUseCase(data.useCase)}`,
      `• Expertise: ${data.skillLevel}`,
      `• Work Style: ${data.workStyle}`,
      `• Communication: ${data.contentTone}`,
      "",
    ];

    if (data.objectives.length > 0) {
      lines.push("Primary Objectives:");
      for (const objective of data.objectives) {
        lines.push(`• ${objective}`);
      }
      lines.push("");
    }

    if (options.includeTools !== false && data.toolPreferences.length > 0) {
      lines.push("Preferred Tools:");
      for (const tool of data.toolPreferences) {
        lines.push(`• ${tool}`);
      }
      lines.push("");
    }

    if (options.includeExpertise !== false) {
      lines.push(this.getExpertiseGuidance(data.skillLevel));
      lines.push("");
    }

    if (options.includeTone !== false) {
      lines.push(this.getToneGuidance(data.contentTone));
      lines.push("");
    }

    if (options.includeWorkStyle !== false) {
      lines.push(this.getWorkStyleGuidance(data.workStyle));
      lines.push("");
    }

    lines.push("─".repeat(40));
    lines.push(options.contextSuffix ?? "[END CONTEXT]");

    return lines.join("\n");
  }

  private formatCompactContext(
    data: GenesisData,
    options: InjectionOptions
  ): string {
    const parts: string[] = [
      "[Context]",
      `Role: ${this.formatUseCase(data.useCase)}`,
      `Level: ${data.skillLevel}`,
      `Style: ${data.contentTone}`,
    ];

    if (data.objectives.length > 0) {
      parts.push(`Goals: ${data.objectives.join(", ")}`);
    }

    if (options.includeExpertise !== false) {
      parts.push(this.getExpertiseGuidance(data.skillLevel));
    }

    if (options.includeTone !== false) {
      parts.push(this.getToneGuidance(data.contentTone));
    }

    return parts.join(" | ");
  }

  private formatMinimalContext(
    _data: GenesisData,
    _options: InjectionOptions
  ): string {
    // Minimal context is just a marker that context exists
    // Actual behavior modifiers are applied by the gateway
    return "[Personalized Context Active]";
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // GUIDANCE GENERATORS
  // ═════════════════════════════════════════════════════════════════════════════

  private getExpertiseGuidance(level: SkillLevel): string {
    const guidance: Record<SkillLevel, string> = {
      beginner:
        "GUIDANCE: Explain concepts thoroughly. Avoid jargon. Offer step-by-step instructions. Check for understanding.",
      intermediate:
        "GUIDANCE: Balance technical depth with accessibility. Assume familiarity with basic concepts. Focus on practical application.",
      expert:
        "GUIDANCE: Be concise and technical. Skip basic explanations. Focus on edge cases, optimization, and advanced patterns.",
    };

    return guidance[level];
  }

  private getToneGuidance(tone: ContentTone): string {
    const guidance: Record<ContentTone, string> = {
      professional:
        "TONE: Formal, business-appropriate, clear and direct. Use industry-standard terminology.",
      casual:
        "TONE: Friendly, conversational, approachable. Feel free to use informal language and humor.",
      technical:
        "TONE: Precise, use domain terminology liberally. Structured, logical presentation of information.",
      creative:
        "TONE: Expressive, use analogies and metaphors. Engaging, inspiring, and imaginative.",
    };

    return guidance[tone];
  }

  private getWorkStyleGuidance(style: WorkStyle): string {
    const guidance: Record<WorkStyle, string> = {
      solo:
        "WORK STYLE: Provide complete, self-contained solutions. The user works independently.",
      team:
        "WORK STYLE: Consider collaboration patterns. Suggest how outputs can be shared or reviewed by others.",
      hybrid:
        "WORK STYLE: Balance independent work with collaborative checkpoints. Offer both solo and team-oriented approaches.",
    };

    return guidance[style];
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private formatUseCase(useCase: UseCaseType): string {
    const displayNames: Record<UseCaseType, string> = {
      marketer: "Marketing Professional",
      developer: "Software Developer",
      founder: "Startup Founder",
      writer: "Content Writer",
      researcher: "Researcher",
      designer: "Designer",
      student: "Student",
      custom: "Custom User",
    };

    return displayNames[useCase] ?? "User";
  }

  /**
   * Get cache age in milliseconds.
   */
  getCacheAge(): number | null {
    if (!this.cache) return null;
    return Date.now() - this.cache.timestamp;
  }

  /**
   * Check if cache is stale (older than TTL).
   */
  isCacheStale(): boolean {
    const age = this.getCacheAge();
    if (age === null) return true;
    return age > this.CACHE_TTL;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const contextInjector = new ContextInjector();

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type { CachedGenesisProfile };
