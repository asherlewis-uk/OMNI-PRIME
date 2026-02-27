// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVER MANAGER - Lifecycle Management with Sandboxing
// ═══════════════════════════════════════════════════════════════════════════════

import { MCPClient } from "./MCPClient";
import type {
  MCPServer,
  MCPTool,
  MCPServerStatus,
  CreateMCPServerPayload,
} from "@/types/tool";
import { getDB } from "@/lib/db/client";
import { mcpServers, mcpTools } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sandbox configuration for tool execution.
 */
export interface MCPSandboxConfig {
  /** Maximum execution time for any tool call (ms) */
  maxExecutionTimeMs: number;

  /** Maximum memory usage (bytes) - advisory only */
  maxMemoryBytes?: number;

  /** Allowed domains for HTTP requests */
  allowedDomains?: string[];

  /** Network access enabled */
  networkEnabled: boolean;

  /** File system scope restriction */
  fileSystemScope?: string;

  /** Maximum tool calls per session */
  maxToolCallsPerSession?: number;
}

/**
 * Server connection entry.
 */
interface ServerConnection {
  server: MCPServer;
  client: MCPClient;
  lastUsedAt: Date;
  toolCallCount: number;
  sandbox: MCPSandboxConfig;
}

/**
 * Server manager options.
 */
export interface ServerManagerOptions {
  /** Default sandbox configuration */
  defaultSandbox?: Partial<MCPSandboxConfig>;

  /** Connection timeout (ms) */
  connectionTimeoutMs?: number;

  /** Idle connection cleanup interval (ms) */
  cleanupIntervalMs?: number;

  /** Maximum idle time before disconnect (ms) */
  maxIdleTimeMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SANDBOX CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SANDBOX: MCPSandboxConfig = {
  maxExecutionTimeMs: 60000, // 60 seconds
  maxMemoryBytes: 512 * 1024 * 1024, // 512MB
  networkEnabled: false,
  maxToolCallsPerSession: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVER MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class MCPServerManager {
  private connections: Map<string, ServerConnection> = new Map();
  private defaultSandbox: MCPSandboxConfig;
  private connectionTimeoutMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxIdleTimeMs: number;

  constructor(options: ServerManagerOptions = {}) {
    this.defaultSandbox = {
      ...DEFAULT_SANDBOX,
      ...options.defaultSandbox,
    };
    this.connectionTimeoutMs = options.connectionTimeoutMs ?? 30000;
    this.maxIdleTimeMs = options.maxIdleTimeMs ?? 5 * 60 * 1000; // 5 minutes

    // Start cleanup interval
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // 1 minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, cleanupIntervalMs);
  }

  /**
   * Dispose of the manager and cleanup all connections.
   */
  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all servers
    await Promise.all(
      Array.from(this.connections.values()).map((conn) =>
        conn.client.disconnect()
      )
    );

    this.connections.clear();
  }

  /**
   * Connect to an MCP server.
   */
  async connectServer(server: MCPServer): Promise<MCPServerStatus> {
    // Check if already connected
    const existing = this.connections.get(server.id);
    if (existing) {
      existing.lastUsedAt = new Date();
      return "connected";
    }

    // Build sandbox config from server settings
    const sandbox: MCPSandboxConfig = {
      ...this.defaultSandbox,
      ...((server.config?.sandbox as Partial<MCPSandboxConfig>) ?? {}),
    };

    try {
      // Create and connect client
      const client = new MCPClient({
        server,
        timeoutMs: this.connectionTimeoutMs,
        requestTimeoutMs: sandbox.maxExecutionTimeMs,
      });

      await client.connect();

      // Store connection
      this.connections.set(server.id, {
        server,
        client,
        lastUsedAt: new Date(),
        toolCallCount: 0,
        sandbox,
      });

      // Update server status in database
      await this.updateServerStatus(server.id, "connected");

      // Sync tools from server
      await this.syncServerTools(server.id);

      return "connected";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";

      await this.updateServerStatus(server.id, "error", errorMessage);

      return "error";
    }
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.client.disconnect();
      this.connections.delete(serverId);
    }

    await this.updateServerStatus(serverId, "disconnected");
  }

  /**
   * Get a connected client for a server.
   */
  async getClient(serverId: string): Promise<MCPClient | null> {
    let connection = this.connections.get(serverId);

    if (!connection) {
      // Try to connect if not connected
      const db = getDB();
      const server = await db.query.mcpServers.findFirst({
        where: eq(mcpServers.id, serverId),
      });

      if (!server) {
        return null;
      }

      const status = await this.connectServer(server);
      if (status !== "connected") {
        return null;
      }

      connection = this.connections.get(serverId);
    }

    if (connection) {
      connection.lastUsedAt = new Date();
      return connection.client;
    }

    return null;
  }

