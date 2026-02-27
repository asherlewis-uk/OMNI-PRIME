// ═══════════════════════════════════════════════════════════════════════════════
// SWARM TYPES - Multi-Agent Orchestration
// ═══════════════════════════════════════════════════════════════════════════════

import type { Agent } from "./agent";
import type { Message } from "./chat";

/**
 * Swarm handoff condition types.
 */
export type HandoffCondition =
  | "always"          // Always handoff after response
  | "keyword"         // Handoff on specific keyword detection
  | "tool_required"   // Handoff when specific tool needed
  | "intent_match"    // Handoff based on intent classification
  | "custom";         // Custom LLM-evaluated condition

/**
 * Handoff rule for swarm graph edges.
 */
export interface HandoffRule {
  /** Target agent ID */
  targetAgentId: string;

  /** Target agent name (denormalized) */
  targetAgentName: string;

  /** Condition type for handoff */
  condition: HandoffCondition;

  /** Condition value (keyword, tool name, or intent) */
  conditionValue?: string;

  /** Custom prompt for LLM evaluation (for 'custom' condition) */
  customPrompt?: string;

  /** Priority (higher = evaluated first) */
  priority: number;
}

/**
 * Swarm graph node.
 * Represents an agent in the swarm topology.
 */
export interface SwarmGraphNode {
  /** Agent ID */
  agentId: string;

  /** Agent name (denormalized) */
  agentName: string;

  /** Position in visual editor (x, y coordinates) */
  position: { x: number; y: number };

  /** Outgoing handoff rules */
  handoffRules: HandoffRule[];

  /** Node metadata */
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

/**
 * Swarm definition entity.
 * Represents a configured multi-agent workflow.
 */
export interface SwarmDef {
  /** Unique identifier */
  id: string;

  /** Owner profile ID */
  ownerId: string;

  /** Swarm name */
  name: string;

  /** Description of purpose */
  description: string | null;

  /** Agent topology as directed graph */
  graph: SwarmGraphNode[];

  /** Entry point agent ID */
  entryAgentId: string | null;

  /** Maximum iterations to prevent infinite loops */
  maxIterations: number;

  /** Auto-start on session creation */
  autoStart: boolean;

  /** Usage statistics */
  totalExecutions: number;

  /** Whether swarm is active */
  isActive: boolean;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations */
  agents?: Agent[];
  entryAgent?: Agent | null;
}

/**
 * Swarm handoff event.
 * Logged when agents transfer control.
 */
export interface SwarmHandoffEvent {
  /** Timestamp */
  timestamp: number;

  /** Source agent */
  fromAgentId: string;
  fromAgentName: string;

  /** Target agent */
  toAgentId: string;
  toAgentName: string;

  /** Handoff reason */
  reason: string;

  /** Triggering message preview */
  messagePreview: string;

  /** Condition that triggered handoff */
  triggeredCondition?: HandoffCondition;
}

/**
 * Swarm execution state.
 */
export interface SwarmExecution {
  /** Swarm definition ID */
  swarmId: string;

  /** Chat session ID */
  sessionId: string;

  /** Current status */
  status: "idle" | "running" | "paused" | "completed" | "error";

  /** Currently active agent */
  currentAgentId: string | null;

  /** Current iteration count */
  iterationCount: number;

  /** Execution history */
  executionLog: SwarmHandoffEvent[];

  /** Error information */
  error?: {
    code: string;
    message: string;
    agentId?: string;
  };

  /** Start time */
  startedAt: Date | null;

  /** Completion time */
  completedAt: Date | null;
}

/**
 * Swarm execution result.
 */
export interface SwarmExecutionResult {
  success: boolean;
  sessionId: string;
  messages: Message[];
  handoffs: SwarmHandoffEvent[];
  totalIterations: number;
  executionTimeMs: number;
  error?: string;
}

/**
 * Swarm creation payload.
 */
export interface CreateSwarmPayload {
  name: string;
  description?: string;
  agentIds: string[];
  entryAgentId: string;
  handoffRules?: {
    fromAgentId: string;
    toAgentId: string;
    condition: HandoffCondition;
    conditionValue?: string;
    customPrompt?: string;
  }[];
  maxIterations?: number;
  autoStart?: boolean;
}

/**
 * Swarm update payload.
 */
export type UpdateSwarmPayload = Partial<Omit<CreateSwarmPayload, "agentIds">> & {
  agentIds?: string[];
};

/**
 * Handoff detection result.
 */
export interface HandoffDetectionResult {
  shouldHandoff: boolean;
  handoff?: {
    toAgentId: string;
    toAgentName: string;
    reason: string;
    triggeredCondition: HandoffCondition;
  };
}

/**
 * Swarm visualization node (for UI).
 */
export interface SwarmVisualizationNode {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string | null;
  x: number;
  y: number;
  isActive: boolean;
  isEntry: boolean;
  handoffCount: number;
}

/**
 * Swarm visualization edge (for UI).
 */
export interface SwarmVisualizationEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition: HandoffCondition;
  conditionValue?: string;
  isActive: boolean;
  handoffCount: number;
}

/**
 * Swarm builder state (for UI).
 */
export interface SwarmBuilderState {
  nodes: SwarmGraphNode[];
  selectedNodeId: string | null;
  selectedEdge: { from: string; to: string } | null;
  isDirty: boolean;
  errors: string[];
}

/**
 * Intent classification result.
 * Used for intent_match handoff conditions.
 */
export interface IntentClassification {
  primaryIntent: string;
  confidence: number;
  secondaryIntents: { intent: string; confidence: number }[];
  suggestedAgentId?: string;
}
