// ═══════════════════════════════════════════════════════════════════════════════
// MCP CLIENT - Model Context Protocol Client Implementation
// ═══════════════════════════════════════════════════════════════════════════════

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type {
  MCPServer,
  MCPTool,
  MCPTransportType,
  ToolExecutionResult,
} from "@/types/tool";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MCP Client configuration options.
 */
export interface MCPClientOptions {
  server: MCPServer;
  timeoutMs?: number;
  requestTimeoutMs?: number;
}

/**
 * Raw tool definition from MCP server.
 */
interface RawMCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Tool call progress callback.
 */
export type ToolProgressCallback = (progress: {
  status: "started" | "in_progress" | "completed" | "error";
  message?: string;
  percentComplete?: number;
}) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// MCP CLIENT CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private server: MCPServer;
  private timeoutMs: number;
  private requestTimeoutMs: number;
  private isConnected = false;

  constructor(options: MCPClientOptions) {
    this.server = options.server;
    this.timeoutMs = options.timeoutMs ?? 30000; // Default 30s for connection
    this.requestTimeoutMs = options.requestTimeoutMs ?? 60000; // Default 60s for tool calls
  }

  /**
   * Connect to the MCP server.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      this.transport = this.createTransport(this.server.transport);

      this.client = new Client(
        {
          name: "omni-prime-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect with timeout
      await this.withTimeout(
        this.client.connect(this.transport),
        this.timeoutMs,
        `Connection to ${this.server.name} timed out`
      );

      this.isConnected = true;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    this.cleanup();
    this.isConnected = false;
  }

  /**
   * Check if client is connected.
   */
  isActive(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * List available tools from the server.
   */
  async listTools(): Promise<MCPTool[]> {
    this.ensureConnected();

    const response = await this.withTimeout(
      this.client!.listTools(),
      this.requestTimeoutMs,
      "Tool listing timed out"
    );

    return (response.tools as RawMCPTool[]).map(
      (tool): MCPTool => ({
        id: `${this.server.id}:${tool.name}`,
        serverId: this.server.id,
        name: tool.name,
        description: tool.description ?? null,
        inputSchema: tool.inputSchema,
        isBuiltIn: this.server.isBuiltIn,
        isEnabled: true,
        useCount: 0,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Call a tool on the server.
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    onProgress?: ToolProgressCallback
  ): Promise<ToolExecutionResult> {
    this.ensureConnected();

    const startTime = Date.now();

    try {
      onProgress?.({
        status: "started",
        message: `Executing ${toolName}...`,
        percentComplete: 0,
      });

      const response = await this.withTimeout(
        this.client!.callTool({
          name: toolName,
          arguments: args,
        }),
        this.requestTimeoutMs,
        `Tool execution for ${toolName} timed out`
      );

      onProgress?.({
        status: "completed",
        message: `${toolName} completed`,
        percentComplete: 100,
      });

      // Parse the result - MCP tools can return text or image content
      let result: unknown;

      if (response.content && Array.isArray(response.content)) {
        // Extract text content from the response
        const textContent = response.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n");

        const imageContent = response.content
          .filter((item) => item.type === "image")
          .map((item) => ({
            type: "image",
            data: item.data,
            mimeType: item.mimeType,
          }));

        if (imageContent.length > 0) {
          result = {
            text: textContent || undefined,
            images: imageContent,
          };
        } else {
          // Try to parse as JSON if it looks like JSON
          try {
            result = JSON.parse(textContent);
          } catch {
            result = textContent;
          }
        }
      } else {
        result = response;
      }

      return {
        success: true,
        result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      onProgress?.({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private createTransport(
    type: MCPTransportType
  ): StdioClientTransport | SSEClientTransport {
    switch (type) {
      case "stdio": {
        if (!this.server.command) {
          throw new Error("Command is required for stdio transport");
        }

        const env = {
          ...process.env,
          ...this.server.env,
        } as Record<string, string>;

        return new StdioClientTransport({
          command: this.server.command,
          args: this.server.args,
          env,
        });
      }

      case "sse":
      case "http": {
        if (!this.server.url) {
          throw new Error("URL is required for SSE/HTTP transport");
        }

        return new SSEClientTransport(new URL(this.server.url));
      }

      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new Error("MCP client is not connected");
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }

  private cleanup(): void {
    try {
      this.transport?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.transport = null;
    this.client = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an MCP client for a server configuration.
 */
export function createMCPClient(
  server: MCPServer,
  options?: Omit<MCPClientOptions, "server">
): MCPClient {
  return new MCPClient({
    server,
    ...options,
  });
}
