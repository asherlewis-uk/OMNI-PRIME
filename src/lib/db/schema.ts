import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// ENUM TYPES (represented as SQLite TEXT with type checking)
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentStatus = "active" | "paused" | "error" | "archived";
export type UseCaseType =
  | "marketer"
  | "developer"
  | "founder"
  | "writer"
  | "researcher"
  | "designer"
  | "student"
  | "custom";
export type SkillLevel = "beginner" | "intermediate" | "expert";
export type WorkStyle = "solo" | "team" | "hybrid";
export type ContentTone = "professional" | "casual" | "technical" | "creative";
export type MCPServerStatus = "connected" | "disconnected" | "error" | "connecting";
export type MCPTransportType = "stdio" | "sse" | "http";
export type KnowledgeDocStatus = "pending" | "indexing" | "ready" | "error";
export type ToolCallStatus = "pending" | "running" | "completed" | "error";
export type MessageRole = "user" | "assistant" | "system" | "tool";

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE (Genesis Data Container)
// ═══════════════════════════════════════════════════════════════════════════════

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  useCase: text("use_case").$type<UseCaseType>().notNull(),
  objectives: text("objectives", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  skillLevel: text("skill_level").$type<SkillLevel>().notNull().default("intermediate"),
  workStyle: text("work_style").$type<WorkStyle>().notNull().default("solo"),
  contentTone: text("content_tone").$type<ContentTone>().notNull().default("professional"),
  toolPreferences: text("tool_preferences", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  rawAnswers: text("raw_answers", { mode: "json" }).$type<Record<string, string | string[]>>().notNull().default(sql`'{}'`),
  isOnboardingComplete: integer("is_onboarding_complete", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  agents: many(agents),
  swarms: many(swarmDefs),
  knowledgeDocs: many(knowledgeDocs),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatar: text("avatar"), // URL, emoji, or data URI
  description: text("description"),

  // Persona Configuration
  systemPrompt: text("system_prompt").notNull(),
  temperature: real("temperature").notNull().default(0.7),
  modelPreference: text("model_preference").notNull().default("ollama/llama3.1"),
  voiceId: text("voice_id"), // For TTS

  // State
  status: text("status").$type<AgentStatus>().notNull().default("active"),

  // Genesis/Template tracking
  isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
  genesisTag: text("genesis_tag").$type<UseCaseType>(),
  templateId: text("template_id"), // If spawned from a template

  // Metadata
  totalConversations: integer("total_conversations").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [agents.ownerId],
    references: [userProfiles.id],
  }),
  tools: many(agentTools),
  knowledge: many(agentKnowledge),
  sessions: many(chatSessions),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT TOOL ASSIGNMENTS (MCP Tool Binding)
// ═══════════════════════════════════════════════════════════════════════════════

export const agentTools = sqliteTable("agent_tools", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  toolId: text("tool_id")
    .notNull()
    .references(() => mcpTools.id, { onDelete: "cascade" }),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTools.agentId],
    references: [agents.id],
  }),
  tool: one(mcpTools, {
    fields: [agentTools.toolId],
    references: [mcpTools.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT KNOWLEDGE BASE LINKS
// ═══════════════════════════════════════════════════════════════════════════════

export const agentKnowledge = sqliteTable("agent_knowledge", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  docId: text("doc_id")
    .notNull()
    .references(() => knowledgeDocs.id, { onDelete: "cascade" }),
  relevanceScore: real("relevance_score"),
  customMetadata: text("custom_metadata", { mode: "json" }).$type<Record<string, unknown>>().default(sql`'{}'`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const agentKnowledgeRelations = relations(agentKnowledge, ({ one }) => ({
  agent: one(agents, {
    fields: [agentKnowledge.agentId],
    references: [agents.id],
  }),
  document: one(knowledgeDocs, {
    fields: [agentKnowledge.docId],
    references: [knowledgeDocs.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// SWARM DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const swarmDefs = sqliteTable("swarm_defs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),

  // Directed Graph of Agent Handoffs (stored as JSON)
  graphJson: text("graph_json", { mode: "json" }).$type<SwarmGraphNode[]>().notNull().default(sql`'[]'`),

  // Configuration
  entryAgentId: text("entry_agent_id").references(() => agents.id),
  maxIterations: integer("max_iterations").notNull().default(10),
  autoStart: integer("auto_start", { mode: "boolean" }).notNull().default(false),

  // Metadata
  totalExecutions: integer("total_executions").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const swarmDefsRelations = relations(swarmDefs, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [swarmDefs.ownerId],
    references: [userProfiles.id],
  }),
  entryAgent: one(agents, {
    fields: [swarmDefs.entryAgentId],
    references: [agents.id],
  }),
  sessions: many(chatSessions),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),

  // Session can be with a single agent OR a swarm
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  swarmId: text("swarm_id").references(() => swarmDefs.id, { onDelete: "set null" }),

  title: text("title"),
  modelUsed: text("model_used"),

  // Session state
  messageCount: integer("message_count").notNull().default(0),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [chatSessions.ownerId],
    references: [userProfiles.id],
  }),
  agent: one(agents, {
    fields: [chatSessions.agentId],
    references: [agents.id],
  }),
  swarm: one(swarmDefs, {
    fields: [chatSessions.swarmId],
    references: [swarmDefs.id],
  }),
  messages: many(messages),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),

  // Role: user, assistant, system, or tool
  role: text("role").$type<MessageRole>().notNull(),

  // Content
  content: text("content").notNull(),

  // For assistant messages - which agent sent it
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),

  // Metadata
  metadata: text("metadata", { mode: "json" }).$type<MessageMetadata>().notNull().default(sql`'{}'`),

  // Token counts (if available from provider)
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),

  // For streaming/chunking
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(true),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const messagesRelations = relations(messages, ({ one, many }) => ({
  session: one(chatSessions, {
    fields: [messages.sessionId],
    references: [chatSessions.id],
  }),
  agent: one(agents, {
    fields: [messages.agentId],
    references: [agents.id],
  }),
  toolCalls: many(toolCalls),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CALLS (Linked to Messages)
// ═══════════════════════════════════════════════════════════════════════════════

export const toolCalls = sqliteTable("tool_calls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  toolId: text("tool_id")
    .references(() => mcpTools.id, { onDelete: "set null" }),

  // Tool execution details
  toolName: text("tool_name").notNull(),
  arguments: text("arguments", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  result: text("result", { mode: "json" }),
  error: text("error"),

  // Status tracking
  status: text("status").$type<ToolCallStatus>().notNull().default("pending"),

  // Timing
  startedAt: integer("started_at", { mode: "timestamp" }),
  executedAt: integer("executed_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(messages, {
    fields: [toolCalls.messageId],
    references: [messages.id],
  }),
  tool: one(mcpTools, {
    fields: [toolCalls.toolId],
    references: [mcpTools.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const knowledgeDocs = sqliteTable("knowledge_docs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),

  // File metadata
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(), // mime type
  fileSize: integer("file_size").notNull(),
  contentHash: text("content_hash").notNull(), // SHA-256

  // Storage
  storagePath: text("storage_path").notNull(), // Path in OPFS or filesystem

  // Vectorization status
  vectorCount: integer("vector_count").notNull().default(0),
  chunkSize: integer("chunk_size").default(1000),
  chunkOverlap: integer("chunk_overlap").default(200),

  // Status
  status: text("status").$type<KnowledgeDocStatus>().notNull().default("pending"),
  errorMessage: text("error_message"),

  // Indexing timestamps
  indexedAt: integer("indexed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const knowledgeDocsRelations = relations(knowledgeDocs, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [knowledgeDocs.ownerId],
    references: [userProfiles.id],
  }),
  agentLinks: many(agentKnowledge),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVERS
// ═══════════════════════════════════════════════════════════════════════════════

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),

  // Server configuration
  name: text("name").notNull(),
  description: text("description"),
  transport: text("transport").$type<MCPTransportType>().notNull(),

  // Connection details
  command: text("command"), // For stdio transport
  args: text("args", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  url: text("url"), // For sse/http transport
  env: text("env", { mode: "json" }).$type<Record<string, string>>().default(sql`'{}'`),

  // Additional configuration
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>().default(sql`'{}'`),

  // Status
  status: text("status").$type<MCPServerStatus>().notNull().default("disconnected"),
  statusMessage: text("status_message"),

  // Sync tracking
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  toolCount: integer("tool_count").notNull().default(0),

  // Is this a built-in server?
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [mcpServers.ownerId],
    references: [userProfiles.id],
  }),
  tools: many(mcpTools),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// MCP TOOLS (Discovered from Servers)
// ═══════════════════════════════════════════════════════════════════════════════

export const mcpTools = sqliteTable("mcp_tools", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serverId: text("server_id")
    .notNull()
    .references(() => mcpServers.id, { onDelete: "cascade" }),

  // Tool definition
  name: text("name").notNull(),
  description: text("description"),

  // JSON Schema for input validation
  inputSchema: text("input_schema", { mode: "json" }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),

  // Is this a built-in tool?
  isBuiltIn: integer("is_built_in", { mode: "boolean" }).notNull().default(false),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),

  // Usage tracking
  useCount: integer("use_count").notNull().default(0),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const mcpToolsRelations = relations(mcpTools, ({ one, many }) => ({
  server: one(mcpServers, {
    fields: [mcpTools.serverId],
    references: [mcpServers.id],
  }),
  agentAssignments: many(agentTools),
  toolCalls: many(toolCalls),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS (for TypeScript)
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwarmGraphNode {
  agentId: string;
  agentName: string;
  position: { x: number; y: number };
  handoffRules: HandoffRule[];
}

export interface HandoffRule {
  targetAgentId: string;
  targetAgentName: string;
  condition: "always" | "keyword" | "tool_required" | "intent_match" | "custom";
  conditionValue?: string; // Keyword, tool name, or intent
  customPrompt?: string; // LLM-evaluated condition
  priority: number; // Higher = evaluated first
}

export interface MessageMetadata {
  // Source tracking
  provider?: "ollama" | "openai" | "anthropic" | "custom";
  model?: string;

  // For streaming
  streaming?: boolean;
  streamId?: string;

  // For swarm
  swarmHandoff?: {
    fromAgentId: string;
    toAgentId: string;
    reason: string;
  };

  // For tool calls
  hasToolCalls?: boolean;
  toolCallIds?: string[];

  // User feedback
  userRating?: "positive" | "negative" | null;
  userFeedback?: string;

  // Custom data
  custom?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type AgentTool = typeof agentTools.$inferSelect;
export type NewAgentTool = typeof agentTools.$inferInsert;

export type AgentKnowledge = typeof agentKnowledge.$inferSelect;
export type NewAgentKnowledge = typeof agentKnowledge.$inferInsert;

export type SwarmDef = typeof swarmDefs.$inferSelect;
export type NewSwarmDef = typeof swarmDefs.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;

export type KnowledgeDoc = typeof knowledgeDocs.$inferSelect;
export type NewKnowledgeDoc = typeof knowledgeDocs.$inferInsert;

export type MCPServer = typeof mcpServers.$inferSelect;
export type NewMCPServer = typeof mcpServers.$inferInsert;

export type MCPTool = typeof mcpTools.$inferSelect;
export type NewMCPTool = typeof mcpTools.$inferInsert;
