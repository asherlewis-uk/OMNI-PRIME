// ═══════════════════════════════════════════════════════════════════════════════
// SWARM TYPES — Multi-Agent Orchestration
// Canonical source of truth for all Swarm domain types.
// Column-level alignment: scalar fields on SwarmDef mirror the `swarm_defs`
// Drizzle table. SwarmGraphNode and HandoffRule are JSON sub-structures stored
// inside swarm_defs.graph_json and annotated via $type<> in the schema.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Agent } from "./agent";
import type { Message } from "./chat";

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Swarm handoff condition types.
 * Used by HandoffRule.condition and stored inside swarm_defs.graph_json.
 */
export type HandoffCondition =
  | "always"
  | "keyword"
  | "tool_required"
  | "intent_match"
  | "custom";

// ─── JSON Sub-Structures (stored inside swarm_defs.graph_json) ───────────────

/**
 * Handoff rule for swarm graph edges.
 * Defines when and why control transfers from one agent to another.
 * Stored as part of SwarmGraphNode inside swarm_defs.graph_json (JSON column).
 */
export interface HandoffRule {
  /** Target agent ID */
  targetAgentId: string;

  /** Target agent name (denormalized for display) */
  targetAgentName: string;

  /** Condition type for handoff */
  condition: HandoffCondition;

  /** Condition value (keyword, tool name, or intent string) */
  conditionValue?: string;

  /** Custom prompt for LLM evaluation (for 'custom' condition) */
  customPrompt?: string;

  /** Priority — higher values are evaluated first */
  priority: number;
}

/**
 * Swarm graph node.
 * Represents an agent in the swarm topology.
 * Stored as array elements inside swarm_defs.graph_json (JSON column).
 */
export interface SwarmGraphNode {
  /** FK reference → agents.id */
  agentId: string;

  /** Agent name (denormalized for display) */
  agentName: string;

  /** Position in visual editor (x, y coordinates) */
  position: { x: number; y: number };

  /** Outgoing handoff rules */
  handoffRules: HandoffRule[];

  /** Node metadata for visual editor */
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

// ─── Core Entities ───────────────────────────────────────────────────────────

/**
 * Swarm definition entity.
 * Maps to: swarm_defs table.
 */
export interface SwarmDef {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → user_profiles.id */
  ownerId: string;

  /** Swarm name */
  name: string;

  /** Description of purpose */
  description: string | null;

  /** Agent topology as directed graph (JSON column: graph_json) */
  graphJson: SwarmGraphNode[];

  /** FK → agents.id — entry point agent */
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

  /** Expanded relations (NOT in DB row) */
  agents?: Agent[];
  entryAgent?: Agent | null;
}

// ─── Execution Types ─────────────────────────────────────────────────────────

/**
 * Swarm handoff event.
 * Logged when agents transfer control during execution.
 * Stored in-memory during a swarm run and emitted via Socket.io / SSE.
 */
export interface SwarmHandoffEvent {
  /** Event timestamp */
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
 * Tracks a running swarm workflow in the SwarmEngine.
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
 * Returned after a swarm workflow completes.
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
 * Handoff detection result.
 * Returned by HandoffDetector.evaluate().
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

// ─── API Payloads ────────────────────────────────────────────────────────────

/**
 * Swarm creation payload.
 * POST /api/swarm
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
 * PATCH /api/swarm/[swarmId]
 */
export type UpdateSwarmPayload = Partial<
  Omit<CreateSwarmPayload, "agentIds">
> & {
  agentIds?: string[];
};

// ─── UI / Display Types ──────────────────────────────────────────────────────

/**
 * Swarm visualization node (for UI canvas).
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
 * Swarm visualization edge (for UI canvas).
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
 * Swarm builder state (for UI editor).
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
