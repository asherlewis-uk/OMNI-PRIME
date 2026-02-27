// ═══════════════════════════════════════════════════════════════════════════════
// GENESIS STORE - Zustand State Management for Onboarding
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GenesisData,
  UseCaseType,
  SkillLevel,
  WorkStyle,
  ContentTone,
  OnboardingState,
  CompleteOnboardingResponse,
} from "@/types/genesis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Genesis/onboarding store state.
 */
interface GenesisState extends OnboardingState {
  // Persisted profile
  profileId: string | null;
  genesisData: GenesisData | null;

  // Step completion tracking
  completedSteps: string[];
}

/**
 * Genesis store actions.
 */
interface GenesisActions {
  // Navigation
  goToStep: (stepIndex: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Data collection
  setUseCase: (useCase: UseCaseType) => void;
  setObjectives: (objectives: string[]) => void;
  toggleObjective: (objective: string) => void;
  setSkillLevel: (level: SkillLevel) => void;
  setWorkStyle: (style: WorkStyle) => void;
  setContentTone: (tone: ContentTone) => void;
  setToolPreferences: (tools: string[]) => void;
  toggleToolPreference: (tool: string) => void;
  setRawAnswer: (key: string, value: string | string[]) => void;

  // Step completion
  completeCurrentStep: () => void;
  markStepComplete: (stepId: string) => void;
  isStepComplete: (stepId: string) => boolean;
  canProceedToNext: () => boolean;

  // Onboarding completion
  completeOnboarding: () => Promise<CompleteOnboardingResponse | null>;
  setGenerationProgress: (progress: number) => void;

  // Reset
  resetOnboarding: () => void;
  skipOnboarding: () => void;

  // Utility
  getProgressPercentage: () => number;
  isOnboardingRequired: () => boolean;
}

/**
 * Combined genesis store type.
 */
export type GenesisStore = GenesisState & GenesisActions;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TOTAL_STEPS = 5;

const STEP_IDS = [
  "usecase",
  "objectives",
  "tools",
  "personality",
  "generation",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════════════

const createInitialState = (): GenesisState => ({
  // Onboarding state
  currentStep: 0,
  totalSteps: TOTAL_STEPS,
  steps: STEP_IDS.map((id, index) => ({
    id,
    title: getStepTitle(id),
    description: getStepDescription(id),
    isComplete: false,
    isActive: index === 0,
    data: null,
  })),
  answers: {},
  isInProgress: true,
  isComplete: false,
  error: null,
  isGenerating: false,
  generationProgress: 0,
  generatedAgentIds: [],

  // Profile state
  profileId: null,
  genesisData: null,
  completedSteps: [],
});

function getStepTitle(id: (typeof STEP_IDS)[number]): string {
  const titles: Record<(typeof STEP_IDS)[number], string> = {
    usecase: "Select Your Role",
    objectives: "Define Your Goals",
    tools: "Choose Your Tools",
    personality: "Set Your Style",
    generation: "Creating Your Agents",
  };
  return titles[id];
}

function getStepDescription(id: (typeof STEP_IDS)[number]): string {
  const descriptions: Record<(typeof STEP_IDS)[number], string> = {
    usecase: "What best describes your primary role?",
    objectives: "What do you want to achieve with OMNI-PRIME?",
    tools: "Which tools should your agents have access to?",
    personality: "How should your agents communicate?",
    generation: "We're generating your personalized agent swarm...",
  };
  return descriptions[id];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

export const useGenesisStore = create<GenesisStore>()(
  immer(
    persist(
      (set, get) => ({
        ...createInitialState(),

        // ═══════════════════════════════════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════════════════════════════════

        goToStep: (stepIndex) => {
          const { totalSteps, isComplete } = get();

          if (stepIndex < 0 || stepIndex >= totalSteps || isComplete) {
            return;
          }

          set((state) => {
            state.currentStep = stepIndex;
            state.steps.forEach((step, idx) => {
              step.isActive = idx === stepIndex;
            });
          });
        },

        goToNextStep: () => {
          const { currentStep, totalSteps, canProceedToNext } = get();

          if (!canProceedToNext() || currentStep >= totalSteps - 1) {
            return;
          }

          // Mark current step as complete before moving
          get().completeCurrentStep();

          set((state) => {
            state.currentStep += 1;
            state.steps.forEach((step, idx) => {
              step.isActive = idx === state.currentStep;
            });
          });
        },

        goToPreviousStep: () => {
          const { currentStep } = get();

          if (currentStep <= 0) {
            return;
          }

          set((state) => {
            state.currentStep -= 1;
            state.steps.forEach((step, idx) => {
              step.isActive = idx === state.currentStep;
            });
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // DATA COLLECTION
        // ═══════════════════════════════════════════════════════════════════════

        setUseCase: (useCase) => {
          set((state) => {
            state.answers.useCase = useCase;
            state.steps[0].data = { useCase };
          });
        },

        setObjectives: (objectives) => {
          set((state) => {
            state.answers.objectives = objectives;
            state.steps[1].data = { objectives };
          });
        },

        toggleObjective: (objective) => {
          set((state) => {
            const current = state.answers.objectives ?? [];
            const index = current.indexOf(objective);

            if (index === -1) {
              state.answers.objectives = [...current, objective];
            } else {
              state.answers.objectives = current.filter((o) => o !== objective);
            }

            state.steps[1].data = { objectives: state.answers.objectives };
          });
        },

        setSkillLevel: (level) => {
          set((state) => {
            state.answers.skillLevel = level;
          });
        },

        setWorkStyle: (style) => {
          set((state) => {
            state.answers.workStyle = style;
          });
        },

        setContentTone: (tone) => {
          set((state) => {
            state.answers.contentTone = tone;
          });
        },

        setToolPreferences: (tools) => {
          set((state) => {
            state.answers.toolPreferences = tools;
            state.steps[2].data = { tools };
          });
        },

        toggleToolPreference: (tool) => {
          set((state) => {
            const current = state.answers.toolPreferences ?? [];
            const index = current.indexOf(tool);

            if (index === -1) {
              state.answers.toolPreferences = [...current, tool];
            } else {
              state.answers.toolPreferences = current.filter((t) => t !== tool);
            }

            state.steps[2].data = { tools: state.answers.toolPreferences };
          });
        },

        setRawAnswer: (key, value) => {
          set((state) => {
            if (!state.answers.rawAnswers) {
              state.answers.rawAnswers = {};
            }
            state.answers.rawAnswers[key] = value;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // STEP COMPLETION
        // ═══════════════════════════════════════════════════════════════════════

        completeCurrentStep: () => {
          const { currentStep } = get();
          const stepId = STEP_IDS[currentStep];

          if (stepId) {
            get().markStepComplete(stepId);
          }
        },

        markStepComplete: (stepId) => {
          set((state) => {
            const step = state.steps.find((s) => s.id === stepId);
            if (step) {
              step.isComplete = true;
            }

            if (!state.completedSteps.includes(stepId)) {
              state.completedSteps.push(stepId);
            }
          });
        },

        isStepComplete: (stepId) => {
          return get().completedSteps.includes(stepId);
        },

        canProceedToNext: () => {
          const { currentStep, answers } = get();

          switch (currentStep) {
            case 0: // Use case
              return !!answers.useCase;
            case 1: // Objectives
              return (answers.objectives?.length ?? 0) > 0;
            case 2: // Tools
              return true; // Tools are optional
            case 3: // Personality
              return !!(
                answers.skillLevel &&
                answers.workStyle &&
                answers.contentTone
              );
            case 4: // Generation
              return true;
            default:
              return false;
          }
        },

        // ═══════════════════════════════════════════════════════════════════════
        // ONBOARDING COMPLETION
        // ═══════════════════════════════════════════════════════════════════════

        completeOnboarding: async () => {
          const { answers } = get();

          // Validate required fields
          if (
            !answers.useCase ||
            !answers.objectives?.length ||
            !answers.skillLevel ||
            !answers.workStyle ||
            !answers.contentTone
          ) {
            set((state) => {
              state.error = "Please complete all required fields";
            });
            return null;
          }

          set((state) => {
            state.isGenerating = true;
            state.error = null;
          });

          try {
            // Build genesis data
            const genesisData: GenesisData = {
              useCase: answers.useCase,
              objectives: answers.objectives,
              skillLevel: answers.skillLevel,
              workStyle: answers.workStyle,
              contentTone: answers.contentTone,
              toolPreferences: answers.toolPreferences ?? [],
              rawAnswers: answers.rawAnswers ?? {},
            };

            // Simulate progress updates
            const progressInterval = setInterval(() => {
              set((state) => {
                if (state.generationProgress < 90) {
                  state.generationProgress += Math.random() * 15;
                  if (state.generationProgress > 90) {
                    state.generationProgress = 90;
                  }
                }
              });
            }, 500);

            // Call API to complete onboarding
            const response = await fetch("/api/onboarding/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ genesisData }),
            });

            clearInterval(progressInterval);

            if (!response.ok) {
              throw new Error("Failed to complete onboarding");
            }

            const result =
              (await response.json()) as CompleteOnboardingResponse;

            set((state) => {
              state.isGenerating = false;
              state.generationProgress = 100;
              state.isComplete = true;
              state.isInProgress = false;
              state.genesisData = genesisData;
              state.profileId = result.profileId;
              state.generatedAgentIds = result.generatedAgents.map((a) => a.id);
            });

            return result;
          } catch (error) {
            set((state) => {
              state.isGenerating = false;
              state.error =
                error instanceof Error ? error.message : "Unknown error";
            });
            return null;
          }
        },

        setGenerationProgress: (progress) => {
          set((state) => {
            state.generationProgress = Math.min(100, Math.max(0, progress));
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // RESET
        // ═══════════════════════════════════════════════════════════════════════

        resetOnboarding: () => {
          set(createInitialState());
        },

        skipOnboarding: () => {
          set((state) => {
            state.isComplete = true;
            state.isInProgress = false;
            state.currentStep = TOTAL_STEPS - 1;
            state.generationProgress = 100;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // UTILITY
        // ═══════════════════════════════════════════════════════════════════════

        getProgressPercentage: () => {
          const { currentStep, totalSteps, canProceedToNext } = get();

          // Base progress from completed steps
          const baseProgress = (currentStep / totalSteps) * 100;

          // Add partial progress for current step if it can proceed
          const partialProgress = canProceedToNext()
            ? 100 / totalSteps / 2
            : 0;

          return Math.min(100, Math.round(baseProgress + partialProgress));
        },

        isOnboardingRequired: () => {
          const { isComplete, genesisData } = get();
          return !isComplete && !genesisData;
        },
      }),
      {
        name: "omni-prime-genesis-store",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          profileId: state.profileId,
          genesisData: state.genesisData,
          isComplete: state.isComplete,
          completedSteps: state.completedSteps,
        }),
      }
    )
  )
);

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";

/**
 * Get current step data.
 */
export function useCurrentStep() {
  const { currentStep, steps } = useGenesisStore();

  return useMemo(() => {
    return steps[currentStep] ?? null;
  }, [currentStep, steps]);
}

/**
 * Check if onboarding can be completed.
 */
export function useCanCompleteOnboarding(): boolean {
  const { answers } = useGenesisStore();

  return useMemo(() => {
    return !!(
      answers.useCase &&
      answers.objectives?.length &&
      answers.skillLevel &&
      answers.workStyle &&
      answers.contentTone
    );
  }, [answers]);
}

/**
 * Get step validation errors.
 */
export function useStepValidation(): Record<number, string | null> {
  const { answers } = useGenesisStore();

  return useMemo(() => {
    return {
      0: answers.useCase ? null : "Please select a role",
      1:
        answers.objectives?.length ?? 0 > 0
          ? null
          : "Please select at least one objective",
      2: null, // Tools are optional
      3:
        answers.skillLevel && answers.workStyle && answers.contentTone
          ? null
          : "Please complete all personality settings",
      4: null,
    };
  }, [answers]);
}
