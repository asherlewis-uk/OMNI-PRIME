// ═══════════════════════════════════════════════════════════════════════════════
// AGENT DETAIL API - Get, Update, Delete specific agent
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { agents, agentTools, agentKnowledge } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UpdateAgentPayload } from "@/types/agent";
import crypto from "crypto";

interface RouteParams {
  params: {
    agentId: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/agents/[agentId] - Get agent details
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    const db = await getDB();

    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        tools: {
          with: {
            tool: {
              with: {
                server: true,
              },
            },
          },
        },
        knowledge: {
          with: {
            document: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[Agent Detail API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get agent" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/agents/[agentId] - Update agent
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    const body = (await request.json()) as UpdateAgentPayload;

    const db = await getDB();

    // Check if agent exists
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Partial<typeof agents.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.avatar !== undefined) updates.avatar = body.avatar;
    if (body.description !== undefined) updates.description = body.description;
    if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt;
    if (body.temperature !== undefined) updates.temperature = body.temperature;
    if (body.modelPreference !== undefined) updates.modelPreference = body.modelPreference;
    if (body.voiceId !== undefined) updates.voiceId = body.voiceId;

    // Update agent
    await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, agentId));

    // Update tool assignments if provided
    if (body.toolIds !== undefined) {
      // Remove existing assignments
      await db
        .delete(agentTools)
        .where(eq(agentTools.agentId, agentId));

      // Add new assignments
      for (const toolId of body.toolIds) {
        await db.insert(agentTools).values({
          id: crypto.randomUUID(),
          agentId,
          toolId,
          config: {},
          isEnabled: true,
        });
      }
    }

    // Update knowledge assignments if provided
    if (body.knowledgeDocIds !== undefined) {
      // Remove existing assignments
      await db
        .delete(agentKnowledge)
        .where(eq(agentKnowledge.agentId, agentId));

      // Add new assignments
      for (const docId of body.knowledgeDocIds) {
        await db.insert(agentKnowledge).values({
          id: crypto.randomUUID(),
          agentId,
          docId,
        });
      }
    }

    // Fetch updated agent
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
      with: {
        tools: {
          with: {
            tool: {
              with: {
                server: true,
              },
            },
          },
        },
        knowledge: {
          with: {
            document: true,
          },
        },
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[Agent Detail API] Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/agents/[agentId] - Delete agent
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = params;
    const db = await getDB();

    // Check if agent exists
    const existing = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Delete agent (cascades to agent_tools and agent_knowledge)
    await db.delete(agents).where(eq(agents.id, agentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Agent Detail API] Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
