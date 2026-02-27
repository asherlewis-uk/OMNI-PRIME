// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS API — CRUD for AI Agent Definitions
// GET  /api/agents     → List all agents
// POST /api/agents     → Create new agent (aligned with CreateAgentPayload)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { agents, agentTools } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

// ─── Validation Schemas (aligned with CreateAgentPayload from @/types/agent) ─

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  avatar: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(10000),
  temperature: z.number().min(0).max(2).default(0.7),
  modelPreference: z.string().min(1).max(100).default("ollama/llama3.1"),
  voiceId: z.string().max(100).optional(),
  toolIds: z.array(z.string()).default([]),
  knowledgeDocIds: z.array(z.string()).default([]),
});

// ─── GET /api/agents ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const db = getDB();

    const allAgents = await db.query.agents.findMany({
      orderBy: [desc(agents.createdAt)],
      with: {
        tools: {
          with: { tool: true },
        },
      },
    });

    return NextResponse.json({ agents: allAgents });
  } catch (error) {
    console.error("[AGENTS_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}

// ─── POST /api/agents ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const db = getDB();
    const body = await request.json();
    const data = createAgentSchema.parse(body);

    const userProfile = await db.query.userProfiles.findFirst();
    if (!userProfile) {
      return NextResponse.json(
        { error: "No user profile found. Please complete onboarding first." },
        { status: 400 },
      );
    }

    const [agent] = await db
      .insert(agents)
      .values({
        ownerId: userProfile.id,
        name: data.name,
        avatar: data.avatar ?? null,
        description: data.description ?? null,
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        modelPreference: data.modelPreference,
        voiceId: data.voiceId ?? null,
        status: "active",
      })
      .returning();

    if (!agent) {
      return NextResponse.json(
        { error: "Failed to create agent" },
        { status: 500 },
      );
    }

    if (data.toolIds.length > 0) {
      const toolBindings = data.toolIds.map((toolId) => ({
        agentId: agent.id,
        toolId,
        config: {},
        isEnabled: true,
      }));

      await db.insert(agentTools).values(toolBindings);
    }

    const createdAgent = await db.query.agents.findFirst({
      where: (a, { eq }) => eq(a.id, agent.id),
      with: {
        tools: {
          with: { tool: true },
        },
      },
    });

    return NextResponse.json({ agent: createdAgent }, { status: 201 });
  } catch (error) {
    console.error("[AGENTS_POST]", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}
