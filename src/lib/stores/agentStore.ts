// ═══════════════════════════════════════════════════════════════════════════════
// AGENT STORE - Zustand State Management for Agents
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Agent,
  AgentWithDetails,
  CreateAgentPayload,
  UpdateAgentPayload,
  AgentFilterOptions,
} from "@/types/agent";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent store state.
 */
interface AgentState {
  // Data
  agents: Agent[];
  selectedAgentId: string | null;
  currentAgent: AgentWithDetails | null;

  // UI State
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;

  // Filters
  filters: AgentFilterOptions;
  searchQuery: string;

  // Editor State
  isEditorOpen: boolean;
  editingAgentId: string | null;
  editorDraft: Partial<CreateAgentPayload> | null;
}

/**
 * Agent store actions.
 */
interface AgentActions {
  // Data Actions
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  removeAgent: (agentId: string) => void;
  setCurrentAgent: (agent: AgentWithDetails | null) => void;

  // Selection
  selectAgent: (agentId: string | null) => void;

  // Async Actions
  fetchAgents: () => Promise<void>;
  fetchAgentDetails: (agentId: string) => Promise<void>;
  createAgent: (payload: CreateAgentPayload) => Promise<Agent | null>;
  updateAgentDetails: (
    agentId: string,
    payload: UpdateAgentPayload
  ) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  duplicateAgent: (agentId: string) => Promise<Agent | null>;

  // Filter Actions
  setFilters: (filters: Partial<AgentFilterOptions>) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Editor Actions
  openEditor: (agentId?: string) => void;
  closeEditor: () => void;
  setEditorDraft: (draft: Partial<CreateAgentPayload>) => void;
  updateEditorDraft: (updates: Partial<CreateAgentPayload>) => void;
  saveEditorDraft: () => Promise<void>;

  // Utility
  getAgentById: (agentId: string) => Agent | undefined;
  getAgentsByUseCase: (useCase: string) => Agent[];
  clearError: () => void;
  reset: () => void;
}

/**
 * Combined agent store type.
 */
export type AgentStore = AgentState & AgentActions;

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════════════

const defaultFilters: AgentFilterOptions = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

