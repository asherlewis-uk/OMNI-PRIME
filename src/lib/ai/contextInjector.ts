// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT INJECTOR — Server-Side Genesis Context for LLM System Prompts
//
// SERVER-SIDE ONLY. This module reads from SQLite via reconstructGenesisData().
// It does NOT import Dexie.js or any browser-only API.
//
// For client-side genesis caching (IndexedDB/Dexie), use the genesisStore
// Zustand store which persists to localStorage and can hydrate from the API.
// ═══════════════════════════════════════════════════════════════════════════════

import { reconstructGenesisData } from "@/lib/db/client";
import type {
  GenesisData,
  GenesisContext,
  UseCaseType,
  SkillLevel,
  ContentTone,
  WorkStyle,
} from "@/types/genesis";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Context injection options.
 */
export interface InjectionOptions {
  includeExpertise?: boolean;
  includeTone?: boolean;
  includeWorkStyle?: boolean;
  includeTools?: boolean;
  contextPrefix?: string;
  contextSuffix?: string;
  format?: "detailed" | "compact" | "minimal";
}

// ─── Context Injector Class ──────────────────────────────────────────────────

export class ContextInjector {
  private cache: GenesisData | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory TTL

  /**
   * Load the genesis profile from SQLite into the in-memory cache.
   * Called lazily on first access or when cache is stale.
   */
  async loadProfile(profileId?: string): Promise<GenesisData | null> {
    const data = await reconstructGenesisData(profileId);
    if (data) {
      this.cache = data;
      this.cacheTimestamp = Date.now();
    }
    return data;
  }

  /**
   * Set the genesis profile directly (e.g., after onboarding completes).
   * Avoids an extra DB round-trip when the caller already has the data.
   */
  setProfile(data: GenesisData): void {
    this.cache = data;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Get the cached genesis profile.
   * Returns null if no profile has been loaded.
   */
  getProfile(): GenesisData | null {
    return this.cache;
  }

  /**
   * Check if a profile is loaded.
   */
  hasProfile(): boolean {
    return this.cache !== null;
  }

  /**
   * Check if the in-memory cache is stale.
   */
  isCacheStale(): boolean {
    if (!this.cache) return true;
    return Date.now() - this.cacheTimestamp > this.CACHE_TTL;
  }

  /**
   * Clear the in-memory cache.
   */
  clearProfile(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Ensure the cache is populated. Loads from DB if stale or empty.
   */
  async ensureLoaded(profileId?: string): Promise<GenesisData | null> {
    if (this.cache && !this.isCacheStale()) {
      return this.cache;
    }
    return this.loadProfile(profileId);
  }

  // ─── Context Generation ────────────────────────────────────────────────────

  /**
   * Generate the full genesis context string for injection into system prompts.
   * Reads from the in-memory cache. Call `ensureLoaded()` before this if needed.
   */
  getGenesisContext(options: InjectionOptions = {}): string {
    if (!this.cache) {
      return "";
    }

    const format = options.format ?? "detailed";

    switch (format) {
      case "minimal":
        return this.formatMinimalContext(this.cache);
      case "compact":
        return this.formatCompactContext(this.cache, options);
      case "detailed":
      default:
        return this.formatDetailedContext(this.cache, options);
    }
  }

  /**
   * Generate structured context components.
   */
  getContextComponents(): GenesisContext {
    if (!this.cache) {
      return {
        formattedContext: "",
        expertiseGuidance: "",
        toneGuidance: "",
        workStyleGuidance: "",
      };
    }

    return {
      formattedContext: this.getGenesisContext(),
      expertiseGuidance: this.getExpertiseGuidance(this.cache.skillLevel),
      toneGuidance: this.getToneGuidance(this.cache.contentTone),
      workStyleGuidance: this.getWorkStyleGuidance(this.cache.workStyle),
    };
  }

  /**
   * Build a complete system prompt with injected context.
   * This is the primary entry point used by API routes.
   */
  buildSystemPrompt(
    basePrompt: string,
    options: InjectionOptions & { position?: "start" | "end" } = {},
  ): string {
    const context = this.getGenesisContext(options);

    if (!context) {
      return basePrompt;
    }

    const position = options.position ?? "end";

    if (position === "start") {
      return `${context}\n\n${basePrompt}`;
    }
    return `${basePrompt}\n\n${context}`;
  }

  // ─── Formatting Methods ────────────────────────────────────────────────────

  private formatDetailedContext(
    data: GenesisData,
    options: InjectionOptions = {},
  ): string {
    const lines: string[] = [
      options.contextPrefix ?? "[OMNI-PRIME USER CONTEXT]",
      "\u2500".repeat(40),
      "",
      "Identity Profile:",
      `\u2022 Role: ${this.formatUseCase(data.useCase)}`,
      `\u2022 Expertise: ${data.skillLevel}`,
      `\u2022 Work Style: ${data.workStyle}`,
      `\u2022 Communication: ${data.contentTone}`,
      "",
    ];

    if (data.objectives.length > 0) {
      lines.push("Primary Objectives:");
      for (const objective of data.objectives) {
        lines.push(`\u2022 ${objective}`);
      }
      lines.push("");
    }

    if (options.includeTools !== false && data.toolPreferences.length > 0) {
      lines.push("Preferred Tools:");
      for (const tool of data.toolPreferences) {
        lines.push(`\u2022 ${tool}`);
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

    lines.push("\u2500".repeat(40));
    lines.push(options.contextSuffix ?? "[END CONTEXT]");

    return lines.join("\n");
  }

  private formatCompactContext(
    data: GenesisData,
    options: InjectionOptions,
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

  private formatMinimalContext(_data: GenesisData): string {
    return "[Personalized Context Active]";
  }

  // ─── Guidance Generators ───────────────────────────────────────────────────

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
      solo: "WORK STYLE: Provide complete, self-contained solutions. The user works independently.",
      team: "WORK STYLE: Consider collaboration patterns. Suggest how outputs can be shared or reviewed by others.",
      hybrid:
        "WORK STYLE: Balance independent work with collaborative checkpoints. Offer both solo and team-oriented approaches.",
    };
    return guidance[style];
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

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
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const contextInjector = new ContextInjector();
