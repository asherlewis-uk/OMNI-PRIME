// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STREAM API — Server-Sent Events for Real-time Streaming
// POST /api/chat/stream
//
// Server-side only. Uses the SQLite-backed contextInjector (no Dexie).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getDB } from "@/lib/db/client";
import {
  messages,
  chatSessions,
  agents,
  toolCalls,
  mcpTools,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { unifiedGateway } from "@/lib/ai/unifiedGateway";
import { contextInjector } from "@/lib/ai/contextInjector";
import { toolRegistry } from "@/lib/mcp/toolRegistry";
import { addToolExecutionJob } from "@/lib/queue/queues";
import type { GatewayStreamChunk } from "@/lib/ai/unifiedGateway";

// ─── SSE Response Builder ────────────────────────────────────────────────────

function createSSEResponse(
  generator: AsyncGenerator<string>,
  onClose?: () => void,
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

// ─── POST /api/chat/stream ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { sessionId?: string; content?: string };
  try {
    body = (await request.json()) as { sessionId?: string; content?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessionId, content: userMessage } = body;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!userMessage) {
    return new Response(JSON.stringify({ error: "content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const abortController = new AbortController();

  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const generator = streamConversation(
    sessionId,
    userMessage,
    abortController.signal,
  );

  return createSSEResponse(generator, () => {
    abortController.abort();
  });
}

// ─── Stream Generator ────────────────────────────────────────────────────────

async function* streamConversation(
  sessionId: string,
  userMessage: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const db = getDB();
  const assistantMessageId = uuidv4();

  try {
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: { agent: true },
    });

    if (!session || !session.agent) {
      yield `data: ${JSON.stringify({
        type: "error",
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session or agent not found",
        },
      })}\n\n`;
      return;
    }

    const userMessageId = uuidv4();
    await db.insert(messages).values({
      id: userMessageId,
      sessionId,
      role: "user",
      content: userMessage,
      metadata: {},
      isComplete: true,
    });

    const agentTools = await toolRegistry.getAgentTools(session.agent.id);
    const availableTools = toolRegistry.convertToGatewayTools(agentTools);

    await contextInjector.ensureLoaded();
    const systemPrompt = contextInjector.buildSystemPrompt(
      session.agent.systemPrompt,
    );

    const messageHistory = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [desc(messages.createdAt)],
      limit: 10,
    });

    const history = messageHistory.reverse().map((m) => ({
      role: m.role as "user" | "assistant" | "system" | "tool",
      content: m.content,
    }));

    yield `data: ${JSON.stringify({
      type: "start",
      id: assistantMessageId,
      sessionId,
      messageId: assistantMessageId,
      timestamp: Date.now(),
    })}\n\n`;

    let fullContent = "";
    const pendingToolCalls: { id: string; name: string; arguments: string }[] =
      [];

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
      if (signal.aborted) break;

      switch (chunk.type) {
        case "content":
          if (chunk.content) {
            fullContent += chunk.content;
            yield `data: ${JSON.stringify({
              type: "content",
              id: assistantMessageId,
              sessionId,
              messageId: assistantMessageId,
              content: chunk.content,
              timestamp: Date.now(),
            })}\n\n`;
          }
          break;

        case "tool_call":
          if (chunk.toolCall) {
            pendingToolCalls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            });

            yield `data: ${JSON.stringify({
              type: "tool_call",
              id: assistantMessageId,
              sessionId,
              messageId: assistantMessageId,
              toolCall: {
                id: chunk.toolCall.id,
                toolName: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              },
              timestamp: Date.now(),
            })}\n\n`;

            const tool = await db.query.mcpTools.findFirst({
              where: eq(mcpTools.name, chunk.toolCall.name),
            });

            if (tool) {
              const toolCallId = uuidv4();
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(
                  chunk.toolCall.arguments || "{}",
                ) as Record<string, unknown>;
              } catch {
                parsedArgs = {};
              }

              await db.insert(toolCalls).values({
                id: toolCallId,
                messageId: assistantMessageId,
                toolId: tool.id,
                toolName: chunk.toolCall.name,
                arguments: parsedArgs,
                status: "pending",
              });

              await addToolExecutionJob({
                toolCallId,
                serverId: tool.serverId,
                toolName: chunk.toolCall.name,
                arguments: parsedArgs,
                sessionId,
                messageId: assistantMessageId,
                requestId: uuidv4(),
              });
            }
          }
          break;

        case "error":
          yield `data: ${JSON.stringify({
            type: "error",
            id: assistantMessageId,
            sessionId,
            messageId: assistantMessageId,
            error: chunk.error ?? { code: "UNKNOWN", message: "Unknown error" },
            timestamp: Date.now(),
          })}\n\n`;
          return;

        case "done":
          break;
      }
    }

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

    await db
      .update(chatSessions)
      .set({
        messageCount: session.messageCount + 2,
        lastMessageAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    await db
      .update(agents)
      .set({
        totalMessages: session.agent.totalMessages + 1,
        lastActiveAt: new Date(),
      })
      .where(eq(agents.id, session.agent.id));

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
