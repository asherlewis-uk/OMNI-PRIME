// ═══════════════════════════════════════════════════════════════════════════════
// TOOL & KNOWLEDGE TYPES — MCP Tools, Servers, Execution, and Knowledge Base
// Canonical source of truth for all MCP Tool and Knowledge domain types.
// Column-level alignment: scalar fields on MCPServer, MCPTool, ToolCall, and
// KnowledgeDoc mirror their respective Drizzle tables.
//
// KnowledgeDoc lives here (not in chat.ts) to break the circular dependency:
//   agent.ts → tool.ts (MCPTool, KnowledgeDoc)
//   chat.ts  → tool.ts (ToolCall)
//   chat.ts  → swarm.ts (SwarmDef)
//   swarm.ts → chat.ts (Message)
//   swarm.ts → agent.ts (Agent)
// This ensures a strict DAG: genesis → agent → tool, chat → tool, swarm → chat.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * MCP Server transport types.
 * Stored in: mcp_servers.transport
 */
export type MCPTransportType = "stdio" | "sse" | "http";

/**
 * MCP Server connection status.
 * Stored in: mcp_servers.status
 */
export type MCPServerStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "connecting";

/**
 * Tool call execution status.
 * Stored in: tool_calls.status
 */
export type ToolCallStatus = "pending" | "running" | "completed" | "error";

/**
 * Knowledge document indexing status.
 * Stored in: knowledge_docs.status
 */
export type KnowledgeDocStatus = "pending" | "indexing" | "ready" | "error";

/**
 * Tool category for organization.
 * Derived at runtime by the ToolRegistry — not stored in DB.
 */
export type ToolCategory =
  | "filesystem"
  | "web"
  | "database"
  | "api"
  | "communication"
  | "development"
  | "data"
  | "custom";

// ─── Core Entities: MCP ──────────────────────────────────────────────────────

/**
 * MCP Server entity.
 * Maps to: mcp_servers table.
 */
export interface MCPServer {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → user_profiles.id */
  ownerId: string;

  /** Display name */
  name: string;

  /** Description of capabilities */
  description: string | null;

  /** Transport mechanism */
  transport: MCPTransportType;

  /** Command to execute (for stdio transport) */
  command: string | null;

  /** Arguments for command (for stdio transport, JSON column) */
  args: string[];

  /** URL endpoint (for sse/http transport) */
  url: string | null;

  /** Environment variables (JSON column) */
  env: Record<string, string>;

  /** Additional configuration (JSON column) */
  config: Record<string, unknown>;

  /** Current connection status */
  status: MCPServerStatus;

  /** Status message or error details */
  statusMessage: string | null;

  /** Last successful sync timestamp */
  lastSyncedAt: Date | null;

  /** Number of discovered tools */
  toolCount: number;

  /** Whether this is a built-in server */
  isBuiltIn: boolean;

  /** Whether server is enabled */
  isEnabled: boolean;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations (NOT in DB row) */
  tools?: MCPTool[];
}

/**
 * MCP Tool entity.
 * Maps to: mcp_tools table.
 */
export interface MCPTool {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → mcp_servers.id */
  serverId: string;

  /** Tool name (must be unique within server) */
  name: string;

  /** Tool description */
  description: string | null;

  /** JSON Schema for input validation (JSON column) */
  inputSchema: Record<string, unknown>;

  /** Whether this is a built-in tool */
  isBuiltIn: boolean;

  /** Whether tool is enabled */
  isEnabled: boolean;

  /** Usage statistics */
  useCount: number;
  lastUsedAt: Date | null;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Expanded relations (NOT in DB row) */
  server?: MCPServer;
}

/**
 * Tool call entity.
 * Maps to: tool_calls table.
 */
export interface ToolCall {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → messages.id */
  messageId: string;

  /** FK → mcp_tools.id (nullable — may be null for dynamically invoked tools) */
  toolId: string | null;

  /** Tool name at time of call */
  toolName: string;

  /** Arguments passed to tool (JSON column) */
  arguments: Record<string, unknown>;

  /** Execution result (JSON column, nullable) */
  result: unknown | null;

  /** Error message if failed */
  error: string | null;

  /** Execution status */
  status: ToolCallStatus;

  /** Timing */
  startedAt: Date | null;
  executedAt: Date | null;

  /** Timestamp */
  createdAt: Date;

  /** Expanded relations (NOT in DB row) */
  tool?: MCPTool | null;
}

// ─── Core Entity: Knowledge Base ─────────────────────────────────────────────

/**
 * Knowledge document entity.
 * Maps to: knowledge_docs table.
 *
 * Relocated here from chat.ts to break the circular dependency chain.
 * Imported by: agent.ts (AgentKnowledge.document), toolRegistry, knowledge routes.
 */
export interface KnowledgeDoc {
  /** PK — auto-generated UUID */
  id: string;

  /** FK → user_profiles.id */
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

  /** Storage path (OPFS or filesystem) */
  storagePath: string;

  /** Number of vector chunks generated */
  vectorCount: number;

  /** Chunking configuration */
  chunkSize: number | null;
  chunkOverlap: number | null;

  /** Indexing status */
  status: KnowledgeDocStatus;

  /** Error message if indexing failed */
  errorMessage: string | null;

  /** Timestamps */
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── LLM Gateway Types ───────────────────────────────────────────────────────

/**
 * Tool call definition from LLM response.
 * Parsed from the streaming/non-streaming LLM output before execution.
 */
export interface ToolCallDef {
  /** Tool name */
  name: string;

  /** Arguments (parsed from JSON) */
  arguments: Record<string, unknown>;
}

/**
 * Tool execution result.
 * Returned by MCPClient.callTool() and MCPServerManager.executeTool().
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

// ─── API Payloads ────────────────────────────────────────────────────────────

/**
 * MCP server creation payload.
 * POST /api/mcp/registry
 */
export interface CreateMCPServerPayload {
  name: string;
  description?: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
}

/**
 * Tool execution payload.
 * POST /api/tools/execute
 */
export interface ExecuteToolPayload {
  toolName: string;
  arguments: Record<string, unknown>;
  timeout?: number;
}

// ─── UI / Display Types ──────────────────────────────────────────────────────

/**
 * Tool with expanded server info for display.
 */
export interface ToolWithServer extends MCPTool {
  server: MCPServer;
}

/**
 * Tool registry entry.
 * Categorized tool for discovery UI.
 */
export interface ToolRegistryEntry {
  tool: MCPTool;
  category: ToolCategory;
  tags: string[];
  popularity: number;
}

/**
 * Tool capability descriptor.
 * Used for agent-tool matching in the ToolRegistry.
 */
export interface ToolCapability {
  toolId: string;
  toolName: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
}
