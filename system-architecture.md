# OMNI-PRIME: System Architecture
## The Sovereign Pocket Enterprise

---

## 1. PROJECT MANIFESTO

### 1.1 Mode & Strategy
**MODE B: CHIMERA (Synthesis)**

OMNI-PRIME is a fusion of three architectural lineages:
- **Sintra.ai** → Visual orchestration paradigm (3-pane layout, agent feeds)
- **OpenClaw** → Tool-native agent architecture (MCP protocol, swarm execution)
- **Character.ai** → Deep persona modeling (customization, voice, memory)

### 1.2 Core Philosophy
> *"The enterprise in your pocket. Sovereign by default, cloud-capable by choice."*

OMNI-PRIME operates on a **Local-First Sovereignty** model:
- All agent definitions, context, and vector embeddings reside locally
- Cloud LLMs (OpenAI/Anthropic) are optional BYOK overlays
- The system functions 100% offline via Ollama
- Capacitor wrapping enables true native deployment (Android/iOS)

### 1.3 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js 14 + App Router** | PWA support, SSR/SSG flexibility, API Routes for orchestrator |
| **Capacitor (not React Native)** | Web-tech DNA preserves PWA→Native portability |
| **Zustand + Immer** | Atomic state management for complex agent/swarm states |
| **BullMQ + Redis** | Background job processing for tool execution without UI blocking |
| **ChromaDB (local)** | Vector storage for RAG/Knowledge Base |
| **Dexie.js (IndexedDB)** | Client-side persistence for offline-first agent definitions |
| **MCP Protocol** | Standardized tool interface; agents discover capabilities dynamically |

---

## 2. EXECUTIVE TECH STACK

### 2.1 Frontend Layer
```
Framework:        Next.js 14 (App Router)
Styling:          Tailwind CSS + shadcn/ui
State:            Zustand (global) + React Query (server state)
PWA:              next-pwa (workbox), custom service worker
Mobile UX:        Capacitor (Android/iOS bridges)
Touch/Gestures:   @use-gesture/react + framer-motion
Icons:            Lucide React
Notifications:    web-push (PWA) + Local Notifications (Capacitor)
```

**Justification:**
- `next-pwa` provides automatic service worker generation, precaching, and offline fallbacks
- Capacitor allows the same codebase to deploy as PWA (web), Android APK, or iOS app
- @use-gesture enables swipeable panels (critical for mobile 3-pane adaptation)

### 2.2 Backend/Orchestration Layer
```
Runtime:          Node.js (via Next.js API Routes + Custom Server)
Queue System:     BullMQ (Redis-backed)
Orchestrator:     SwarmEngine (custom, runs in background worker)
MCP Registry:     MCPServerManager (handles tool discovery/execution)
WebSocket:        Socket.io (real-time agent status/feed updates)
```

**Justification:**
- BullMQ enables non-blocking tool execution; agents can "think" while tools run
- SwarmEngine manages agent handoffs via a directed graph of capabilities
- MCP (Model Context Protocol) standardizes tool interfaces (reuse community tools)

### 2.3 Data Layer
```
Client Cache:     Zustand (in-memory) + Dexie.js (IndexedDB persistence)
Vector DB:        ChromaDB (local, SQLite backend)
Structured Data:  SQLite (via better-sqlite3)
Sync:             ElectricSQL (optional, for multi-device sync)
File Storage:     OPFS (Origin Private File System) for knowledge base uploads
```

**Justification:**
- Dexie.js provides a Promise-based IndexedDB wrapper for offline agent configs
- ChromaDB runs entirely local; no network calls for RAG retrieval
- OPFS allows large file handling (PDFs, docs for knowledge base) without memory bloat

### 2.4 AI Gateway Layer
```
Local LLM:        Ollama (http://host.docker.internal:11434)
Cloud Gateway:    UnifiedGateway (abstraction over OpenAI, Anthropic, Gemini)
Embeddings:       Ollama (nomic-embed-text) or OpenAI (text-embedding-3-small)
Context Manager:  ContextInjector (injects Genesis data into system prompts)
```

**Justification:**
- UnifiedGateway allows seamless fallback: Local → Cloud → Different Cloud
- ContextInjector dynamically modifies system prompts based on user profile (Genesis data)

---

## 3. COMPLETE ASCII DIRECTORY TREE

