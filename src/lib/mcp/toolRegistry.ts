// ═══════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY - Aggregated Tool Discovery and Management
// ═══════════════════════════════════════════════════════════════════════════════

import { getDB } from "@/lib/db/client";
import { mcpTools, mcpServers } from "@/lib/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import type {
  MCPTool,
  ToolRegistryEntry,
  ToolCategory,
  ToolCapability,
} from "@/types/tool";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tool filter options.
 */
export interface ToolFilterOptions {
  searchQuery?: string;
  category?: ToolCategory;
  serverId?: string;
  isEnabled?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Tool list result.
 */
export interface ToolListResult {
  tools: MCPTool[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Tool assignment for agent.
 */
export interface AgentToolAssignment {
  toolId: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CATEGORIZATION MAP
// ═══════════════════════════════════════════════════════════════════════════════

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Filesystem
  read_file: "filesystem",
  write_file: "filesystem",
  list_directory: "filesystem",
  search_files: "filesystem",
  filesystem: "filesystem",

  // Web
  fetch: "web",
  web_search: "web",
  brave_search: "web",
  http_request: "web",

  // Database
  query: "database",
  execute_sql: "database",
  sqlite: "database",
  database: "database",

  // API
  api_call: "api",
  rest_api: "api",
  graphql: "api",

  // Communication
  send_message: "communication",
  email: "communication",
  slack: "communication",

  // Development
  run_command: "development",
  execute_code: "development",
  github: "development",
  git: "development",
  npm: "development",

  // Data
  parse_csv: "data",
  parse_json: "data",
  analyze_data: "data",
  chart: "data",
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ToolRegistry {
  private cache: Map<string, MCPTool> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get all tools with optional filtering.
   */
  async getTools(options: ToolFilterOptions = {}): Promise<ToolListResult> {
    const db = getDB();
    const { searchQuery, category, serverId, isEnabled, limit = 50, offset = 0 } = options;

    // Build query conditions
    const conditions = [];

    if (serverId) {
      conditions.push(eq(mcpTools.serverId, serverId));
    }

    if (isEnabled !== undefined) {
      conditions.push(eq(mcpTools.isEnabled, isEnabled));
    }

    if (searchQuery) {
      conditions.push(
        sql`(${mcpTools.name} LIKE ${`%${searchQuery}%`} OR ${mcpTools.description} LIKE ${`%${searchQuery}%`})`
      );
    }

    // Execute query with relations
    const query = db.query.mcpTools.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        server: true,
      },
      limit,
      offset,
      orderBy: [sql`${mcpTools.useCount} DESC`],
    });

    const tools = await query;

    // Filter by category if specified (post-query since it's derived)
    let filteredTools = tools;
    if (category) {
      filteredTools = tools.filter((t) => this.categorizeTool(t) === category);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(mcpTools)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const totalCount = Number(countResult[0]?.count ?? 0);

    return {
      tools: filteredTools as MCPTool[],
      totalCount,
      hasMore: offset + filteredTools.length < totalCount,
    };
  }

  /**
   * Get a single tool by ID.
   */
  async getTool(toolId: string): Promise<MCPTool | null> {
    // Check cache first
    const cached = this.cache.get(toolId);
    if (cached && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return cached;
    }

    const db = getDB();
    const tool = await db.query.mcpTools.findFirst({
      where: eq(mcpTools.id, toolId),
      with: {
        server: true,
      },
    });

    if (tool) {
      this.cache.set(toolId, tool as MCPTool);
      this.cacheTimestamp = Date.now();
    }

    return (tool as MCPTool) ?? null;
  }

  /**
   * Get tools by IDs.
   */
  async getToolsByIds(toolIds: string[]): Promise<MCPTool[]> {
    if (toolIds.length === 0) return [];

    const db = getDB();
    const tools = await db.query.mcpTools.findMany({
      where: sql`${mcpTools.id} IN ${toolIds}`,
      with: {
        server: true,
      },
    });

    return tools as MCPTool[];
  }

  /**
   * Get tools for a specific agent.
   */
  async getAgentTools(agentId: string): Promise<MCPTool[]> {
    const db = getDB();

    const agentTools = await db.query.agentTools.findMany({
      where: and(
        eq(sql`agent_id`, agentId),
        eq(sql`is_enabled`, true)
      ),
      with: {
        tool: {
          with: {
            server: true,
          },
        },
      },
    });

    return agentTools
      .map((at) => at.tool)
      .filter((t): t is MCPTool => t !== null);
  }

  /**
   * Convert MCP tools to AI Gateway tool format.
   */
  convertToGatewayTools(tools: MCPTool[]): {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[] {
    return tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description ?? `Execute ${tool.name}`,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Categorize a tool based on its name and description.
   */
  categorizeTool(tool: MCPTool): ToolCategory {
    const name = tool.name.toLowerCase();
    const description = (tool.description ?? "").toLowerCase();

    // Check direct name mapping
    if (TOOL_CATEGORIES[name]) {
      return TOOL_CATEGORIES[name];
    }

    // Check for partial matches
    for (const [key, category] of Object.entries(TOOL_CATEGORIES)) {
      if (name.includes(key) || description.includes(key)) {
        return category;
      }
    }

    // Check server-based categorization
    const serverName = tool.server?.name.toLowerCase() ?? "";
    if (serverName.includes("filesystem")) return "filesystem";
    if (serverName.includes("web") || serverName.includes("search")) return "web";
    if (serverName.includes("sqlite") || serverName.includes("database")) return "database";
    if (serverName.includes("github")) return "development";

    return "custom";
  }

  /**
   * Get categorized tool registry.
   */
  async getCategorizedTools(): Promise<Record<ToolCategory, ToolRegistryEntry[]>> {
    const { tools } = await this.getTools({ isEnabled: true, limit: 1000 });

    const categorized: Record<ToolCategory, ToolRegistryEntry[]> = {
      filesystem: [],
      web: [],
      database: [],
      api: [],
      communication: [],
      development: [],
      data: [],
      custom: [],
    };

    for (const tool of tools) {
      const category = this.categorizeTool(tool);
      categorized[category].push({
        tool,
        category,
        tags: this.extractTags(tool),
        popularity: tool.useCount,
      });
    }

    // Sort each category by popularity
    for (const category of Object.keys(categorized) as ToolCategory[]) {
      categorized[category].sort((a, b) => b.popularity - a.popularity);
    }

    return categorized;
  }

  /**
   * Enable or disable a tool.
   */
  async setToolEnabled(toolId: string, enabled: boolean): Promise<void> {
    const db = getDB();
    await db
      .update(mcpTools)
      .set({ isEnabled: enabled })
      .where(eq(mcpTools.id, toolId));

    // Invalidate cache
    this.cache.delete(toolId);
  }

  /**
   * Record tool usage.
   */
  async recordToolUsage(toolId: string): Promise<void> {
    const db = getDB();
    await db
      .update(mcpTools)
      .set({
        useCount: sql`${mcpTools.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(mcpTools.id, toolId));

    // Update cache if exists
    const cached = this.cache.get(toolId);
    if (cached) {
      cached.useCount++;
      cached.lastUsedAt = new Date();
    }
  }

  /**
   * Get tool capabilities for agent matching.
   */
  async getToolCapabilities(): Promise<ToolCapability[]> {
    const { tools } = await this.getTools({ isEnabled: true, limit: 1000 });

    return tools.map((tool) => ({
      toolId: tool.id,
      toolName: tool.name,
      capabilities: this.extractCapabilities(tool),
      inputTypes: this.extractInputTypes(tool),
      outputTypes: this.extractOutputTypes(tool),
    }));
  }

  /**
   * Find tools by capability.
   */
  async findToolsByCapability(
    capability: string,
    limit = 5
  ): Promise<MCPTool[]> {
    const allCapabilities = await this.getToolCapabilities();

    const matching = allCapabilities
      .filter((tc) =>
        tc.capabilities.some(
          (c) => c.toLowerCase().includes(capability.toLowerCase())
        )
      )
      .sort((a, b) => {
        // Sort by exact match first
        const aExact = a.capabilities.some(
          (c) => c.toLowerCase() === capability.toLowerCase()
        );
        const bExact = b.capabilities.some(
          (c) => c.toLowerCase() === capability.toLowerCase()
        );
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      })
      .slice(0, limit);

    const toolIds = matching.map((m) => m.toolId);
    return this.getToolsByIds(toolIds);
  }

  /**
   * Clear the tool cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  private extractTags(tool: MCPTool): string[] {
    const tags: string[] = [];
    const text = `${tool.name} ${tool.description ?? ""}`.toLowerCase();

    if (text.includes("read")) tags.push("read");
    if (text.includes("write")) tags.push("write");
    if (text.includes("search")) tags.push("search");
    if (text.includes("create")) tags.push("create");
    if (text.includes("delete")) tags.push("delete");
    if (text.includes("update")) tags.push("update");
    if (text.includes("list")) tags.push("list");
    if (text.includes("get")) tags.push("get");
    if (text.includes("execute")) tags.push("execute");
    if (text.includes("run")) tags.push("run");

    return tags;
  }

  private extractCapabilities(tool: MCPTool): string[] {
    const capabilities: string[] = [];
    const name = tool.name.toLowerCase();
    const description = (tool.description ?? "").toLowerCase();

    // Extract from name
    if (name.includes("file")) capabilities.push("file-operations");
    if (name.includes("search")) capabilities.push("search");
    if (name.includes("query")) capabilities.push("query");
    if (name.includes("fetch")) capabilities.push("fetch");
    if (name.includes("send")) capabilities.push("send");
    if (name.includes("create")) capabilities.push("create");
    if (name.includes("update")) capabilities.push("update");
    if (name.includes("delete")) capabilities.push("delete");

    // Extract from description
    if (description.includes("read")) capabilities.push("read");
    if (description.includes("write")) capabilities.push("write");

    // Deduplicate
    return [...new Set(capabilities)];
  }

  private extractInputTypes(tool: MCPTool): string[] {
    const schema = tool.inputSchema;
    const types: string[] = [];

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value as { type?: string; format?: string };
        if (prop.type) {
          types.push(`${key}:${prop.type}`);
        }
      }
    }

    return types;
  }

  private extractOutputTypes(_tool: MCPTool): string[] {
    // MCP doesn't specify output schema, so we infer from name
    return ["text", "data"];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const toolRegistry = new ToolRegistry();
