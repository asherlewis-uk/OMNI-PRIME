// ═══════════════════════════════════════════════════════════════════════════════
// AGENT TYPES - Agent Definitions, Tools, and Knowledge
// ═══════════════════════════════════════════════════════════════════════════════

import type { UseCaseType } from "./genesis";
import type { MCPTool } from "./tool";
import type { KnowledgeDoc } from "./chat";

/**
 * Agent operational status.
 */
export type AgentStatus = "active" | "paused" | "error" | "archived";

/**
 * Core Agent entity.
 * Represents an AI persona with configuration and capabilities.
 */
export interface Agent {
  /** Unique identifier */
  id: string;

  /** Owner profile ID */
  ownerId: string;

  /** Display name */
  name: string;

  /** Avatar - URL, emoji, or data URI */
  avatar: string | null;

  /** Short description of the agent's purpose */
  description: string | null;

  /** System prompt that defines personality and behavior */
  systemPrompt: string;

  /** Creativity/randomness (0.0 - 1.0) */
  temperature: number;

  /** Preferred LLM (e.g., "ollama/llama3.1", "openai/gpt-4") */
  modelPreference: string;

  /** Voice ID for TTS (optional) */
  voiceId: string | null;

  /** Current operational status */
  status: AgentStatus;

  /** Whether this is a built-in template */
  isTemplate: boolean;

  /** Use case tag for template organization */
  genesisTag: UseCaseType | null;

  /** Reference to parent template if spawned from one */
  templateId: string | null;

  /** Usage statistics */
  totalConversations: number;
  totalMessages: number;
  lastActiveAt: Date | null;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations (not in DB schema) */
  tools?: AgentTool[];
  knowledge?: AgentKnowledge[];
}

/**
 * Agent-Tool assignment.
 * Links an agent to an MCP tool with optional configuration.
 */
export interface AgentTool {
  id: string;
  agentId: string;
  toolId: string;

  /** Tool configuration (API keys, defaults, etc.) */
  config: Record<string, unknown>;

  /** Whether this tool is enabled for the agent */
  isEnabled: boolean;

  /** Expanded relation */
  tool?: MCPTool;

  createdAt: Date;
}

/**
 * Agent-Knowledge assignment.
 * Links an agent to a knowledge document.
 */
export interface AgentKnowledge {
  id: string;
  agentId: string;
  docId: string;

  /** Relevance score for ranking (optional) */
  relevanceScore: number | null;

  /** Custom metadata for this link */
  customMetadata: Record<string, unknown>;

  /** Expanded relation */
  document?: KnowledgeDoc;

  createdAt: Date;
}

/**
 * Agent creation payload.
 */
export interface CreateAgentPayload {
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt: string;
  temperature?: number;
  modelPreference?: string;
  voiceId?: string;
  toolIds?: string[];
  knowledgeDocIds?: string[];
}

/**
 * Agent update payload (partial).
 */
export type UpdateAgentPayload = Partial<Omit<CreateAgentPayload, "toolIds" | "knowledgeDocIds">> & {
  toolIds?: string[];
  knowledgeDocIds?: string[];
};

/**
 * Agent with computed/expanded fields for UI display.
 */
export interface AgentWithDetails extends Agent {
  enabledTools: MCPTool[];
  knowledgeDocs: KnowledgeDoc[];
  recentSessions: {
    id: string;
    title: string | null;
    lastMessageAt: Date | null;
    messageCount: number;
  }[];
}

/**
 * Agent execution context.
 * Passed to the AI Gateway when running an agent.
 */
export interface AgentExecutionContext {
  agent: Agent;
  sessionId: string;
  messageHistory: {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    metadata?: Record<string, unknown>;
  }[];
  availableTools: MCPTool[];
  knowledgeContext?: string;
}

/**
 * Agent execution result.
 */
export interface AgentExecutionResult {
  content: string;
  toolCalls?: {
    toolName: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
  }[];
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  modelUsed: string;
  provider: string;
  executionTimeMs: number;
}

/**
 * Agent filter options for listing.
 */
export interface AgentFilterOptions {
  status?: AgentStatus;
  genesisTag?: UseCaseType;
  isTemplate?: boolean;
  searchQuery?: string;
  sortBy: "name" | "createdAt" | "lastActiveAt" | "totalMessages";
  sortOrder: "asc" | "desc";
}

/**
 * Agent list response.
 */
export interface AgentListResponse {
  agents: Agent[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}