```
C:\USERS\ASHER\PROJECTS\OMNI-PRIME\
│
├── AGENTS.md                          # System instruction manifest
├── system-architecture.md             # This document
├── next.config.js                     # next-pwa configuration
├── capacitor.config.ts                # Capacitor (iOS/Android) config
├── package.json
├── tsconfig.json
├── tailwind.config.ts
│
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── sw.js                          # Custom service worker (workbox)
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── apple-touch-icon.png
│   └── assets/
│       └── onboarding/
│           ├── marketer-persona.json
│           ├── developer-persona.json
│           └── founder-persona.json
│
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # Root layout (PWA viewport setup)
│   │   ├── page.tsx                   # Entry (redirects to /onboarding or /dashboard)
│   │   ├── globals.css
│   │   │
│   │   ├── (dashboard)/               # Authenticated/Active routes
│   │   │   ├── layout.tsx             # 3-pane shell (Sidebar + Feed + Context)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # Main dashboard view
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx           # Agent directory (grid/list)
│   │   │   │   └── [agentId]/
│   │   │   │       └── page.tsx       # Individual agent workspace
│   │   │   ├── swarm/
│   │   │   │   └── page.tsx           # Swarm orchestration view
│   │   │   ├── tools/
│   │   │   │   └── page.tsx           # MCP Tool registry
│   │   │   ├── knowledge/
│   │   │   │   └── page.tsx           # Knowledge base management
│   │   │   └── settings/
│   │   │       └── page.tsx           # App settings, LLM providers
│   │   │
│   │   ├── onboarding/                # Genesis Flow (First Launch)
│   │   │   ├── layout.tsx             # Wizard shell (no sidebar)
│   │   │   ├── page.tsx               # Entry point
│   │   │   ├── step-1-usecase/
│   │   │   │   └── page.tsx           # "I am a..." selection
│   │   │   ├── step-2-objectives/
│   │   │   │   └── page.tsx           # Goals selection
│   │   │   ├── step-3-integrations/
│   │   │   │   └── page.tsx           # Tool preferences
│   │   │   └── step-4-generation/
│   │   │       └── page.tsx           # Agent spawn progress + results
│   │   │
│   │   └── api/                       # Backend API Routes
│   │       ├── agents/
│   │       │   ├── route.ts           # CRUD for agents
│   │       │   └── [agentId]/
│   │       │       ├── route.ts       # Single agent ops
│   │       │       ├── execute/
│   │       │       │   └── route.ts   # Run agent with prompt
│   │       │       └── handoff/
│   │       │           └── route.ts   # Swarm handoff endpoint
│   │       │
│   │       ├── swarm/
│   │       │   ├── route.ts           # Swarm CRUD
│   │       │   └── [swarmId]/
│   │       │       ├── execute/
│   │       │       │   └── route.ts   # Execute swarm workflow
│   │       │       └── status/
│   │       │           └── route.ts   # Poll swarm status
│   │       │
│   │       ├── tools/
│   │       │   ├── route.ts           # List available MCP tools
│   │       │   └── execute/
│   │       │       └── route.ts       # Execute tool via MCP
│   │       │
│   │       ├── mcp/
│   │       │   ├── registry/
│   │       │   │   └── route.ts       # MCP server management
│   │       │   └── servers/
│   │       │       └── [serverId]/
│   │       │           └── route.ts   # Server-specific ops
│   │       │
│   │       ├── knowledge/
│   │       │   ├── route.ts           # Upload/list knowledge docs
│   │       │   └── [docId]/
│   │       │       └── route.ts       # Delete/retrieve doc
│   │       │
│   │       ├── chat/
│   │       │   ├── route.ts           # Unified chat endpoint
│   │       │   └── stream/
│   │       │       └── route.ts       # SSE streaming for responses
│   │       │
│   │       └── settings/
│   │           └── route.ts           # App configuration persistence
│   │
│   ├── components/                    # React Components
│   │   │
│   │   ├── layout/                    # Shell Components
│   │   │   ├── DesktopShell.tsx       # 3-pane desktop layout
│   │   │   ├── MobileShell.tsx        # Bottom-nav mobile layout
│   │   │   ├── Sidebar.tsx            # Left navigation (desktop)
│   │   │   ├── MobileNav.tsx          # Bottom tab bar (mobile)
│   │   │   ├── ActiveFeed.tsx         # Center message/thread panel
│   │   │   ├── AgentContext.tsx       # Right-side agent details
│   │   │   ├── TopBar.tsx             # Header with safe-area handling
│   │   │   └── SafeAreaProvider.tsx   # Handles iOS notch/safe areas
│   │   │
│   │   ├── ui/                        # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx             # Mobile-first modal (swipe down)
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx             # Temperature control
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── onboarding/                # Genesis Flow Components
│   │   │   ├── GenesisWizard.tsx      # Main wizard container
│   │   │   ├── UseCaseSelector.tsx    # "I am a..." cards
│   │   │   ├── ObjectivePicker.tsx    # Multi-select goals
│   │   │   ├── ToolEnabler.tsx        # Toggle MCP tools
│   │   │   ├── AgentGenerator.tsx     # Progress + generated agents preview
│   │   │   └── UseCaseTemplates.ts    # Predefined configurations
│   │   │
│   │   ├── agents/                    # Agent Management
│   │   │   ├── AgentCard.tsx          # Grid/list item
│   │   │   ├── AgentGrid.tsx          # Container
│   │   │   ├── AgentCreator.tsx       # "Workshop" modal (deep customization)
│   │   │   ├── AgentEditor.tsx        # Edit existing agent
│   │   │   ├── PersonaTuner.tsx       # Temperature, voice, system prompt
│   │   │   ├── KnowledgeAttachment.tsx # KB file selector
│   │   │   └── ToolSelector.tsx       # MCP tool assignment
│   │   │
│   │   ├── chat/                      # Chat Interface
│   │   │   ├── ChatContainer.tsx      # Message list + input
│   │   │   ├── MessageBubble.tsx      # Individual message (user/agent)
│   │   │   ├── MessageInput.tsx       # Text input with tool suggestions
│   │   │   ├── ToolCallIndicator.tsx  # "Agent is using X..."
│   │   │   ├── StreamingText.tsx      # Typewriter effect
│   │   │   └── SwarmActivityLog.tsx   # Shows handoffs in active feed
│   │   │
│   │   ├── swarm/                     # Swarm Orchestration
│   │   │   ├── SwarmBuilder.tsx       # Visual swarm constructor
│   │   │   ├── SwarmNode.tsx          # Agent node in graph
│   │   │   ├── SwarmEdge.tsx          # Handoff connection
│   │   │   ├── SwarmExecutor.tsx      # Run button + status
│   │   │   └── HandoffRules.tsx       # Logic for when to handoff
│   │   │
│   │   ├── tools/                     # MCP Tool UI
│   │   │   ├── ToolRegistry.tsx       # Available tools list
│   │   │   ├── ToolCard.tsx           # Individual tool display
│   │   │   ├── MCPServerForm.tsx      # Add external MCP server
│   │   │   └── ToolResultViewer.tsx   # Render tool output
│   │   │
│   │   └── knowledge/                 # Knowledge Base
│   │       ├── KnowledgeUploader.tsx  # File dropzone
│   │       ├── DocumentList.tsx       # File manager
│   │       └── VectorIndexStatus.tsx  # ChromaDB indexing progress
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useAgents.ts               # Agent CRUD + state
│   │   ├── useSwarm.ts                # Swarm execution + status
│   │   ├── useChat.ts                 # Chat streaming + history
│   │   ├── useTools.ts                # MCP tool registry
│   │   ├── useKnowledge.ts            # KB upload/query
│   │   ├── useLocalStorage.ts         # Persistence hook
│   │   ├── useMobileDetect.ts         # Viewport detection
│   │   ├── useSafeArea.ts             # iOS/Android safe areas
│   │   ├── useGenesis.ts              # Onboarding flow state
│   │   └── useOffline.ts              # Network status
│   │
│   ├── lib/                           # Core Libraries
│   │   │
│   │   ├── db/                        # Database Layer
│   │   │   ├── schema.ts              # Drizzle schema definitions
│   │   │   ├── client.ts              # SQLite connection
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial.sql
│   │   │   └── queries/
│   │   │       ├── agents.ts          # Agent queries
│   │   │       ├── swarms.ts          # Swarm queries
│   │   │       └── knowledge.ts       # KB queries
│   │   │
│   │   ├── stores/                    # Zustand Stores
│   │   │   ├── agentStore.ts          # Agent definitions + selected agent
│   │   │   ├── chatStore.ts           # Active conversation state
│   │   │   ├── swarmStore.ts          # Active swarm + execution state
│   │   │   ├── uiStore.ts             # Mobile/desktop mode, sidebar state
│   │   │   └── genesisStore.ts        # Onboarding progress + answers
│   │   │
│   │   ├── ai/                        # AI Gateway
│   │   │   ├── unifiedGateway.ts      # Abstract LLM interface
│   │   │   ├── providers/
│   │   │   │   ├── ollama.ts          # Local provider
│   │   │   │   ├── openai.ts          # OpenAI provider
│   │   │   │   └── anthropic.ts       # Anthropic provider
│   │   │   ├── embeddings.ts          # Vector generation
│   │   │   └── contextInjector.ts     # Injects Genesis data
│   │   │
│   │   ├── mcp/                       # MCP Protocol
│   │   │   ├── MCPClient.ts           # MCP client implementation
│   │   │   ├── MCPServerManager.ts    # Server lifecycle + discovery
│   │   │   ├── toolRegistry.ts        # Available tools cache
│   │   │   └── types.ts               # MCP type definitions
│   │   │
│   │   ├── swarm/                     # Swarm Engine
│   │   │   ├── SwarmEngine.ts         # Core orchestrator
│   │   │   ├── SwarmGraph.ts          # Agent relationship graph
│   │   │   ├── HandoffDetector.ts     # Logic: when to handoff
│   │   │   └── types.ts               # Swarm type definitions
│   │   │
│   │   ├── vector/                    # Vector DB
│   │   │   ├── chromaClient.ts        # ChromaDB connection
│   │   │   ├── embeddings.ts          # Text → Vector
│   │   │   └── retrieval.ts           # RAG retrieval
│   │   │
│   │   ├── queue/                     # BullMQ Setup
│   │   │   ├── connection.ts          # Redis connection
│   │   │   ├── workers/
│   │   │   │   ├── toolWorker.ts      # Tool execution worker
│   │   │   │   ├── swarmWorker.ts     # Swarm execution worker
│   │   │   │   └── indexingWorker.ts  # KB indexing worker
│   │   │   └── queues.ts              # Queue definitions
│   │   │
│   │   └── utils/                     # Utilities
│   │       ├── idGenerator.ts         # UUID generation
│   │       ├── validators.ts          # Input validation
│   │       └── safeArea.ts            # Mobile safe area calculations
│   │
│   ├── types/                         # TypeScript Definitions
│   │   ├── agent.ts                   # Agent schema
│   │   ├── swarm.ts                   # Swarm schema
│   │   ├── chat.ts                    # Message types
│   │   ├── tool.ts                    # MCP tool types
│   │   ├── knowledge.ts               # KB types
│   │   └── genesis.ts                 # Onboarding types
│   │
│   └── workers/                       # Web Workers (client-side)
       ├── indexBuilder.worker.ts      # IndexedDB operations
       └── fileProcessor.worker.ts     # PDF/text parsing
```

