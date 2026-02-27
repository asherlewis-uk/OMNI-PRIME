// ═══════════════════════════════════════════════════════════════════════════════
// GENESIS TYPES — Onboarding & User Profile System
// Canonical source of truth for all Genesis/Onboarding domain types.
// These types are consumed by: Zustand stores, API routes, ContextInjector,
// Drizzle schema ($type<> annotations), and UI components.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enums (string union types for SQLite TEXT columns) ──────────────────────

/**
 * Use case categories for the Genesis onboarding flow.
 * Determines the default agent templates to spawn.
 * Stored in: user_profiles.use_case
 */
export type UseCaseType =
  | "marketer"
  | "developer"
  | "founder"
  | "writer"
  | "researcher"
  | "designer"
  | "student"
  | "custom";

/**
 * Skill level affects the default temperature and prompt style.
 * Stored in: user_profiles.skill_level
 */
export type SkillLevel = "beginner" | "intermediate" | "expert";

/**
 * Work style influences agent collaboration patterns.
 * Stored in: user_profiles.work_style
 */
export type WorkStyle = "solo" | "team" | "hybrid";

/**
 * Content tone for agent responses.
 * Stored in: user_profiles.content_tone
 */
export type ContentTone = "professional" | "casual" | "technical" | "creative";

// ─── Core Data Structures ────────────────────────────────────────────────────

/**
 * Raw answers collected from the onboarding wizard.
 * Keys correspond to step IDs for traceability.
 * Stored in: user_profiles.raw_answers (JSON)
 */
export type GenesisRawAnswers = Record<string, string | string[]>;

/**
 * Core genesis data structure — the composite view of a user's onboarding profile.
 * This is the "DNA" that personalizes all agent interactions.
 *
 * NOTE: In the DB, these fields are stored as individual columns on
 * `user_profiles` (not as a single JSON blob). This interface represents
 * the *reassembled* composite used by the ContextInjector and Genesis store.
 */
export interface GenesisData {
  /** Primary use case selected by the user */
  useCase: UseCaseType;

  /** Specific objectives the user wants to achieve */
  objectives: string[];

  /** User's expertise level — affects response depth */
  skillLevel: SkillLevel;

  /** Preferred collaboration pattern */
  workStyle: WorkStyle;

  /** Preferred communication style for agent responses */
  contentTone: ContentTone;

  /** Tools the user wants agents to have access to */
  toolPreferences: string[];

  /** Complete record of onboarding answers for debugging/template refinement */
  rawAnswers: GenesisRawAnswers;
}

// ─── Onboarding Wizard State ─────────────────────────────────────────────────

/**
 * Onboarding wizard step state.
 * Tracks progress through the Genesis flow.
 */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  data: unknown;
}

/**
 * Complete onboarding state for the wizard component.
 * Used by the `genesisStore` Zustand store.
 */
export interface OnboardingState {
  /** Current step index (0-based) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Individual step states */
  steps: OnboardingStep[];

  /** Accumulated answers (partial during onboarding) */
  answers: Partial<GenesisData>;

  /** Whether onboarding is in progress */
  isInProgress: boolean;

  /** Whether onboarding has been completed */
  isComplete: boolean;

  /** Error state for validation failures */
  error: string | null;

  /** Loading state for agent generation */
  isGenerating: boolean;

  /** Progress percentage for agent generation (0-100) */
  generationProgress: number;

  /** IDs of agents created during onboarding */
  generatedAgentIds: string[];
}

// ─── Template Definitions ────────────────────────────────────────────────────

/**
 * Use case template definition.
 * Maps use cases to default agent configurations.
 */
export interface UseCaseTemplate {
  useCase: UseCaseType;
  displayName: string;
  description: string;
  icon: string;
  defaultObjectives: string[];
  defaultTools: string[];
  recommendedAgents: TemplateAgentDef[];
}

/**
 * Agent template definition within a use case.
 * Used by the Genesis agent generator to spawn personalized agents.
 */
export interface TemplateAgentDef {
  id: string;
  name: string;
  description: string;
  avatar: string;
  basePrompt: string;
  defaultTools: string[];
  relevantObjectives: string[];
  recommendedModel: string;
  defaultTemperature: number;
}

// ─── Context Injection ───────────────────────────────────────────────────────

/**
 * Context guidance generated from genesis data.
 * Injected into agent system prompts by the ContextInjector.
 */
export interface GenesisContext {
  formattedContext: string;
  expertiseGuidance: string;
  toneGuidance: string;
  workStyleGuidance: string;
}

// ─── API Contracts ───────────────────────────────────────────────────────────

/**
 * API payload for completing onboarding.
 * POST /api/genesis
 */
export interface CompleteOnboardingPayload {
  genesisData: GenesisData;
}

/**
 * API response after completing onboarding.
 * POST /api/genesis → response
 */
export interface CompleteOnboardingResponse {
  success: boolean;
  profileId: string;
  generatedAgents: {
    id: string;
    name: string;
    description: string;
  }[];
  error?: string;
}
