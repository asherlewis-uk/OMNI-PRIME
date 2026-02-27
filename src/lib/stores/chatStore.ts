// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE — Zustand State Management for Chat Sessions
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ChatSession,
  ChatSessionType,
  Message,
  MessageWithUIState,
  CreateSessionPayload,
  SendMessagePayload,
  StreamChunk,
} from "@/types/chat";
import type { Agent } from "@/types/agent";
import type { SwarmDef } from "@/types/swarm";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Active stream state.
 */
interface StreamState {
  isStreaming: boolean;
  messageId: string | null;
  sessionId: string | null;
  error: string | null;
}

let _abortController: AbortController | null = null;

/**
 * Chat store state.
 */
interface ChatState {
  // Data
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, MessageWithUIState[]>; // sessionId -> messages

  // UI State
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;

  // Streaming
  stream: StreamState;

  // Input
  inputValue: string;
  isInputFocused: boolean;
  attachments: File[];

  // Expanded states
  expandedToolCalls: string[];
}

/**
 * Chat store actions.
 */
interface ChatActions {
  // Data Actions
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  removeSession: (sessionId: string) => void;

  // Session Selection
  selectSession: (sessionId: string | null) => void;
  createSession: (payload: CreateSessionPayload) => Promise<ChatSession | null>;
  archiveSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  // Message Actions
  fetchMessages: (sessionId: string) => Promise<void>;
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: MessageWithUIState) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updates: Partial<MessageWithUIState>,
  ) => void;
  appendMessageContent: (
    sessionId: string,
    messageId: string,
    content: string,
  ) => void;
  clearMessages: (sessionId: string) => void;

  // Input Actions
  setInputValue: (value: string) => void;
  setInputFocused: (focused: boolean) => void;
  addAttachment: (file: File) => void;
  removeAttachment: (file: File) => void;
  clearAttachments: () => void;

  // Send Message
  sendMessage: (payload: SendMessagePayload) => Promise<void>;
  abortStream: () => void;

  // Stream Handling
  handleStreamChunk: (chunk: StreamChunk) => void;
  startStream: (sessionId: string, messageId: string) => void;
  endStream: () => void;

  // Tool Call UI
  toggleToolCallExpanded: (toolCallId: string) => void;
  isToolCallExpanded: (toolCallId: string) => boolean;

  // Utility
  getSessionById: (sessionId: string) => ChatSession | undefined;
  getCurrentSession: () => ChatSession | null;
  getCurrentMessages: () => MessageWithUIState[];
  getMessageById: (
    sessionId: string,
    messageId: string,
  ) => MessageWithUIState | undefined;
  clearError: () => void;
  reset: () => void;
}

/**
 * Combined chat store type.
 */
export type ChatStore = ChatState & ChatActions;

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialStreamState: StreamState = {
  isStreaming: false,
  messageId: null,
  sessionId: null,
  error: null,
};

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  messages: {},
  isLoadingSessions: false,
  isLoadingMessages: false,
  isSending: false,
  error: null,
  stream: initialStreamState,
  inputValue: "",
  isInputFocused: false,
  attachments: [],
  expandedToolCalls: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// STORE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