---

## 4. UNIFIED DATA SCHEMA

### 4.1 Entity Relationship Diagram (SQLite)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OMNI-PRIME SCHEMA                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   USER_PROFILE  │     │     AGENTS      │     │   SWARM_DEFS    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ PK id           │     │ PK id           │     │ PK id           │
│    use_case     │◄────┤ FK owner_id     │     │ FK owner_id     │
│    objectives   │     │    name         │     │    name         │
│    preferences  │     │    avatar       │     │    description  │
│    genesis_data │◄────┤    system_prompt│     │    graph_json   │
│    created_at   │     │    temperature  │     │    created_at   │
└─────────────────┘     │    model_pref   │     └─────────────────┘
         ▲              │    voice_id     │              │
         │              │    status       │              │
         │              │    is_template  │              │
         │              │    genesis_tag  │◄─────────────┘
         │              │    created_at   │
         │              │    updated_at   │
         │              └─────────────────┘
         │                       │
         │                       │
         │              ┌────────┴────────┐
         │              │                 │
         │      ┌───────▼──────┐   ┌──────▼──────┐
         │      │ AGENT_TOOLS  │   │AGENT_KNOWLEDGE│
         │      ├──────────────┤   ├─────────────┤
         │      │ PK id        │   │ PK id       │
         │      │ FK agent_id  │   │ FK agent_id │
         │      │ FK tool_id   │   │ FK doc_id   │
         │      │ config_json  │   │ relevance   │
         │      └──────────────┘   └─────────────┘
         │
         │              ┌─────────────────┐
         └──────────────┤  CHAT_SESSIONS  │
                        ├─────────────────┤
                        │ PK id           │
                        │ FK agent_id     │
                        │ FK swarm_id     │
                        │ title           │
                        │ model_used      │
                        │ created_at      │
                        └─────────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                 ┌──────▼──────┐   ┌──────▼──────┐
                 │  MESSAGES   │   │  TOOL_CALLS │
                 ├─────────────┤   ├─────────────┤
                 │ PK id       │   │ PK id       │
                 │ FK session_id│  │ FK message_id│
                 │ role        │   │ tool_name   │
                 │ content     │   │ arguments   │
                 │ metadata    │   │ result      │
                 │ created_at  │   │ status      │
                 └─────────────┘   │ executed_at │
                                   └─────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  KNOWLEDGE_DOCS │     │  MCP_SERVERS    │     │  MCP_TOOLS      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ PK id           │     │ PK id           │     │ PK id           │
│ FK owner_id     │     │ name            │     │ FK server_id    │
│ filename        │     │ transport       │     │ name            │
│ file_type       │     │ url/command     │     │ description     │
│ file_size       │     │ config_json     │     │ input_schema    │
│ content_hash    │     │ status          │     │ is_enabled      │
│ vector_count    │     │ last_synced     │     │ created_at      │
│ indexed_at      │     └─────────────────┘     └─────────────────┘
│ status          │
└─────────────────┘
```

### 4.2 Schema Definitions (Drizzle ORM)

```typescript
// src/lib/db/schema.ts

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE (Genesis Data Container)
// ─────────────────────────────────────────────────────────────────────────────
export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  useCase: text("use_case").notNull(),           // "marketer", "developer", etc.
  objectives: text("objectives", { mode: "json" }).$type<string[]>(),
  preferences: text("preferences", { mode: "json" }).$type<Record<string, any>>(),
  genesisData: text("genesis_data", { mode: "json" }).$type<GenesisData>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS
// ─────────────────────────────────────────────────────────────────────────────
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),                         // URL or emoji
  description: text("description"),
  
  // Persona Configuration
  systemPrompt: text("system_prompt").notNull(),
  temperature: real("temperature").notNull().default(0.7),
  modelPreference: text("model_preference").default("ollama/llama3.1"),
  voiceId: text("voice_id"),                      // For TTS
  
  // State
  status: text("status").$type<"active" | "paused" | "error">().default("active"),
  
  // Genesis/Template
  isTemplate: integer("is_template", { mode: "boolean" }).default(false),
  genesisTag: text("genesis_tag"),                // Links to use case
  
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT TOOL ASSIGNMENTS (MCP Tool Binding)
// ─────────────────────────────────────────────────────────────────────────────
export const agentTools = sqliteTable("agent_tools", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  toolId: text("tool_id").notNull(),              // References MCP tool
  config: text("config", { mode: "json" }).$type<Record<string, any>>(),
});

// ─────────────────────────────────────────────────────────────────────────────
// AGENT KNOWLEDGE BASE LINKS
// ─────────────────────────────────────────────────────────────────────────────
export const agentKnowledge = sqliteTable("agent_knowledge", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  docId: text("doc_id").notNull(),
  relevanceScore: real("relevance_score"),
});

