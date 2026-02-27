// ═══════════════════════════════════════════════════════════════════════════════
// TOOL TYPES - MCP Tools, Servers, and Execution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MCP Server transport types.
 */
export type MCPTransportType = "stdio" | "sse" | "http";

/**
 * MCP Server connection status.
 */
export type MCPServerStatus = "connected" | "disconnected" | "error" | "connecting";

/**
 * MCP Server entity.
 * Represents a Model Context Protocol server configuration.
 */
export interface MCPServer {
  /** Unique identifier */
  id: string;

  /** Owner profile ID */
  ownerId: string;

  /** Display name */
  name: string;

  /** Description of capabilities */
  description: string | null;

  /** Transport mechanism */
  transport: MCPTransportType;

  /** Command to execute (for stdio transport) */
  command: string | null;

  /** Arguments for command (for stdio transport) */
  args: string[];

  /** URL endpoint (for sse/http transport) */
  url: string | null;

  /** Environment variables */
  env: Record<string, string>;

  /** Additional configuration */
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

  /** Expanded relations */
  tools?: MCPTool[];
}

/**
 * MCP Tool entity.
 * Individual tool discovered from an MCP server.
 */
export interface MCPTool {
  /** Unique identifier */
  id: string;

  /** Parent server ID */
  serverId: string;

  /** Tool name (must be unique within server) */
  name: string;

  /** Tool description */
  description: string | null;

  /** JSON Schema for input validation */
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

  /** Expanded relations */
  server?: MCPServer;
}

/**
 * Tool call entity.
 * Represents an execution of a tool.
 */
export interface ToolCall {
  /** Unique identifier */
  id: string;

  /** Parent message ID */
  messageId: string;

  /** Tool reference (may be null if dynamic tool) */
  toolId: string | null;

  /** Tool name at time of call */
  toolName: string;

  /** Arguments passed to tool */
  arguments: Record<string, unknown>;

  /** Execution result (JSON-serializable) */
  result: unknown | null;

  /** Error message if failed */
  error: string | null;

  /** Execution status */
  status: "pending" | "running" | "completed" | "error";

  /** Timing */
  startedAt: Date | null;
  executedAt: Date | null;

  /** Timestamp */
  createdAt: Date;

  /** Expanded relations */
  tool?: MCPTool | null;
}

/**
 * Tool call definition from LLM.
 */
export interface ToolCallDef {
  /** Tool name */
  name: string;

  /** Arguments (parsed from JSON) */
  arguments: Record<string, unknown>;
}

/**
 * MCP server creation payload.
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
 */
export interface ExecuteToolPayload {
  toolName: string;
  arguments: Record<string, unknown>;
  timeout?: number;
}

/**
 * Tool execution result.
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

/**
 * Tool with expanded server info for display.
 */
export interface ToolWithServer extends MCPTool {
  server: MCPServer;
}

/**
 * Tool category for organization.
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

/**
 * Tool registry entry.
 * Categorized tool for discovery.
 */
export interface ToolRegistryEntry {
  tool: MCPTool;
  category: ToolCategory;
  tags: string[];
  popularity: number;
}

/**
 * Tool capability descriptor.
 * Used for agent-tool matching.
 */
export interface ToolCapability {
  toolId: string;
  toolName: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
}
