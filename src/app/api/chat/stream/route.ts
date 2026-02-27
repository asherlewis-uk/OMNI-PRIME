// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STREAM API - Server-Sent Events for Real-time Streaming
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { getDB } from "@/lib/db/client";
import { messages, chatSessions, agents, toolCalls, mcpTools } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { unifiedGateway } from "@/lib/ai/unifiedGateway";
import { contextInjector } from "@/lib/ai/contextInjector";
import { toolRegistry } from "@/lib/mcp/toolRegistry";
import { addToolExecutionJob } from "@/lib/queue/queues";
import type { GatewayStreamChunk } from "@/lib/ai/unifiedGateway";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// SSE RESPONSE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function createSSEResponse(
  generator: AsyncGenerator<string>,
  onClose?: () => void
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        console.error("[Stream] Error:", error);
        controller.error(error);
      }
    },
    cancel() {
      onClose?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/chat/stream - SSE endpoint for streaming responses
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const userMessage = searchParams.get("message");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "sessionId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!userMessage) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const abortController = new AbortController();
  const signal = abortController.signal;

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const generator = streamConversation(sessionId, userMessage, signal);

  return createSSEResponse(generator, () => {
    abortController.abort();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAM GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

async function* streamConversation(
  sessionId: string,
  userMessage: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const db = await getDB();
  const assistantMessageId = crypto.randomUUID();

  try {
    // Get session with agent
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        agent: true,
      },
    });

    if (!session || !session.agent) {
      yield `data: ${JSON.stringify({
        type: "error",
        error: { code: "SESSION_NOT_FOUND", message: "Session or agent not found" },
      })}\n\n`;
      return;
    }

    // Save user message
    const userMessageId = crypto.randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      sessionId,
      role: "user",
      content: userMessage,
      metadata: {},
      isComplete: true,
    });

    // Get agent's tools
    const agentTools = await toolRegistry.getAgentTools(session.agent.id);
    const availableTools = toolRegistry.convertToGatewayTools(agentTools);

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

    // Send start event
    yield `data: ${JSON.stringify({
      type: "start",
      id: assistantMessageId,
      sessionId,
      messageId: assistantMessageId,
      timestamp: Date.now(),
    })}\n\n`;

    // Initialize assistant message
    let fullContent = "";
    const pendingToolCalls: {
      id: string;
      name: string;
      arguments: string;
    }[] = [];

    // Stream from LLM
    const stream = unifiedGateway.streamCompletion({
      model: session.agent.modelPreference,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      tools: availableTools.length > 0 ? availableTools : undefined,
      temperature: session.agent.temperature,
      signal,
    });

    for await (const chunk of stream) {
      if (signal.aborted) {
        break;
      }

      const sseChunk = convertToSSEChunk(chunk, assistantMessageId, sessionId);

      switch (chunk.type) {
        case "content":
          if (chunk.content) {
            fullContent += chunk.content;
            yield `data: ${JSON.stringify(sseChunk)}\n\n`;
          }
          break;

        case "tool_call":
          if (chunk.toolCall) {
            pendingToolCalls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            });

            // Send tool_call event
            yield `data: ${JSON.stringify({
              type: "tool_call",
              id: assistantMessageId,
              sessionId,
              messageId: assistantMessageId,
              toolCall: {
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              },
              timestamp: Date.now(),
            })}\n\n`;

            // Queue tool execution
            const tool = await db.query.mcpTools.findFirst({
              where: eq(mcpTools.name, chunk.toolCall.name),
            });

            if (tool) {
              const toolCallId = crypto.randomUUID();
              await db.insert(toolCalls).values({
                id: toolCallId,
                messageId: assistantMessageId,
                toolId: tool.id,
                toolName: chunk.toolCall.name,
                arguments: JSON.parse(chunk.toolCall.arguments || "{}"),
                status: "pending",
              });

              await addToolExecutionJob({
                toolCallId,
                serverId: tool.serverId,
                toolName: chunk.toolCall.name,
                arguments: JSON.parse(chunk.toolCall.arguments || "{}"),
                sessionId,
                messageId: assistantMessageId,
                requestId: crypto.randomUUID(),
              });

              // Send tool_pending event
              yield `data: ${JSON.stringify({
                type: "tool_pending",
                id: assistantMessageId,
                sessionId,
                messageId: assistantMessageId,
                toolCall: {
                  id: toolCallId,
                  toolName: chunk.toolCall.name,
                },
                timestamp: Date.now(),
              })}\n\n`;
            }
          }
          break;

        case "error":
          yield `data: ${JSON.stringify(sseChunk)}\n\n`;
          return;

        case "done":
          break;
      }
    }

    // Save assistant message to database
    await db.insert(messages).values({
      id: assistantMessageId,
      sessionId,
      role: "assistant",
      content: fullContent,
      agentId: session.agent.id,
      metadata: {
        hasToolCalls: pendingToolCalls.length > 0,
        toolCallIds: pendingToolCalls.map((tc) => tc.id),
      },
      isComplete: true,
    });

    // Update session
    await db
      .update(chatSessions)
      .set({
        messageCount: session.messageCount + 2,
        lastMessageAt: new Date(),
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

    // Send complete event
    yield `data: ${JSON.stringify({
      type: "complete",
      id: assistantMessageId,
      sessionId,
      messageId: assistantMessageId,
      timestamp: Date.now(),
    })}\n\n`;

  } catch (error) {
    console.error("[Stream] Error:", error);

    yield `data: ${JSON.stringify({
      type: "error",
      id: assistantMessageId,
      sessionId,
      messageId: assistantMessageId,
      error: {
        code: "STREAM_ERROR",
        message: error instanceof Error ? error.message : "Stream failed",
      },
      timestamp: Date.now(),
    })}\n\n`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function convertToSSEChunk(
  chunk: GatewayStreamChunk,
  messageId: string,
  sessionId: string
): {
  type: string;
  id: string;
  sessionId: string;
  messageId: string;
  content?: string;
  error?: { code: string; message: string };
  metadata?: { model?: string; provider?: string };
  timestamp: number;
} {
  const base = {
    id: messageId,
    sessionId,
    messageId,
    timestamp: Date.now(),
  };

  switch (chunk.type) {
    case "content":
      return {
        ...base,
        type: "content",
        content: chunk.content,
      };

    case "error":
      return {
        ...base,
        type: "error",
        error: chunk.error ?? { code: "UNKNOWN", message: "Unknown error" },
      };

    case "done":
      return {
        ...base,
        type: "complete",
        metadata: chunk.finishReason ? { model: undefined, provider: undefined } : undefined,
      };

    default:
      return {
        ...base,
        type: chunk.type,
      };
  }
}