  /**
   * Execute a tool with sandboxing.
   */
  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    onProgress?: (progress: {
      status: "started" | "in_progress" | "completed" | "error";
      message?: string;
      percentComplete?: number;
    }) => void
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    executionTimeMs: number;
  }> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      return {
        success: false,
        error: `Server ${serverId} is not connected`,
        executionTimeMs: 0,
      };
    }

    // Enforce sandbox limits
    if (connection.sandbox.maxToolCallsPerSession) {
      if (connection.toolCallCount >= connection.sandbox.maxToolCallsPerSession) {
        return {
          success: false,
          error: `Tool call limit exceeded (${connection.sandbox.maxToolCallsPerSession} calls per session)`,
          executionTimeMs: 0,
        };
      }
    }

    // Check domain restrictions for URL-containing args
    if (!connection.sandbox.networkEnabled) {
      const hasUrl = Object.values(args).some(
        (value) =>
          typeof value === "string" &&
          (value.startsWith("http://") || value.startsWith("https://"))
      );

      if (hasUrl) {
        return {
          success: false,
          error: "Network access is disabled for this server",
          executionTimeMs: 0,
        };
      }
    }

    // Check specific domain allowlist
    if (connection.sandbox.allowedDomains && connection.sandbox.allowedDomains.length > 0) {
      for (const value of Object.values(args)) {
        if (typeof value === "string" && value.startsWith("http")) {
          try {
            const url = new URL(value);
            if (!connection.sandbox.allowedDomains.includes(url.hostname)) {
              return {
                success: false,
                error: `Domain ${url.hostname} is not in the allowed list`,
                executionTimeMs: 0,
              };
            }
          } catch {
            // Not a valid URL, ignore
          }
        }
      }
    }

    // Execute with timeout enforcement
    const startTime = Date.now();
    const timeoutMs = connection.sandbox.maxExecutionTimeMs;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      );

      const executionPromise = connection.client.callTool(
        toolName,
        args,
        onProgress
      );

      const result = await Promise.race([executionPromise, timeoutPromise]);

      connection.toolCallCount++;
      connection.lastUsedAt = new Date();

      return {
        success: result.success,
        result: result.result,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Tool execution failed";

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync tools from a server to the database.
   */
  async syncServerTools(serverId: string): Promise<MCPTool[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    try {
      const tools = await connection.client.listTools();
      const db = getDB();

      // Get existing tools for this server
      const existingTools = await db.query.mcpTools.findMany({
        where: eq(mcpTools.serverId, serverId),
      });

      const existingNames = new Set(existingTools.map((t) => t.name));

      // Insert new tools
      for (const tool of tools) {
        if (!existingNames.has(tool.name)) {
          await db.insert(mcpTools).values({
            serverId,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            isEnabled: true,
            isBuiltIn: connection.server.isBuiltIn,
          });
        }
      }

      // Update tool count
      await db
        .update(mcpServers)
        .set({
          toolCount: tools.length,
          lastSyncedAt: new Date(),
        })
        .where(eq(mcpServers.id, serverId));

      return tools;
    } catch (error) {
      console.error(`Failed to sync tools for server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection status for a server.
   */
  getConnectionStatus(serverId: string): MCPServerStatus {
    const connection = this.connections.get(serverId);
    return connection ? "connected" : "disconnected";
  }

  /**
   * Get all connected servers.
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Update sandbox configuration for a connection.
   */
  updateSandboxConfig(
    serverId: string,
    config: Partial<MCPSandboxConfig>
  ): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.sandbox = {
        ...connection.sandbox,
        ...config,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private async updateServerStatus(
    serverId: string,
    status: MCPServerStatus,
    message?: string
  ): Promise<void> {
    try {
      const db = getDB();
      await db
        .update(mcpServers)
        .set({
          status,
          statusMessage: message ?? null,
        })
        .where(eq(mcpServers.id, serverId));
    } catch (error) {
      console.error("Failed to update server status:", error);
    }
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const toDisconnect: string[] = [];

    for (const [serverId, connection] of this.connections.entries()) {
      const idleTime = now - connection.lastUsedAt.getTime();

      if (idleTime > this.maxIdleTimeMs) {
        toDisconnect.push(serverId);
      }
    }

    for (const serverId of toDisconnect) {
      console.log(`Disconnecting idle server: ${serverId}`);
      await this.disconnectServer(serverId);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const mcpServerManager = new MCPServerManager({
  defaultSandbox: {
    maxExecutionTimeMs: 60000,
    networkEnabled: false,
  },
  maxIdleTimeMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 60000, // 1 minute
});
