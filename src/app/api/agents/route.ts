import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { agents, userProfiles } from "@/lib/db/schema";
import { z } from "zod";
import { desc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  systemPrompt: z.string().min(1).max(2000),
  model: z.string().min(1).max(50),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(2048),
  tools: z.array(z.string()).default([]),
});

const updateAgentSchema = createAgentSchema.partial();

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/agents - List all agents
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const allAgents = await db.query.agents.findMany({
      orderBy: [desc(agents.createdAt)],
    });

    return NextResponse.json({ agents: allAgents });
  } catch (error) {
    console.error("[AGENTS_GET] Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/agents - Create new agent
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createAgentSchema.parse(body);

    // Get a user profile to associate the agent with.
    const userProfile = await db.query.userProfiles.findFirst();
    if (!userProfile) {
      return NextResponse.json(
        { error: "No user profile found. Please complete onboarding first." },
        { status: 400 }
      );
    }

    // Create agent in database
    const [agent] = await db
      .insert(agents)
      .values({
        ownerId: userProfile.id, // Use the fetched profile ID
        name: validatedData.name,
        description: validatedData.description,
        systemPrompt: validatedData.systemPrompt,
        modelPreference: validatedData.model,
        temperature: validatedData.temperature,
        status: "active",
      })
      .returning();

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("[AGENTS_POST] Error creating agent:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