const initialState: AgentState = {
  agents: [],
  selectedAgentId: null,
  currentAgent: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  filters: defaultFilters,
  searchQuery: "",
  isEditorOpen: false,
  editingAgentId: null,
  editorDraft: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// STORE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

export const useAgentStore = create<AgentStore>()(
  immer(
    persist(
      (set, get) => ({
        ...initialState,

        // ═══════════════════════════════════════════════════════════════════════
        // DATA ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        setAgents: (agents) => {
          set((state) => {
            state.agents = agents;
          });
        },

        addAgent: (agent) => {
          set((state) => {
            state.agents.unshift(agent);
          });
        },

        updateAgent: (agentId, updates) => {
          set((state) => {
            const index = state.agents.findIndex((a) => a.id === agentId);
            if (index !== -1) {
              state.agents[index] = { ...state.agents[index], ...updates } as Agent;
            }
            if (state.currentAgent?.id === agentId) {
              state.currentAgent = { ...state.currentAgent, ...updates };
            }
          });
        },

        removeAgent: (agentId) => {
          set((state) => {
            state.agents = state.agents.filter((a) => a.id !== agentId);
            if (state.selectedAgentId === agentId) {
              state.selectedAgentId = null;
            }
            if (state.currentAgent?.id === agentId) {
              state.currentAgent = null;
            }
          });
        },

        setCurrentAgent: (agent) => {
          set((state) => {
            state.currentAgent = agent;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // SELECTION
        // ═══════════════════════════════════════════════════════════════════════

        selectAgent: (agentId) => {
          set((state) => {
            state.selectedAgentId = agentId;
          });

          if (agentId) {
            get().fetchAgentDetails(agentId);
          } else {
            set((state) => {
              state.currentAgent = null;
            });
          }
        },

        // ═══════════════════════════════════════════════════════════════════════
        // ASYNC ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        fetchAgents: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch("/api/agents");
            if (!response.ok) {
              throw new Error("Failed to fetch agents");
            }

            const data = (await response.json()) as { agents: Agent[] };
            set((state) => {
              state.agents = data.agents;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isLoading = false;
            });
          }
        },

        fetchAgentDetails: async (agentId) => {
          try {
            const response = await fetch(`/api/agents/${agentId}`);
            if (!response.ok) {
              throw new Error("Failed to fetch agent details");
            }

            const data = (await response.json()) as { agent: AgentWithDetails };
            set((state) => {
              state.currentAgent = data.agent;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
            });
          }
        },

        createAgent: async (payload) => {
          set((state) => {
            state.isCreating = true;
            state.error = null;
          });

          try {
            const response = await fetch("/api/agents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error("Failed to create agent");
            }

            const data = (await response.json()) as { agent: Agent };
            set((state) => {
              state.agents.unshift(data.agent);
              state.isCreating = false;
            });

            return data.agent;
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isCreating = false;
            });
            return null;
          }
        },

        updateAgentDetails: async (agentId, payload) => {
          set((state) => {
            state.isUpdating = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/agents/${agentId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error("Failed to update agent");
            }

            const data = (await response.json()) as { agent: Agent };
            set((state) => {
              const index = state.agents.findIndex((a) => a.id === agentId);
              if (index !== -1) {
                state.agents[index] = data.agent;
              }
              if (state.currentAgent?.id === agentId) {
                state.currentAgent = {
                  ...state.currentAgent,
                  ...data.agent,
                } as AgentWithDetails;
              }
              state.isUpdating = false;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isUpdating = false;
            });
          }
        },

        deleteAgent: async (agentId) => {
          set((state) => {
            state.isDeleting = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/agents/${agentId}`, {
              method: "DELETE",
            });

            if (!response.ok) {
              throw new Error("Failed to delete agent");
            }

            set((state) => {
              state.agents = state.agents.filter((a) => a.id !== agentId);
              if (state.selectedAgentId === agentId) {
                state.selectedAgentId = null;
              }
              if (state.currentAgent?.id === agentId) {
                state.currentAgent = null;
              }
              state.isDeleting = false;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isDeleting = false;
            });
          }
        },

        duplicateAgent: async (agentId) => {
          const agent = get().getAgentById(agentId);
          if (!agent) return null;

          const payload: CreateAgentPayload = {
            name: `${agent.name} (Copy)`,
            avatar: agent.avatar ?? undefined,
            description: agent.description ?? undefined,
            systemPrompt: agent.systemPrompt,
            temperature: agent.temperature,
            modelPreference: agent.modelPreference,
            voiceId: agent.voiceId ?? undefined,
          };

          return get().createAgent(payload);
        },

        // ═══════════════════════════════════════════════════════════════════════
        // FILTER ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        setFilters: (filters) => {
          set((state) => {
            state.filters = { ...state.filters, ...filters };
          });
        },

        setSearchQuery: (query) => {
          set((state) => {
            state.searchQuery = query;
          });
        },

        resetFilters: () => {
          set((state) => {
            state.filters = defaultFilters;
            state.searchQuery = "";
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // EDITOR ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        openEditor: (agentId) => {
          set((state) => {
            state.isEditorOpen = true;
            state.editingAgentId = agentId ?? null;
            state.error = null;

            if (agentId) {
              const agent = state.agents.find((a) => a.id === agentId);
              if (agent) {
                state.editorDraft = {
                  name: agent.name,
                  avatar: agent.avatar ?? undefined,
                  description: agent.description ?? undefined,
                  systemPrompt: agent.systemPrompt,
                  temperature: agent.temperature,
                  modelPreference: agent.modelPreference,
                  voiceId: agent.voiceId ?? undefined,
                };
              }
            } else {
              state.editorDraft = {
                name: "",
                systemPrompt: "",
                temperature: 0.7,
                modelPreference: "ollama/llama3.1",
              };
            }
          });
        },

        closeEditor: () => {
          set((state) => {
            state.isEditorOpen = false;
            state.editingAgentId = null;
            state.editorDraft = null;
          });
        },

        setEditorDraft: (draft) => {
          set((state) => {
            state.editorDraft = draft;
          });
        },

        updateEditorDraft: (updates) => {
          set((state) => {
            if (state.editorDraft) {
              state.editorDraft = { ...state.editorDraft, ...updates };
            }
          });
        },

        saveEditorDraft: async () => {
          const { editorDraft, editingAgentId } = get();
          if (!editorDraft) return;

          if (editingAgentId) {
            await get().updateAgentDetails(editingAgentId, editorDraft);
          } else {
            const newAgent = await get().createAgent(
              editorDraft as CreateAgentPayload
            );
            if (newAgent) {
              set((state) => {
                state.selectedAgentId = newAgent.id;
              });
            }
          }

          get().closeEditor();
        },

        // ═══════════════════════════════════════════════════════════════════════
        // UTILITY
        // ═══════════════════════════════════════════════════════════════════════

        getAgentById: (agentId) => {
          return get().agents.find((a) => a.id === agentId);
        },

        getAgentsByUseCase: (useCase) => {
          return get().agents.filter((a) => a.genesisTag === useCase);
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        reset: () => {
          set(initialState);
        },
      }),
      {
        name: "omni-prime-agent-store",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          selectedAgentId: state.selectedAgentId,
          filters: state.filters,
          searchQuery: state.searchQuery,
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
 * Get filtered and sorted agents.
 */
export function useFilteredAgents(): Agent[] {
  const { agents, filters, searchQuery } = useAgentStore();

  return useMemo(() => {
    let result = [...agents];

    // Apply status filter
    if (filters.status) {
      result = result.filter((a) => a.status === filters.status);
    }

    // Apply genesis tag filter
    if (filters.genesisTag) {
      result = result.filter((a) => a.genesisTag === filters.genesisTag);
    }

    // Apply template filter
    if (filters.isTemplate !== undefined) {
      result = result.filter((a) => a.isTemplate === filters.isTemplate);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const sortBy = filters.sortBy ?? "createdAt";
      const sortOrder = filters.sortOrder ?? "desc";

      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "createdAt":
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "lastActiveAt":
          comparison =
            (a.lastActiveAt?.getTime() ?? 0) - (b.lastActiveAt?.getTime() ?? 0);
          break;
        case "totalMessages":
          comparison = a.totalMessages - b.totalMessages;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [agents, filters, searchQuery]);
}

/**
 * Get agent statistics.
 */
export function useAgentStats(): {
  total: number;
  active: number;
  paused: number;
  byUseCase: Record<string, number>;
} {
  const { agents } = useAgentStore();

  return useMemo(() => {
    const stats = {
      total: agents.length,
      active: agents.filter((a) => a.status === "active").length,
      paused: agents.filter((a) => a.status === "paused").length,
      byUseCase: {} as Record<string, number>,
    };

    for (const agent of agents) {
      const tag = agent.genesisTag ?? "uncategorized";
      stats.byUseCase[tag] = (stats.byUseCase[tag] ?? 0) + 1;
    }

    return stats;
  }, [agents]);
}