export const useChatStore = create<ChatStore>()(
  immer(
    persist(
      (set, get) => ({
        ...initialState,

        // ═══════════════════════════════════════════════════════════════════════
        // DATA ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        setSessions: (sessions) => {
          set((state) => {
            state.sessions = sessions;
          });
        },

        addSession: (session) => {
          set((state) => {
            state.sessions.unshift(session);
          });
        },

        updateSession: (sessionId, updates) => {
          set((state) => {
            const index = state.sessions.findIndex((s) => s.id === sessionId);
            if (index !== -1) {
              state.sessions[index] = {
                ...state.sessions[index],
                ...updates,
              } as ChatSession;
            }
          });
        },

        removeSession: (sessionId) => {
          set((state) => {
            state.sessions = state.sessions.filter((s) => s.id !== sessionId);
            delete state.messages[sessionId];

            if (state.currentSessionId === sessionId) {
              state.currentSessionId = null;
            }
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // SESSION SELECTION
        // ═══════════════════════════════════════════════════════════════════════

        selectSession: (sessionId) => {
          set((state) => {
            state.currentSessionId = sessionId;
          });

          if (sessionId) {
            get().fetchMessages(sessionId);
          }
        },

        createSession: async (payload) => {
          set((state) => {
            state.isLoadingSessions = true;
            state.error = null;
          });

          try {
            const response = await fetch("/api/chat/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              throw new Error("Failed to create session");
            }

            const data = (await response.json()) as { session: ChatSession };
            set((state) => {
              state.sessions.unshift(data.session);
              state.currentSessionId = data.session.id;
              state.messages[data.session.id] = [];
              state.isLoadingSessions = false;
            });

            return data.session;
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
              state.isLoadingSessions = false;
            });
            return null;
          }
        },

        archiveSession: async (sessionId) => {
          try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isArchived: true }),
            });

            if (!response.ok) {
              throw new Error("Failed to archive session");
            }

            set((state) => {
              const index = state.sessions.findIndex((s) => s.id === sessionId);
              const session = state.sessions[index];
              if (session) {
                session.isArchived = true;
              }
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
            });
          }
        },

        deleteSession: async (sessionId) => {
          try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, {
              method: "DELETE",
            });

            if (!response.ok) {
              throw new Error("Failed to delete session");
            }

            get().removeSession(sessionId);
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "Unknown error";
            });
          }
        },

        // ═══════════════════════════════════════════════════════════════════════
        // ASYNC MESSAGE ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        fetchMessages: async (sessionId: string) => {
          set((state) => {
            state.isLoadingMessages = true;
          });

          try {
            const response = await fetch(
              `/api/chat/sessions/${sessionId}/messages`,
            );
            if (!response.ok) {
              throw new Error("Failed to fetch messages");
            }

            const data = (await response.json()) as { messages: Message[] };
            get().setMessages(sessionId, data.messages);
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error
                  ? error.message
                  : "Failed to load messages";
            });
          } finally {
            set((state) => {
              state.isLoadingMessages = false;
            });
          }
        },

        setMessages: (sessionId, messages) => {
          const messagesWithUI: MessageWithUIState[] = messages.map((m) => ({
            ...m,
            isStreaming: false,
            streamingContent: "",
            showToolDetails: false,
          }));

          set((state) => {
            state.messages[sessionId] = messagesWithUI;
          });
        },

        addMessage: (sessionId, message) => {
          set((state) => {
            if (!state.messages[sessionId]) {
              state.messages[sessionId] = [];
            }
            state.messages[sessionId].push(message);
          });
        },

        updateMessage: (sessionId, messageId, updates) => {
          set((state) => {
            const sessionMessages = state.messages[sessionId];
            if (!sessionMessages) return;

            const index = sessionMessages.findIndex((m) => m.id === messageId);
            if (index !== -1) {
              sessionMessages[index] = {
                ...sessionMessages[index],
                ...updates,
              } as MessageWithUIState;
            }
          });
        },

        appendMessageContent: (sessionId, messageId, content) => {
          set((state) => {
            const sessionMessages = state.messages[sessionId];
            if (!sessionMessages) return;

            const index = sessionMessages.findIndex((m) => m.id === messageId);
            const message = sessionMessages[index];
            if (message) {
              message.streamingContent += content;
              message.content += content;
            }
          });
        },

        clearMessages: (sessionId) => {
          set((state) => {
            state.messages[sessionId] = [];
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // INPUT ACTIONS
        // ═══════════════════════════════════════════════════════════════════════

        setInputValue: (value) => {
          set((state) => {
            state.inputValue = value;
          });
        },

        setInputFocused: (focused) => {
          set((state) => {
            state.isInputFocused = focused;
          });
        },

        addAttachment: (file) => {
          set((state) => {
            state.attachments.push(file);
          });
        },

        removeAttachment: (file) => {
          set((state) => {
            state.attachments = state.attachments.filter((f) => f !== file);
          });
        },

        clearAttachments: () => {
          set((state) => {
            state.attachments = [];
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // SEND MESSAGE
        // ═══════════════════════════════════════════════════════════════════════

        sendMessage: async (payload) => {
          const { currentSessionId, inputValue, attachments } = get();

          if (!currentSessionId && !payload.sessionId) {
            set((state) => {
              state.error = "No active session";
            });
            return;
          }

          const sessionId = payload.sessionId ?? currentSessionId!;
          const content = payload.content ?? inputValue;

          if (!content.trim() && attachments.length === 0) {
            return;
          }

          set((state) => {
            state.isSending = true;
            state.error = null;
          });

          // Add user message optimistically
          const userMessage: MessageWithUIState = {
            id: `temp-${Date.now()}`,
            sessionId,
            role: "user",
            content,
            agentId: null,
            metadata: {
              hasAttachments: attachments.length > 0,
            },
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            isComplete: true,
            createdAt: new Date(),
            isStreaming: false,
            streamingContent: "",
            showToolDetails: false,
          };

          get().addMessage(sessionId, userMessage);
          get().setInputValue("");
          get().clearAttachments();

          // Create abort controller for cancellation
          _abortController = new AbortController();

          try {
            // Start streaming
            const response = await fetch("/api/chat/stream", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                content,
                attachments: payload.attachments,
              }),
              signal: _abortController.signal,
            });

            if (!response.ok) {
              throw new Error("Failed to send message");
            }

            // Handle SSE stream
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;

                try {
                  const chunk = JSON.parse(line.slice(6)) as StreamChunk;
                  get().handleStreamChunk(chunk);
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              // User cancelled
            } else {
              set((state) => {
                state.error =
                  error instanceof Error ? error.message : "Unknown error";
              });
            }
          } finally {
            _abortController = null;
            set((state) => {
              state.isSending = false;
              state.stream = { ...initialStreamState };
            });
          }
        },

        abortStream: () => {
          _abortController?.abort();
          _abortController = null;
        },

        // ═══════════════════════════════════════════════════════════════════════
        // STREAM HANDLING
        // ═══════════════════════════════════════════════════════════════════════

        handleStreamChunk: (chunk) => {
          switch (chunk.type) {
            case "start":
              get().startStream(chunk.sessionId, chunk.messageId);
              break;

            case "content":
              if (chunk.content) {
                get().appendMessageContent(
                  chunk.sessionId,
                  chunk.messageId,
                  chunk.content,
                );
              }
              break;

            case "tool_call":
              if (chunk.toolCall) {
                set((state) => {
                  const msgs = state.messages[chunk.sessionId];
                  const msg = msgs?.find((m) => m.id === chunk.messageId);
                  if (msg) {
                    if (!msg.metadata.hasToolCalls) {
                      msg.metadata.hasToolCalls = true;
                      msg.metadata.toolCallIds = [];
                    }
                    msg.metadata.toolCallIds?.push(chunk.toolCall!.id);
                    msg.showToolDetails = true;
                  }
                });
              }
              break;

            case "tool_result":
              if (chunk.toolResult) {
                set((state) => {
                  const msgs = state.messages[chunk.sessionId];
                  const msg = msgs?.find((m) => m.id === chunk.messageId);
                  if (msg) {
                    msg.metadata.custom = {
                      ...msg.metadata.custom,
                      [`toolResult_${chunk.toolResult!.toolCallId}`]:
                        chunk.toolResult,
                    };
                  }
                });
              }
              break;

            case "handoff":
              if (chunk.handoff) {
                set((state) => {
                  const msgs = state.messages[chunk.sessionId];
                  if (msgs) {
                    msgs.push({
                      id: `handoff-${Date.now()}`,
                      sessionId: chunk.sessionId,
                      role: "system",
                      content: `[Handoff: ${chunk.handoff!.fromAgentName} \u2192 ${chunk.handoff!.toAgentName}] ${chunk.handoff!.reason}`,
                      agentId: null,
                      metadata: { swarmHandoff: chunk.handoff },
                      promptTokens: null,
                      completionTokens: null,
                      totalTokens: null,
                      isComplete: true,
                      createdAt: new Date(),
                      isStreaming: false,
                      streamingContent: "",
                      showToolDetails: false,
                    });
                  }
                });
              }
              break;

            case "error":
              set((state) => {
                state.stream.error = chunk.error?.message ?? "Stream error";
              });
              break;

            case "complete":
              get().endStream();
              break;
          }
        },

        startStream: (sessionId, messageId) => {
          set((state) => {
            state.stream.isStreaming = true;
            state.stream.sessionId = sessionId;
            state.stream.messageId = messageId;
            state.stream.error = null;

            // Add placeholder message for assistant
            if (!state.messages[sessionId]) {
              state.messages[sessionId] = [];
            }

            const existingIndex = state.messages[sessionId].findIndex(
              (m) => m.id === messageId,
            );

            if (existingIndex === -1) {
              state.messages[sessionId].push({
                id: messageId,
                sessionId,
                role: "assistant",
                content: "",
                agentId: null,
                metadata: {},
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
                isComplete: false,
                createdAt: new Date(),
                isStreaming: true,
                streamingContent: "",
                showToolDetails: false,
              });
            }
          });
        },

        endStream: () => {
          set((state) => {
            const { sessionId, messageId } = state.stream;
            if (sessionId && messageId) {
              const sessionMessages = state.messages[sessionId];
              const message = sessionMessages?.find((m) => m.id === messageId);
              if (message) {
                message.isComplete = true;
                message.isStreaming = false;
              }
            }
            state.stream = { ...initialStreamState };
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // TOOL CALL UI
        // ═══════════════════════════════════════════════════════════════════════

        toggleToolCallExpanded: (toolCallId) => {
          set((state) => {
            const index = state.expandedToolCalls.indexOf(toolCallId);
            if (index === -1) {
              state.expandedToolCalls.push(toolCallId);
            } else {
              state.expandedToolCalls.splice(index, 1);
            }
          });
        },

        isToolCallExpanded: (toolCallId) => {
          return get().expandedToolCalls.includes(toolCallId);
        },

        // ═══════════════════════════════════════════════════════════════════════
        // UTILITY
        // ═══════════════════════════════════════════════════════════════════════

        getSessionById: (sessionId) => {
          return get().sessions.find((s) => s.id === sessionId);
        },

        getCurrentSession: () => {
          const { currentSessionId, sessions } = get();
          if (!currentSessionId) return null;
          return sessions.find((s) => s.id === currentSessionId) ?? null;
        },

        getCurrentMessages: () => {
          const { currentSessionId, messages } = get();
          if (!currentSessionId) return [];
          return messages[currentSessionId] ?? [];
        },

        getMessageById: (sessionId, messageId) => {
          return get().messages[sessionId]?.find((m) => m.id === messageId);
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
        name: "omni-prime-chat-store",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          sessions: state.sessions,
          currentSessionId: state.currentSessionId,
        }),
      },
    ),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get active (non-archived) sessions sorted by last message.
 */
export function useActiveSessions(): ChatSession[] {
  const { sessions } = useChatStore();

  return useMemo(() => {
    return sessions
      .filter((s) => !s.isArchived)
      .sort(
        (a, b) =>
          (b.lastMessageAt?.getTime() ?? b.createdAt.getTime()) -
          (a.lastMessageAt?.getTime() ?? a.createdAt.getTime()),
      );
  }, [sessions]);
}

/**
 * Get archived sessions.
 */
export function useArchivedSessions(): ChatSession[] {
  const { sessions } = useChatStore();

  return useMemo(() => {
    return sessions
      .filter((s) => s.isArchived)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [sessions]);
}

/**
 * Check if there's an active stream.
 */
export function useIsStreaming(): boolean {
  return useChatStore((state) => state.stream.isStreaming);
}

/**
 * Get streaming progress (approximate).
 */
export function useStreamProgress(): {
  isStreaming: boolean;
  messageId: string | null;
  error: string | null;
} {
  const { stream } = useChatStore();

  return useMemo(() => {
    return {
      isStreaming: stream.isStreaming,
      messageId: stream.messageId,
      error: stream.error,
    };
  }, [stream]);
}
