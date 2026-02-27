// ═══════════════════════════════════════════════════════════════════════════════
// CHAT TYPES - Sessions, Messages, and Streaming
// ═══════════════════════════════════════════════════════════════════════════════

import type { Agent } from "./agent";
import type { SwarmDef } from "./swarm";
import type { ToolCall } from "./tool";

/**
 * Message role in conversation.
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * Chat session type - can be with single agent or swarm.
 */
export type ChatSessionType = "agent" | "swarm";

/**
 * Chat session entity.
 * Represents a conversation with an agent or swarm.
 */
export interface ChatSession {
  /** Unique identifier */
  id: string;

  /** Owner profile ID */
  ownerId: string;

  /** Session type indicator */
  type: ChatSessionType;

  /** Associated agent (if type is 'agent') */
  agentId: string | null;

  /** Associated swarm (if type is 'swarm') */
  swarmId: string | null;

  /** Session title (auto-generated or user-set) */
  title: string | null;

  /** Model used in this session */
  modelUsed: string | null;

  /** Message count cache */
  messageCount: number;

  /** Whether session is archived */
  isArchived: boolean;

  /** Last message timestamp */
  lastMessageAt: Date | null;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations */
  agent?: Agent | null;
  swarm?: SwarmDef | null;
}

/**
 * Message entity.
 * Individual message within a chat session.
 */
export interface Message {
  /** Unique identifier */
  id: string;

  /** Parent session ID */
  sessionId: string;

  /** Message role */
  role: MessageRole;

  /** Message content (markdown supported) */
  content: string;

  /** Agent who sent this (for assistant messages) */
  agentId: string | null;

  /** Additional metadata */
  metadata: MessageMetadata;

  /** Token counts (if available) */
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;

  /** Whether message is fully streamed/rendered */
  isComplete: boolean;

  /** Timestamp */
  createdAt: Date;

  /** Expanded relations */
  agent?: Agent | null;
  toolCalls?: ToolCall[];
}

/**
 * Message metadata structure.
 */
export interface MessageMetadata {
  /** LLM provider used */
  provider?: "ollama" | "openai" | "anthropic" | "custom";

  /** Specific model used */
  model?: string;

  /** Streaming information */
  streaming?: boolean;
  streamId?: string;

  /** Swarm handoff information */
  swarmHandoff?: {
    fromAgentId: string;
    toAgentId: string;
    reason: string;
  };

  /** Tool call indicators */
  hasToolCalls?: boolean;
  toolCallIds?: string[];

  /** User feedback */
  userRating?: "positive" | "negative" | null;
  userFeedback?: string | null;

  /** Error information */
  error?: {
    code: string;
    message: string;
  };

  /** Custom extension point */
  custom?: Record<string, unknown>;
}

/**
 * Knowledge document entity.
 * Represents a file in the knowledge base.
 */
export interface KnowledgeDoc {
  /** Unique identifier */
  id: string;

  /** Owner profile ID */
  ownerId: string;

  /** Storage filename (hashed) */
  filename: string;

  /** Original upload filename */
  originalName: string;

  /** MIME type */
  fileType: string;

  /** File size in bytes */
  fileSize: number;

  /** SHA-256 content hash */
  contentHash: string;

  /** Storage path */
  storagePath: string;

  /** Number of vector chunks */
  vectorCount: number;

  /** Chunking configuration */
  chunkSize: number | null;
  chunkOverlap: number | null;

  /** Indexing status */
  status: "pending" | "indexing" | "ready" | "error";

  /** Error message if failed */
  errorMessage: string | null;

  /** Timestamps */
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stream chunk types for SSE.
 */
export type StreamChunkType =
  | "start"
  | "content"
  | "tool_call"
  | "tool_result"
  | "handoff"
  | "error"
  | "complete"
  | "abort";

/**
 * Stream chunk for SSE responses.
 */
export interface StreamChunk {
  type: StreamChunkType;
  id: string;
  sessionId: string;
  messageId: string;

  /** Content delta (for 'content' type) */
  content?: string;

  /** Tool call info (for 'tool_call' type) */
  toolCall?: {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };

  /** Tool result (for 'tool_result' type) */
  toolResult?: {
    toolCallId: string;
    result: unknown;
    error?: string;
  };

  /** Handoff info (for 'handoff' type) */
  handoff?: {
    fromAgentId: string;
    toAgentId: string;
    fromAgentName: string;
    toAgentName: string;
    reason: string;
  };

  /** Error info (for 'error' type) */
  error?: {
    code: string;
    message: string;
  };

  /** Metadata */
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };

  /** Timestamp */
  timestamp: number;
}

/**
 * Chat session creation payload.
 */
export interface CreateSessionPayload {
  type: ChatSessionType;
  agentId?: string;
  swarmId?: string;
  title?: string;
}

/**
 * Send message payload.
 */
export interface SendMessagePayload {
  sessionId: string;
  content: string;
  attachments?: {
    type: string;
    url: string;
    name: string;
  }[];
}

/**
 * Message with UI-specific fields.
 */
export interface MessageWithUIState extends Message {
  isStreaming: boolean;
  streamingContent: string;
  showToolDetails: boolean;
}

/**
 * Session with computed fields for UI.
 */
export interface SessionWithPreview extends ChatSession {
  preview: string | null;
  unreadCount: number;
  participants: {
    id: string;
    name: string;
    avatar: string | null;
  }[];
}