// ─────────────────────────────────────────────────────────────────────────────
// SWARM DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
export const swarmDefs = sqliteTable("swarm_defs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Directed Graph of Agent Handoffs
  graphJson: text("graph_json", { mode: "json" }).$type<SwarmGraphNode[]>(),
  
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SESSIONS
// ─────────────────────────────────────────────────────────────────────────────
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").references(() => agents.id),
  swarmId: text("swarm_id").references(() => swarmDefs.id),
  title: text("title"),
  modelUsed: text("model_used"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant" | "system">().notNull(),
  content: text("content").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<MessageMetadata>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL CALLS (Linked to Messages)
// ─────────────────────────────────────────────────────────────────────────────
export const toolCalls = sqliteTable("tool_calls", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments", { mode: "json" }),
  result: text("result", { mode: "json" }),
  status: text("status").$type<"pending" | "running" | "completed" | "error">().default("pending"),
  executedAt: integer("executed_at", { mode: "timestamp" }),
});

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const knowledgeDocs = sqliteTable("knowledge_docs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  contentHash: text("content_hash").notNull(),
  vectorCount: integer("vector_count").default(0),
  status: text("status").$type<"pending" | "indexing" | "ready" | "error">().default("pending"),
  indexedAt: integer("indexed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// MCP SERVERS
// ─────────────────────────────────────────────────────────────────────────────
export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  transport: text("transport").$type<"stdio" | "sse">().notNull(),
  urlOrCommand: text("url_or_command").notNull(),
  config: text("config", { mode: "json" }),
  status: text("status").$type<"connected" | "disconnected" | "error">().default("disconnected"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// MCP TOOLS (Discovered from Servers)
// ─────────────────────────────────────────────────────────────────────────────
export const mcpTools = sqliteTable("mcp_tools", {
  id: text("id").primaryKey(),
  serverId: text("server_id")
    .notNull()
    .references(() => mcpServers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  inputSchema: text("input_schema", { mode: "json" }),  // JSON Schema
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

### 4.3 TypeScript Interfaces

```typescript
// src/types/genesis.ts

export interface GenesisData {
  useCase: UseCaseType;
  objectives: string[];
  skillLevel: "beginner" | "intermediate" | "expert";
  workStyle: "solo" | "team" | "hybrid";
  toolPreferences: string[];
  contentTone: "professional" | "casual" | "technical" | "creative";
  // Raw answers from onboarding wizard
  rawAnswers: Record<string, string | string[]>;
}

export type UseCaseType = 
  | "marketer"
  | "developer" 
  | "founder"
  | "writer"
  | "researcher"
  | "designer"
  | "student"
  | "custom";

// src/types/agent.ts

export interface Agent {
  id: string;
  ownerId: string;
  name: string;
  avatar?: string;
  description?: string;
  systemPrompt: string;
  temperature: number;
  modelPreference: string;
  voiceId?: string;
  status: "active" | "paused" | "error";
  isTemplate: boolean;
  genesisTag?: string;
  tools?: AgentTool[];
  knowledge?: KnowledgeLink[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTool {
  id: string;
  toolId: string;
  toolName: string;       // Denormalized for display
  toolDescription: string;
  config: Record<string, any>;
}

// src/types/swarm.ts

export interface SwarmGraphNode {
  agentId: string;
  agentName: string;
  position: { x: number; y: number };
  handoffRules: HandoffRule[];
}

export interface HandoffRule {
  targetAgentId: string;
  condition: "always" | "keyword" | "tool_required" | "custom";
  conditionValue?: string;    // Keyword or tool name
  customPrompt?: string;      // LLM-evaluated condition
}

export interface SwarmExecution {
  swarmId: string;
  sessionId: string;
  status: "idle" | "running" | "paused" | "completed";
  currentAgentId: string | null;
  executionLog: SwarmHandoffEvent[];
}

export interface SwarmHandoffEvent {
  timestamp: number;
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  messagePreview: string;
}

// src/types/tool.ts

export interface MCPTool {
  id: string;
  serverId: string;
  serverName: string;     // Denormalized
  name: string;
  description?: string;
  inputSchema: object;    // JSON Schema
  isEnabled: boolean;
}

export interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  arguments: Record<string, any>;
  result?: any;
  status: "pending" | "running" | "completed" | "error";
  executedAt?: Date;
}
```

---

## 5. CRITICAL LOGIC FLOWS

### 5.1 Flow: Genesis Onboarding → Agent Spawn

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GENESIS FLOW (First Launch)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

USER LANDS ON /
       │
       ▼
┌─────────────────────┐
│ Check: hasGenesis?  │◄────────────────────────────────────────┐
│   (localStorage)    │                                         │
└─────────────────────┘                                         │
       │                                                        │
   NO  │  YES                                                   │
       ▼       ▼                                                │
┌──────────┐   ┌──────────────┐                                 │
│/onboarding│   │ /dashboard   │                                 │
└──────────┘   └──────────────┘                                 │
       │                                                        │
       ▼                                                        │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ONBOARDING WIZARD                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STEP 1: USE CASE SELECTION                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  "I am a..."                                                             │   │
│  │  ┌────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐         │   │
│  │  │Marketer│ │Developer │ │ Founder │ │ Writer  │ │  Custom  │         │   │
│  │  └────────┘ └──────────┘ └─────────┘ └─────────┘ └──────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  STEP 2: OBJECTIVE PICKER                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  "What do you want to achieve?" (Multi-select)                          │   │
│  │  [ ] Content Creation  [ ] Code Review  [ ] Market Research             │   │
│  │  [ ] Email Automation  [ ] Debugging    [ ] Pitch Decks                 │   │
│  │  [ ] Social Media      [ ] Architecture [ ] Fundraising                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  STEP 3: TOOL ENABLEMENT                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  "Which tools should your agents access?"                                │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │   │
│  │  │  Web Search │ │  File System│ │   GitHub    │  (MCP Tools)          │   │
│  │  │  [toggle]   │ │  [toggle]   │ │  [toggle]   │                       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  STEP 4: PERSONALITY TUNING                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  "How should your agents communicate?"                                   │   │
│  │  Skill Level: [Beginner ●───○───○ Expert]                               │   │
│  │  Work Style:  [Solo ○───●───○ Team]                                     │   │
│  │  Tone:        [Professional] [Casual] [Technical] [Creative]            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  STEP 5: AGENT GENERATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  [████████████████████░░░░░░░░] Generating your agents...                │   │
│  │                                                                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │  ✓ ContentBot  │  │  ✓ CodeHelper  │  │  → ResearchPal │             │   │
│  │  │   (spawning)   │  │   (ready)      │  │   (configuring)│             │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  AGENT TEMPLATES INSTANTIATED                                           │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  1. Load UseCaseTemplate[answers.useCase]                               │   │
│  │  2. Filter agents by selected objectives                                │   │
│  │  3. Assign enabled tools to relevant agents                             │   │
│  │  4. Modify systemPrompts based on skillLevel + tone                     │   │
│  │  5. Inject genesisData into ContextInjector cache                       │   │
│  │  6. Save to SQLite + IndexedDB                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│   ┌────────────┐                                                                │
│   │ /dashboard │                                                                │
│   └────────────┘                                                                │
│       │                                                                         │
│       └────────────────────────────────────────────────────────────────────────►┘
```

**Pseudocode: Agent Generation Logic**

```typescript
// src/lib/genesis/agentGenerator.ts

interface UseCaseTemplate {
  useCase: UseCaseType;
  agents: TemplateAgentDef[];
}

interface TemplateAgentDef {
  id: string;
  name: string;
  basePrompt: string;
  defaultTools: string[];
  relevantObjectives: string[];
}

const USE_CASE_TEMPLATES: Record<UseCaseType, UseCaseTemplate> = {
  marketer: {
    useCase: "marketer",
    agents: [
      {
        id: "content-creator",
        name: "ContentBot",
        basePrompt: "You are a marketing content specialist...",
        defaultTools: ["web-search", "image-generation"],
        relevantObjectives: ["content-creation", "social-media", "email-automation"]
      },
      {
        id: "market-researcher",
        name: "ResearchPal",
        basePrompt: "You analyze market trends and competitors...",
        defaultTools: ["web-search", "data-analysis"],
        relevantObjectives: ["market-research"]
      },
      // ... more agents
    ]
  },
  developer: {
    useCase: "developer",
    agents: [
      {
        id: "code-reviewer",
        name: "CodeGuardian",
        basePrompt: "You review code for bugs, security, and style...",
        defaultTools: ["file-system", "github", "code-analysis"],
        relevantObjectives: ["code-review", "debugging"]
      },
      // ... more agents
    ]
  },
  // ... other use cases
};

export async function generateAgentsFromGenesis(
  genesisData: GenesisData
): Promise<Agent[]> {
  const template = USE_CASE_TEMPLATES[genesisData.useCase];
  
  // 1. Filter agents by selected objectives
  const relevantAgents = template.agents.filter(agent =>
    agent.relevantObjectives.some(obj => genesisData.objectives.includes(obj))
  );
  
  // 2. Generate personalized system prompts
  const generatedAgents: Agent[] = relevantAgents.map(templateDef => {
    const personalizedPrompt = personalizePrompt(
      templateDef.basePrompt,
      genesisData
    );
    
    return {
      id: generateUUID(),
      name: templateDef.name,
      systemPrompt: personalizedPrompt,
      temperature: genesisData.skillLevel === "expert" ? 0.3 : 0.7,
      modelPreference: selectModelForSkill(genesisData.skillLevel),
      tools: filterEnabledTools(templateDef.defaultTools, genesisData.toolPreferences),
      genesisTag: genesisData.useCase,
      // ... other fields
    };
  });
  
  // 3. Persist to database
  await db.insert(agents).values(generatedAgents);
  
  // 4. Cache genesis data for ContextInjector
  await contextInjector.setGenesisProfile(genesisData);
  
  return generatedAgents;
}

function personalizePrompt(basePrompt: string, genesis: GenesisData): string {
  const contextLines = [
    `\n[USER CONTEXT]`,
    `Role: ${genesis.useCase}`,
    `Skill Level: ${genesis.skillLevel}`,
    `Communication Style: ${genesis.contentTone}`,
    `Work Mode: ${genesis.workStyle}`,
    `Key Objectives: ${genesis.objectives.join(", ")}`,
    `[END CONTEXT]\n`
  ];
  
  // Inject at the END of system prompt for consistent behavior
  return basePrompt + "\n" + contextLines.join("\n");
}
```

---

### 5.2 Flow: Swarm Orchestration + MCP Tool Execution

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     SWARM ORCHESTRATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

USER SENDS MESSAGE
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SWARM ENGINE INITIALIZATION                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. Load SwarmGraph from swarmDefs.graphJson                                    │
│  2. Identify Entry Agent (first node in graph)                                  │
│  3. Create ChatSession with swarmId                                             │
│  4. Initialize ExecutionContext with:                                           │
│     - Current agent                                                             │
│     - Message history                                                           │
│     - Available tools for current agent                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AGENT EXECUTION CYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ STEP 1: CONTEXT PREPARATION                                              │   │
│   │ ─────────────────────────────────────────────────────────────────────   │   │
│   │ systemPrompt = agent.systemPrompt                                       │   │
│   │              + contextInjector.getGenesisContext()                      │   │
│   │              + knowledgeRetriever.getRelevantDocs(query)                │   │
│   │                                                                          │   │
│   │ messages = buildMessageHistory(sessionId, limit=10)                     │   │
│   │ tools = getEnabledToolsForAgent(agent.id)                               │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ STEP 2: LLM INVOCATION (Unified Gateway)                                 │   │
│   │ ─────────────────────────────────────────────────────────────────────   │   │
│   │ unifiedGateway.stream({                                                 │   │
│   │   model: agent.modelPreference,                                         │   │
│   │   messages: [systemPrompt, ...messages, userMessage],                   │   │
│   │   tools: formatToolsForLLM(tools),  // MCP tool schemas                 │   │
│   │   temperature: agent.temperature                                        │   │
│   │ })                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ STEP 3: TOOL CALL DETECTION                                              │   │
│   │ ─────────────────────────────────────────────────────────────────────   │   │
│   │ IF LLM returns tool_call:                                               │   │
│   │    │                                                                     │   │
│   │    ▼                                                                     │   │
│   │ ┌────────────────────────────────────────────────────────────────────┐  │   │
│   │ │ TOOL EXECUTION (NON-BLOCKING via BullMQ)                           │  │   │
│   │ ├────────────────────────────────────────────────────────────────────┤  │   │
│   │ │ 1. Add ToolCall record (status: "pending")                         │  │   │
│   │ │ 2. Emit "tool_pending" via Socket.io to client                     │  │   │
│   │ │ 3. Queue job: toolQueue.add("execute-tool", {                       │  │   │
│   │ │      toolName, arguments, messageId                                │  │   │
│   │ │    })                                                               │  │   │
│   │ │                                                                       │  │   │
│   │ │    ┌──────────────────┐                                              │  │   │
│   │ │    │  TOOL WORKER     │                                              │  │   │
│   │ │    │  (Background)    │                                              │  │   │
│   │ │    ├──────────────────┤                                              │  │   │
│   │ │    │ 1. MCPClient.call│                                              │  │   │
│   │ │    │ 2. Update status │                                              │  │   │
│   │ │    │ 3. Emit result   │───► Socket.io "tool_completed"              │  │   │
│   │ │    └──────────────────┘                                              │  │   │
│   │ │                                                                       │  │   │
│   │ │ 4. LLM waits (or streams placeholder text)                         │  │   │
│   │ │ 5. On result: Inject tool output, continue generation              │  │   │
│   │ └────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                          │   │
│   │ ELSE: Stream response directly to user                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│       │                                                                         │
│       ▼                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ STEP 4: HANDOFF DETECTION                                                │   │
│   │ ─────────────────────────────────────────────────────────────────────   │   │
│   │ After LLM response is complete:                                         │   │
│   │                                                                          │   │
│   │ handoffResult = HandoffDetector.evaluate({                              │   │
│   │   currentAgent: agent,                                                  │   │
│   │   response: llmOutput,                                                  │   │
│   │   graphNode: swarmGraph.getNode(agent.id),                              │   │
│   │   handoffRules: node.handoffRules                                       │   │
│   │ })                                                                      │   │
│   │                                                                          │   │
│   │ IF handoffResult.shouldHandoff:                                         │   │
│   │    │                                                                     │   │
│   │    ▼                                                                     │   │
│   │ ┌────────────────────────────────────────────────────────────────────┐  │   │
│   │ │ SWARM HANDOFF                                                      │  │   │
│   │ ├────────────────────────────────────────────────────────────────────┤  │   │
│   │ │ 1. Log handoff event to executionLog                               │  │   │
│   │ │ 2. Emit "agent_handoff" via Socket.io                              │  │   │
│   │ │ 3. Update currentAgent in ExecutionContext                         │  │   │
│   │ │ 4. Inject handoff message:                                         │  │   │
│   │ │    "[Handoff: Agent A → Agent B] Reason: {reason}"                 │  │   │
│   │ │ 5. GOTO STEP 1 (Agent Execution Cycle)                             │  │   │
│   │ └────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                          │   │
│   │ ELSE: Session complete, wait for next user input                        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Pseudocode: Swarm Engine**

```typescript
// src/lib/swarm/SwarmEngine.ts

export class SwarmEngine {
  private graph: SwarmGraph;
  private executionContext: ExecutionContext;
  private gateway: UnifiedGateway;
  private handoffDetector: HandoffDetector;
  private toolQueue: Queue;
  
  constructor(
    swarmDef: SwarmDef,
    private sessionId: string,
    private io: Server
  ) {
    this.graph = new SwarmGraph(swarmDef.graphJson);
    this.executionContext = new ExecutionContext(sessionId);
    this.gateway = new UnifiedGateway();
    this.handoffDetector = new HandoffDetector();
    this.toolQueue = new Queue("tool-execution");
  }
  
  async execute(userMessage: string): Promise<void> {
    // Initialize with entry agent
    let currentAgent = this.graph.getEntryAgent();
    this.executionContext.setCurrentAgent(currentAgent);
    
    // Store user message
    await this.addMessage("user", userMessage);
    
    let shouldContinue = true;
    while (shouldContinue) {
      const result = await this.runAgentCycle(currentAgent);
      
      if (result.type === "handoff") {
        const handoff = result.handoff;
        
        // Log and notify
        await this.logHandoff(handoff);
        this.io.to(this.sessionId).emit("agent_handoff", handoff);
        
        // Switch agent
        currentAgent = this.graph.getAgent(handoff.toAgentId);
        this.executionContext.setCurrentAgent(currentAgent);
        
        // Add handoff context
        await this.addMessage("system", 
          `[Handoff: ${handoff.fromAgentName} → ${handoff.toAgentName}] ${handoff.reason}`
        );
        
        // Continue cycle with new agent
        continue;
      }
      
      shouldContinue = false;
    }
  }
  
  private async runAgentCycle(agent: Agent): Promise<AgentCycleResult> {
    // Build context
    const systemPrompt = await this.buildSystemPrompt(agent);
    const messages = await this.getMessageHistory();
    const tools = await this.getAgentTools(agent.id);
    
    // Stream to client
    const messageId = await this.addMessage("assistant", "");
    this.io.to(this.sessionId).emit("message_start", { messageId, agent });
    
    let fullResponse = "";
    let pendingToolCalls: ToolCall[] = [];
    
    // Stream from LLM
    const stream = this.gateway.streamCompletion({
      model: agent.modelPreference,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      tools: this.formatTools(tools),
      temperature: agent.temperature,
    });
    
    for await (const chunk of stream) {
      if (chunk.type === "content") {
        fullResponse += chunk.content;
        this.io.to(this.sessionId).emit("message_delta", {
          messageId,
          content: chunk.content,
        });
      }
      
      if (chunk.type === "tool_call") {
        // Queue tool execution (non-blocking)
        const toolCall = await this.queueToolExecution(chunk.toolCall, messageId);
        pendingToolCalls.push(toolCall);
        
        this.io.to(this.sessionId).emit("tool_pending", {
          messageId,
          toolName: chunk.toolCall.name,
          toolCallId: toolCall.id,
        });
      }
    }
    
    // Wait for all tool calls to complete
    for (const toolCall of pendingToolCalls) {
      const result = await this.waitForToolResult(toolCall.id);
      
      // Inject tool result and continue generation
      const continuation = await this.gateway.complete({
        model: agent.modelPreference,
        messages: [
          ...messages,
          { role: "assistant", content: fullResponse },
          { 
            role: "tool", 
            content: JSON.stringify(result),
            tool_call_id: toolCall.id 
          },
        ],
      });
      
      fullResponse += "\n" + continuation.content;
      this.io.to(this.sessionId).emit("message_delta", {
        messageId,
        content: "\n" + continuation.content,
      });
    }
    
    // Update message with final content
    await this.updateMessage(messageId, fullResponse);
    this.io.to(this.sessionId).emit("message_complete", { messageId });
    
    // Check for handoff
    const handoffResult = this.handoffDetector.evaluate({
      agent,
      response: fullResponse,
      graphNode: this.graph.getNode(agent.id),
    });
    
    if (handoffResult.shouldHandoff) {
      return {
        type: "handoff",
        handoff: handoffResult.handoff,
      };
    }
    
    return { type: "complete" };
  }
  
  private async buildSystemPrompt(agent: Agent): Promise<string> {
    const parts = [
      agent.systemPrompt,
      "",
      await contextInjector.getGenesisContext(),
    ];
    
    // Add relevant knowledge
    const knowledge = await this.getRelevantKnowledge(agent);
    if (knowledge.length > 0) {
      parts.push("", "[RELEVANT KNOWLEDGE]");
      parts.push(...knowledge.map(k => `- ${k.content}`));
    }
    
    return parts.join("\n");
  }
  
  private async queueToolExecution(
    toolCallDef: ToolCallDef,
    messageId: string
  ): Promise<ToolCall> {
    const toolCall: ToolCall = {
      id: generateUUID(),
      messageId,
      toolName: toolCallDef.name,
      arguments: toolCallDef.arguments,
      status: "pending",
    };
    
    await db.insert(toolCalls).values(toolCall);
    
    await this.toolQueue.add("execute-tool", {
      toolCallId: toolCall.id,
      toolName: toolCall.toolName,
      arguments: toolCall.arguments,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
    
    return toolCall;
  }
}
```

---

### 5.3 Flow: The Context Injector

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTEXT INJECTOR FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                              GENESIS ONBOARDING
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   generateAgentsFromGenesis() │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ contextInjector.cacheProfile()│
                    │  - Stores in IndexedDB        │
                    │  - Memory cache for speed     │
                    └───────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RUNTIME INJECTION                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Every Agent Invocation:                                                       │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ buildSystemPrompt(agent)                                                │   │
│   │ ─────────────────────────────────────────────────────────────────────   │   │
│   │                                                                          │   │
│   │ 1. Start with agent.systemPrompt (from DB)                              │   │
│   │                                                                          │   │
│   │ 2. Inject Genesis Context:                                              │   │
│   │    const genesis = contextInjector.getProfile()                         │   │
│   │                                                                          │   │
│   │    injectedContext = `                                                  │   │
│   │      [OMNI-PRIME USER CONTEXT]                                          │   │
│   │      ────────────────────────                                           │   │
│   │      User Role: ${genesis.useCase}                                      │   │
│   │      Expertise Level: ${genesis.skillLevel}                             │   │
│   │      Communication Style: ${genesis.contentTone}                        │   │
│   │      Work Style: ${genesis.workStyle}                                   │   │
│   │      Primary Objectives: ${genesis.objectives.join(', ')}               │   │
│   │      Preferred Tools: ${genesis.toolPreferences.join(', ')}             │   │
│   │      ────────────────────────                                           │   │
│   │      INSTRUCTION: Adapt your responses to match the user's expertise    │   │
│   │      level and work style. Use the preferred tools when relevant.       │   │
│   │      [END CONTEXT]                                                      │   │
│   │    `                                                                    │   │
│   │                                                                          │   │
│   │ 3. Inject Dynamic Context (if in Swarm):                                │   │
│   │    if (swarmContext) {                                                  │   │
│   │      injectedContext += swarmContext.getHandoffHistory()                │   │
│   │    }                                                                    │   │
│   │                                                                          │   │
│   │ 4. Final Prompt = systemPrompt + "\n\n" + injectedContext               │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│                        ┌───────────────────────┐                                │
│                        │  UnifiedGateway.call  │                                │
│                        │  (LLM Invocation)     │                                │
│                        └───────────────────────┘                                │
│                                    │                                            │
│                                    ▼                                            │
│                        ┌───────────────────────┐                                │
│                        │  Context-Aware        │                                │
│                        │  Response Generated   │                                │
│                        └───────────────────────┘                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**ContextInjector Implementation:**

```typescript
// src/lib/ai/contextInjector.ts

interface CachedProfile {
  data: GenesisData;
  timestamp: number;
}

class ContextInjector {
  private cache: CachedProfile | null = null;
  private readonly CACHE_KEY = "omni_prime_genesis_profile";
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  async initialize(): Promise<void> {
    // Load from IndexedDB on startup
    const stored = await dexie.genesisProfile.get(this.CACHE_KEY);
    if (stored && Date.now() - stored.timestamp < this.CACHE_TTL) {
      this.cache = stored;
    }
  }
  
  async cacheProfile(data: GenesisData): Promise<void> {
    this.cache = { data, timestamp: Date.now() };
    await dexie.genesisProfile.put({
      id: this.CACHE_KEY,
      data,
      timestamp: Date.now(),
    });
  }
  
  getProfile(): GenesisData | null {
    return this.cache?.data ?? null;
  }
  
  getGenesisContext(): string {
    if (!this.cache?.data) {
      return ""; // No genesis data - neutral behavior
    }
    
    const g = this.cache.data;
    
    // Dynamic prompt engineering based on profile
    const expertiseGuidance = this.getExpertiseGuidance(g.skillLevel);
    const toneGuidance = this.getToneGuidance(g.contentTone);
    
    return `
[OMNI-PRIME USER CONTEXT]
${"─".repeat(40)}
Identity Profile:
• Role: ${g.useCase}
• Expertise: ${g.skillLevel}
• Work Style: ${g.workStyle}
• Communication: ${g.contentTone}

Primary Objectives:
${g.objectives.map(o => `• ${o}`).join("\n")}

${expertiseGuidance}
${toneGuidance}
${"─".repeat(40)}
[END CONTEXT]
    `.trim();
  }
  
  private getExpertiseGuidance(level: string): string {
    const guidance: Record<string, string> = {
      beginner: "GUIDANCE: Explain concepts thoroughly. Avoid jargon. Offer step-by-step instructions.",
      intermediate: "GUIDANCE: Balance technical depth with accessibility. Assume familiarity with basics.",
      expert: "GUIDANCE: Be concise and technical. Skip basic explanations. Focus on edge cases and optimization.",
    };
    return guidance[level] || "";
  }
  
  private getToneGuidance(tone: string): string {
    const guidance: Record<string, string> = {
      professional: "TONE: Formal, business-appropriate, clear and direct.",
      casual: "TONE: Friendly, conversational, approachable.",
      technical: "TONE: Precise, use domain terminology, structured.",
      creative: "TONE: Expressive, use analogies, engaging and inspiring.",
    };
    return guidance[tone] || "";
  }
}

export const contextInjector = new ContextInjector();
```

---

## 6. PWA + CAPACITOR CONFIGURATION

### 6.1 next-pwa Configuration

```javascript
// next.config.js

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/localhost:11434\/.*/i,
      handler: "NetworkOnly", // Don't cache Ollama calls
    },
    {
      urlPattern: /\.(js|css|woff2|png|jpg|jpeg|svg|gif)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/api\/(chat|agents|swarm).*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
```

### 6.2 Manifest.json

```json
// public/manifest.json

{
  "name": "OMNI-PRIME",
  "short_name": "OMNI",
  "description": "Your Sovereign Pocket Enterprise",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#7c3aed",
  "orientation": "portrait",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["productivity", "utilities"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### 6.3 Capacitor Configuration

```typescript
// capacitor.config.ts

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.omniprime.app",
  appName: "OMNI-PRIME",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: true, // Allow HTTP for local Ollama
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      releaseType: "APK",
    },
    allowMixedContent: true, // For local Ollama HTTP access
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
```

---

## 7. MOBILE-RESPONSIVE ADAPTATIONS

### 7.1 Layout Strategy

```typescript
// src/components/layout/SafeAreaProvider.tsx

export function SafeAreaProvider({ children }: { children: React.ReactNode }) {
  const { safeAreaTop, safeAreaBottom } = useSafeArea();
  
  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{
        paddingTop: safeAreaTop,
        paddingBottom: safeAreaBottom,
      }}
    >
      {children}
    </div>
  );
}

// src/components/layout/DesktopShell.tsx

export function DesktopShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left: Sidebar (collapsible) */}
      <Sidebar className="w-64 shrink-0 border-r border-white/10" />
      
      {/* Center: Active Feed (flexible) */}
      <main className="flex-1 overflow-hidden">
        <ActiveFeed />
      </main>
      
      {/* Right: Agent Context (resizable, min 280px) */}
      <AgentContext className="w-80 shrink-0 border-l border-white/10" />
    </div>
  );
}

// src/components/layout/MobileShell.tsx

export function MobileShell() {
  const [activeTab, setActiveTab] = useState<"feed" | "agents" | "tools" | "settings">("feed");
  
  return (
    <div className="flex flex-col h-screen">
      {/* Top: Safe area + Header */}
      <TopBar className="shrink-0" />
      
      {/* Main content (swipeable views) */}
      <main className="flex-1 overflow-hidden relative">
        <SwipeableViews index={activeTab} onChangeIndex={setActiveTab}>
          <ActiveFeed key="feed" />
          <AgentDirectory key="agents" />
          <ToolRegistry key="tools" />
          <Settings key="settings" />
        </SwipeableViews>
      </main>
      
      {/* Bottom: Navigation (with safe area) */}
      <MobileNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        className="shrink-0 pb-safe" 
      />
    </div>
  );
}
```

### 7.2 Touch Optimizations

```css
/* globals.css additions */

@layer utilities {
  /* Safe area support */
  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .px-safe {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  
  /* Touch targets (min 44px per Apple HIG) */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Momentum scrolling */
  .scroll-momentum {
    -webkit-overflow-scrolling: touch;
    overflow-y: scroll;
  }
  
  /* Disable text selection on UI elements */
  .no-select {
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Glass morphism for mobile */
  .glass-mobile {
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
}
```

---

## 8. SECURITY & SOVEREIGNTY CONSIDERATIONS

### 8.1 Data Sovereignty

| Data Type | Storage | Encryption | Sync |
|-----------|---------|------------|------|
| Agent Definitions | SQLite (local) | SQLCipher (optional) | None (local-first) |
| Chat History | SQLite (local) | SQLCipher (optional) | User-controlled export |
| Knowledge Base | OPFS + ChromaDB | At-rest (optional) | None |
| API Keys (Cloud) | Keychain/Credential Manager | OS-level | None |
| Genesis Profile | IndexedDB | No (non-sensitive) | None |

### 8.2 MCP Tool Sandboxing

```typescript
// src/lib/mcp/MCPServerManager.ts

interface MCPSandboxConfig {
  allowedDomains?: string[];      // For HTTP tools
  fileSystemScope?: string;       // Chroot-like restriction
  networkEnabled: boolean;
  maxExecutionTime: number;
}

export class MCPServerManager {
  private sandboxes: Map<string, MCPSandboxConfig> = new Map();
  
  async startServer(serverDef: MCPServerDef): Promise<MCPClient> {
    // Apply default sandbox restrictions
    const sandbox: MCPSandboxConfig = {
      allowedDomains: [],
      networkEnabled: false,
      maxExecutionTime: 30000, // 30s default
      ...serverDef.sandboxConfig,
    };
    
    const client = new MCPClient({
      transport: serverDef.transport,
      // Apply sandbox to all tool executions
      toolExecutor: (toolName, args) => this.sandboxedExecute(
        toolName, 
        args, 
        sandbox
      ),
    });
    
    await client.connect();
    this.sandboxes.set(serverDef.id, sandbox);
    
    return client;
  }
  
  private async sandboxedExecute(
    toolName: string,
    args: any,
    sandbox: MCPSandboxConfig
  ): Promise<any> {
    // Timeout enforcement
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Tool execution timeout")), 
      sandbox.maxExecutionTime)
    );
    
    // Domain check for HTTP tools
    if (args.url && sandbox.allowedDomains) {
      const url = new URL(args.url);
      if (!sandbox.allowedDomains.includes(url.hostname)) {
        throw new Error(`Domain ${url.hostname} not in allowed list`);
      }
    }
    
    return Promise.race([
      this.executeTool(toolName, args),
      timeoutPromise,
    ]);
  }
}
```

---

## 9. DEPLOYMENT ARCHITECTURE

### 9.1 Docker Compose (Development)

```yaml
# docker-compose.yml

version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./data/omni.db
      - REDIS_URL=redis://redis:6379
      - OLLAMA_URL=http://host.docker.internal:11434
    volumes:
      - ./data:/app/data
      - chroma-data:/app/chroma
    networks:
      - omni-network
    extra_hosts:
      - "host.docker.internal:host-gateway"

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - omni-network

  # Optional: Chroma as separate service (if not embedded)
  chroma:
    image: chromadb/chroma:latest
    volumes:
      - chroma-data:/chroma/chroma
    networks:
      - omni-network

volumes:
  redis-data:
  chroma-data:

networks:
  omni-network:
    driver: bridge
```

### 9.2 Production Build Flow

```bash
# Build PWA
npm run build

# Add Capacitor platforms (first time only)
npx cap add android
npx cap add ios

# Sync web build to native projects
npx cap sync

# Open in Android Studio / Xcode for signing & deployment
npx cap open android
npx cap open ios
```

---

## 10. APPENDIX: NAMING CONVENTIONS

| Category | Convention | Examples |
|----------|------------|----------|
| Components | PascalCase | `AgentCard.tsx`, `SwarmBuilder.tsx` |
| Hooks | camelCase, prefix `use` | `useAgents.ts`, `useSwarm.ts` |
| Stores | camelCase, suffix `Store` | `agentStore.ts`, `chatStore.ts` |
| API Routes | kebab-case | `execute/route.ts`, `handoff/route.ts` |
| Database Tables | snake_case | `user_profiles`, `agent_tools` |
| Types/Interfaces | PascalCase | `Agent`, `SwarmGraphNode` |
| Environment Vars | UPPER_SNAKE | `OLLAMA_URL`, `REDIS_URL` |

---

## 11. SIGN-OFF

**Blueprint Status:** COMPLETE  
**Mode:** CHIMERA (Synthesis)  
**Target:** OMNI-PRIME - Sovereign Pocket Enterprise  
**Components Fused:** Sintra.ai (Visual) + OpenClaw (Tools) + Character.ai (Persona)  

**Architecture Gate:** AWAITING ADMIN APPROVAL  

> **WARNING:** Per The Prime Directive, no implementation code shall be generated until explicit Admin approval of this `system-architecture.md` is received.

**Admin Action Required:**
- [ ] Review architecture
- [ ] Request modifications (if any)
- [ ] **APPROVE** → Begin Phase 3: Fabrication
