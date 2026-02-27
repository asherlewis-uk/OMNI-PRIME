// ═══════════════════════════════════════════════════════════════════════════════
// TOOL WORKER - Background Tool Execution via BullMQ
// ═══════════════════════════════════════════════════════════════════════════════

import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import type { ToolExecutionJob } from "../queues";
import { mcpServerManager } from "@/lib/mcp/MCPServerManager";
import { getDB } from "@/lib/db/client";
import { toolCalls, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let toolWorker: Worker<ToolExecutionJob> | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process a tool execution job.
 */
async function processToolJob(
  job: Job<ToolExecutionJob>
): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}> {
  const {
    toolCallId,
    serverId,
    toolName,
    arguments: toolArgs,
    sessionId,
    messageId,
    requestId,
  } = job.data;

  const startTime = Date.now();

  console.log(`[ToolWorker] Starting execution: ${toolName} (job: ${job.id})`);

  try {
    // 1. Update tool call status to "running"
    await updateToolCallStatus(toolCallId, "running");

    // 2. Report progress
    await job.updateProgress({
      status: "started",
      message: `Executing ${toolName}...`,
      percentComplete: 10,
    });

    // 3. Ensure server is connected
    const client = await mcpServerManager.getClient(serverId);
    if (!client) {
      throw new Error(`MCP server ${serverId} is not available`);
    }

    await job.updateProgress({
      status: "in_progress",
      message: `Connected to server, calling ${toolName}...`,
      percentComplete: 30,
    });

    // 4. Execute the tool with sandboxing
    const result = await mcpServerManager.executeTool(
      serverId,
      toolName,
      toolArgs,
      async (progress) => {
        await job.updateProgress({
          status: progress.status,
          message: progress.message,
          percentComplete: progress.percentComplete
            ? 30 + progress.percentComplete * 0.6
            : undefined,
        });
      }
    );

    // 5. Update tool call with result
    await job.updateProgress({
      status: "completed",
      message: "Updating database...",
      percentComplete: 95,
    });

    if (result.success) {
      await updateToolCallSuccess(
        toolCallId,
        result.result,
        result.executionTimeMs
      );

      // Update message metadata to indicate tool completion
      await updateMessageToolStatus(messageId, toolCallId, "completed");

      console.log(
        `[ToolWorker] Completed: ${toolName} (${result.executionTimeMs}ms)`
      );

      return {
        success: true,
        result: result.result,
        executionTimeMs: result.executionTimeMs,
      };
    } else {
      await updateToolCallError(
        toolCallId,
        result.error ?? "Unknown error",
        result.executionTimeMs
      );

      await updateMessageToolStatus(messageId, toolCallId, "error", result.error);

      console.error(`[ToolWorker] Failed: ${toolName} - ${result.error}`);

      return {
        success: false,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Tool execution failed";
    const executionTimeMs = Date.now() - startTime;

    console.error(`[ToolWorker] Error: ${toolName} - ${errorMessage}`);

    // Update database with error
    await updateToolCallError(toolCallId, errorMessage, executionTimeMs);
    await updateMessageToolStatus(messageId, toolCallId, "error", errorMessage);

    // Re-throw to mark job as failed for retry
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update tool call status.
 */
async function updateToolCallStatus(
  toolCallId: string,
  status: "pending" | "running" | "completed" | "error"
): Promise<void> {
  try {
    const db = getDB();
    await db
      .update(toolCalls)
      .set({
        status,
        startedAt: status === "running" ? new Date() : undefined,
      })
      .where(eq(toolCalls.id, toolCallId));
  } catch (error) {
    console.error("[ToolWorker] Failed to update tool call status:", error);
  }
}

/**
 * Update tool call with success result.
 */
async function updateToolCallSuccess(
  toolCallId: string,
  result: unknown,
  executionTimeMs: number
): Promise<void> {
  try {
    const db = getDB();
    await db
      .update(toolCalls)
      .set({
        status: "completed",
        result: JSON.stringify(result),
        executedAt: new Date(),
      })
      .where(eq(toolCalls.id, toolCallId));

    // Record tool usage in registry
    const toolCall = await db.query.toolCalls.findFirst({
      where: eq(toolCalls.id, toolCallId),
      with: { tool: true },
    });

    if (toolCall?.tool) {
      await db
        .update(toolCalls)
        .set({
          useCount: (toolCall.tool.useCount ?? 0) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(toolCalls.id, toolCallId));
    }
  } catch (error) {
    console.error("[ToolWorker] Failed to update tool call success:", error);
  }
}

/**
 * Update tool call with error.
 */
async function updateToolCallError(
  toolCallId: string,
  errorMessage: string,
  _executionTimeMs: number
): Promise<void> {
  try {
    const db = getDB();
    await db
      .update(toolCalls)
      .set({
        status: "error",
        error: errorMessage,
        executedAt: new Date(),
      })
      .where(eq(toolCalls.id, toolCallId));
  } catch (error) {
    console.error("[ToolWorker] Failed to update tool call error:", error);
  }
}

/**
 * Update message to reflect tool completion status.
 */
async function updateMessageToolStatus(
  messageId: string,
  toolCallId: string,
  status: "completed" | "error",
  errorMessage?: string
): Promise<void> {
  try {
    const db = getDB();

    // Get current message
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) return;

    // Update metadata
    const metadata = (message.metadata as Record<string, unknown>) ?? {};
    const toolCallIds = (metadata.toolCallIds as string[]) ?? [];

    if (!toolCallIds.includes(toolCallId)) {
      toolCallIds.push(toolCallId);
    }

    metadata.hasToolCalls = true;
    metadata.toolCallStatus = status;
    if (errorMessage) {
      metadata.toolCallError = errorMessage;
    }

    await db
      .update(messages)
      .set({ metadata })
      .where(eq(messages.id, messageId));
  } catch (error) {
    console.error("[ToolWorker] Failed to update message status:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create and start the tool worker.
 */
export function createToolWorker(
  concurrency: number = 5
): Worker<ToolExecutionJob> {
  if (toolWorker) {
    return toolWorker;
  }

  toolWorker = new Worker<ToolExecutionJob>(
    QUEUE_NAMES.TOOL_EXECUTION,
    processToolJob,
    {
      connection: getRedisConnection(),
      concurrency,
      limiter: {
        max: 50,
        duration: 1000, // 50 jobs per second max
      },
    }
  );

  // Event handlers
  toolWorker.on("completed", (job) => {
    console.log(`[ToolWorker] Job ${job.id} completed`);
  });

  toolWorker.on("failed", (job, error) => {
    console.error(`[ToolWorker] Job ${job?.id} failed:`, error.message);
  });

  toolWorker.on("progress", (job, progress) => {
    console.log(`[ToolWorker] Job ${job.id} progress:`, progress);
  });

  toolWorker.on("error", (error) => {
    console.error("[ToolWorker] Worker error:", error);
  });

  console.log(`[ToolWorker] Started with concurrency ${concurrency}`);

  return toolWorker;
}

/**
 * Get the current tool worker instance.
 */
export function getToolWorker(): Worker<ToolExecutionJob> | null {
  return toolWorker;
}

/**
 * Stop the tool worker.
 */
export async function stopToolWorker(): Promise<void> {
  if (toolWorker) {
    await toolWorker.close();
    toolWorker = null;
    console.log("[ToolWorker] Stopped");
  }
}

/**
 * Check if the tool worker is running.
 */
export function isToolWorkerRunning(): boolean {
  return toolWorker !== null;
}
