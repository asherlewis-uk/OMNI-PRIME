// ═══════════════════════════════════════════════════════════════════════════════
// CHAT API - Conversation Management
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { messages, chatSessions, agents, toolCalls, mcpTools } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { unifiedGateway } from "@/lib/ai/unifiedGateway";
import { contextInjector } from "@/lib/ai/contextInjector";
import { toolRegistry } from "@/lib/mcp/toolRegistry";
import { addToolExecutionJob } from "@/lib/queue/queues";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/chat - List chat sessions
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const db = await getDB();

    const query = db.query.chatSessions.findMany({
      where: agentId ? eq(chatSessions.agentId, agentId) : undefined,
      with: {
        agent: true,
        swarm: true,
      },
      orderBy: [desc(chatSessions.lastMessageAt)],
      limit,
      offset,
    });

    const sessions = await query;

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[Chat API] Error listing sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/chat - Create session or send message
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create-session":
        return createSession(body);
      case "send-message":
        return sendMessage(body);
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE SESSION
// ═══════════════════════════════════════════════════════════════════════════════

async function createSession(body: {
  agentId?: string;
  swarmId?: string;
  title?: string;
}) {
  const { agentId, swarmId, title } = body;

  if (!agentId && !swarmId) {
    return NextResponse.json(
      { error: "Either agentId or swarmId is required" },
      { status: 400 }
    );
  }

  try {
    const db = await getDB();

    // Get system user profile
    const profile = await db.query.userProfiles.findFirst();
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const sessionId = crypto.randomUUID();

    await db.insert(chatSessions).values({
      id: sessionId,
      ownerId: profile.id,
      agentId: agentId ?? null,
      swarmId: swarmId ?? null,
      title: title ?? "New Conversation",
      messageCount: 0,
      isArchived: false,
    });

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        agent: true,
        swarm: true,
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("[Chat API] Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

async function sendMessage(body: {
  sessionId: string;
  content: string;
  stream?: boolean;
}) {
  const { sessionId, content } = body;

  if (!sessionId || !content) {
    return NextResponse.json(
      { error: "sessionId and content are required" },
      { status: 400 }
    );
  }

  try {
    const db = await getDB();

    // Get session with agent
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        agent: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Save user message
    const userMessageId = crypto.randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      sessionId,
      role: "user",
      content,
      metadata: {},
      isComplete: true,
    });

    // Update session message count
    await db
      .update(chatSessions)
      .set({
        messageCount: session.messageCount + 1,
        lastMessageAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    // Get agent's tools
    let availableTools: Awaited<ReturnType<typeof toolRegistry.convertToGatewayTools>> = [];
    if (session.agent) {
      const agentTools = await toolRegistry.getAgentTools(session.agent.id);
      availableTools = toolRegistry.convertToGatewayTools(agentTools);
    }

    // Generate assistant message ID (for streaming reference)
    const assistantMessageId = crypto.randomUUID();

    // For non-streaming response (immediate execution)
    if (session.agent) {
      // Build system prompt with context injection
      const systemPrompt = contextInjector.buildSystemPrompt(
        session.agent.systemPrompt
      );

      // Get message history
      const messageHistory = await db.query.messages.findMany({
        where: eq(messages.sessionId, sessionId),
        orderBy: [desc(messages.createdAt)],
        limit: 10,
      });

      const history = messageHistory
        .reverse()
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system" | "tool",
          content: m.content,
        }));

      // Call LLM
      const response = await unifiedGateway.complete({
        model: session.agent.modelPreference,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content },
        ],
        tools: availableTools.length > 0 ? availableTools : undefined,
        temperature: session.agent.temperature,
      });

      // Handle tool calls if any
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          // Find the tool
          const tool = await db.query.mcpTools.findFirst({
            where: eq(mcpTools.name, tc.name),
          });

          if (tool) {
            // Create tool call record
            const toolCallId = crypto.randomUUID();
            await db.insert(toolCalls).values({
              id: toolCallId,
              messageId: assistantMessageId,
              toolId: tool.id,
              toolName: tc.name,
              arguments: tc.arguments,
              status: "pending",
            });

            // Queue tool execution
            await addToolExecutionJob({
              toolCallId,
              serverId: tool.serverId,
              toolName: tc.name,
              arguments: tc.arguments,
              sessionId,
              messageId: assistantMessageId,
              requestId: crypto.randomUUID(),
            });
          }
        }
      }

      // Save assistant message
      await db.insert(messages).values({
        id: assistantMessageId,
        sessionId,
        role: "assistant",
        content: response.content,
        agentId: session.agent.id,
        metadata: {
          provider: response.provider,
          model: response.model,
          hasToolCalls: response.toolCalls && response.toolCalls.length > 0,
          toolCallIds: response.toolCalls?.map(() => crypto.randomUUID()),
        },
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        isComplete: true,
      });

      // Update session
      await db
        .update(chatSessions)
        .set({
          messageCount: session.messageCount + 2,
          lastMessageAt: new Date(),
          modelUsed: response.model,
        })
        .where(eq(chatSessions.id, sessionId));

      // Update agent stats
      await db
        .update(agents)
        .set({
          totalMessages: session.agent.totalMessages + 1,
          lastActiveAt: new Date(),
        })
        .where(eq(agents.id, session.agent.id));

      return NextResponse.json({
        message: {
          id: assistantMessageId,
          content: response.content,
          role: "assistant",
          hasToolCalls: response.toolCalls && response.toolCalls.length > 0,
        },
        toolCalls: response.toolCalls,
        usage: response.usage,
      });
    }

    // Return placeholder for streaming
    return NextResponse.json({
      messageId: assistantMessageId,
      streamUrl: `/api/chat/stream?sessionId=${sessionId}&messageId=${assistantMessageId}`,
    });
  } catch (error) {
    console.error("[Chat API] Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
