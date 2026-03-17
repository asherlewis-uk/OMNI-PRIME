// ═══════════════════════════════════════════════════════════════════════════════
// CHAT TYPES — Sessions, Messages, and Streaming
// Canonical source of truth for all Chat domain types.
// Column-level alignment: scalar fields on ChatSession/Message mirror their
// respective Drizzle tables (chat_sessions, messages).
//
// NOTE: KnowledgeDoc has been relocated to ./tool.ts to break the circular
// dependency chain (agent → chat → tool → agent). Import it from there.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Agent } from "./agent";
import type { SwarmDef } from "./swarm";
import type { ToolCall } from "./tool";

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Message role in conversation.
 * Stored in: messages.role
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/** A standard text part of a message. */
export interface TextPart {
  type: "text";
  text: string;
}

/** An image part of a message, using a URL (compatible with OpenAI). */
export interface ImageUrlPart {
  type: "image_url";
  image_url: {
    /** The URL of the image, can be a data URI (base64) or a public URL. */
    url: string;
    /** Optional detail level for the image. */
    detail?: "low" | "high" | "auto";
  };
}

/** An inline data part for media (compatible with Gemini). */
export interface InlineDataPart {
  type: "inline_data";
  inline_data: {
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    /** The base64-encoded data of the media. */
    data: string;
  };
}

/** A union of all possible content parts for a message. */
export type MessageContentPart = TextPart | ImageUrlPart | InlineDataPart;

/**
 * Chat session type — can be with single agent or swarm.
 * Derived at runtime from which FK is populated (agentId vs swarmId).
 */
export type ChatSessionType = "agent" | "swarm";

// ─── Core Entities ───────────────────────────────────────────────────────────

/**
 * Chat session entity.
 * Maps to: chat_sessions table.
 */
export interface ChatSession {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → user_profiles.id */
  ownerId: string;

  /** Derived session type indicator (not a DB column — computed from FKs) */
  type: ChatSessionType;

  /** FK → agents.id (nullable — set when type is 'agent') */
  agentId: string | null;

  /** FK → swarm_defs.id (nullable — set when type is 'swarm') */
  swarmId: string | null;

  /** Session title (auto-generated or user-set) */
  title: string | null;

  /** Model used in this session */
  modelUsed: string | null;

  /** Cached message count */
  messageCount: number;

  /** Whether session is archived */
  isArchived: boolean;

  /** Last message timestamp */
  lastMessageAt: Date | null;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations (NOT in DB row) */
  agent?: Agent | null;
  swarm?: SwarmDef | null;
}

/**
 * Message entity.
 * Maps to: messages table.
 */
export interface Message {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → chat_sessions.id */
  sessionId: string;

  /** Message role */
  role: MessageRole;

  /** Message content (markdown supported) */
  content: string | MessageContentPart[];

  /** FK → agents.id (for assistant messages — which agent authored this) */
  agentId: string | null;

  /** Additional metadata (JSON column) */
  metadata: MessageMetadata;

  /** Token counts (if available from provider) */
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;

  /** Whether message is fully streamed/rendered */
  isComplete: boolean;

  /** Timestamp */
  createdAt: Date;

  /** Expanded relations (NOT in DB row) */
  agent?: Agent | null;
  toolCalls?: ToolCall[];
}

/**
 * Message metadata structure.
 * Stored in: messages.metadata (JSON column).
 * All fields are optional — metadata grows organically during the message lifecycle.
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

  /** Attachment indicator */
  hasAttachments?: boolean;

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

// ─── SSE Streaming Types ─────────────────────────────────────────────────────

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
 * Emitted by GET/POST /api/chat/stream.
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

// ─── API Payloads ────────────────────────────────────────────────────────────

/**
 * Chat session creation payload.
 * POST /api/chat/sessions
 */
export interface CreateSessionPayload {
  type: ChatSessionType;
  agentId?: string;
  swarmId?: string;
  title?: string;
}

/**
 * Send message payload.
 * POST /api/chat/stream
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

// ─── UI / Display Types ──────────────────────────────────────────────────────

/**
 * Message with UI-specific fields.
 * Used by the chatStore Zustand store for rendering state.
 */
export interface MessageWithUIState extends Message {
  isStreaming: boolean;
  streamingContent: string;
  showToolDetails: boolean;
}

/**
 * Session with computed fields for UI.
 * Used by sidebar session list.
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
