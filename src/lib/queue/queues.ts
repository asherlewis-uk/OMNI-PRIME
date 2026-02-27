// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE DEFINITIONS - BullMQ Queue Setup
// ═══════════════════════════════════════════════════════════════════════════════

import { Queue, JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";
import type { ToolCall } from "@/types/tool";
import type { SwarmExecution } from "@/types/swarm";

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE NAMES
// ═══════════════════════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
  TOOL_EXECUTION: "tool-execution",
  SWARM_EXECUTION: "swarm-execution",
  KNOWLEDGE_INDEXING: "knowledge-indexing",
  NOTIFICATION: "notification",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// JOB TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tool execution job data.
 */
export interface ToolExecutionJob {
  /** Tool call ID from database */
  toolCallId: string;

  /** Server ID */
  serverId: string;

  /** Tool name */
  toolName: string;

  /** Tool arguments */
  arguments: Record<string, unknown>;

  /** Session ID for context */
  sessionId: string;

  /** Message ID this tool call belongs to */
  messageId: string;

  /** Request ID for tracing */
  requestId: string;
}

/**
 * Swarm execution job data.
 */
export interface SwarmExecutionJob {
  /** Swarm definition ID */
  swarmId: string;

  /** Chat session ID */
  sessionId: string;

  /** Initial user message */
  userMessage: string;

  /** Entry agent ID */
  entryAgentId: string;

  /** Execution ID for tracking */
  executionId: string;

  /** Maximum iterations */
  maxIterations: number;
}

/**
 * Knowledge indexing job data.
 */
export interface KnowledgeIndexingJob {
  /** Document ID */
  docId: string;

  /** Owner profile ID */
  ownerId: string;

  /** File path */
  filePath: string;

  /** File type */
  fileType: string;

  /** Chunk size for embeddings */
  chunkSize: number;

  /** Chunk overlap */
  chunkOverlap: number;
}

/**
 * Notification job data.
 */
export interface NotificationJob {
  /** Notification type */
  type: "tool_complete" | "swarm_complete" | "agent_message";

  /** User ID */
  userId: string;

  /** Session ID */
  sessionId: string;

  /** Notification payload */
  payload: Record<string, unknown>;
}

/**
 * Union of all job types.
 */
export type JobData =
  | { type: "tool"; data: ToolExecutionJob }
  | { type: "swarm"; data: SwarmExecutionJob }
  | { type: "indexing"; data: KnowledgeIndexingJob }
  | { type: "notification"; data: NotificationJob };

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tool execution queue.
 */
export const toolQueue = new Queue<ToolExecutionJob>(
  QUEUE_NAMES.TOOL_EXECUTION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }
);

/**
 * Swarm execution queue.
 */
export const swarmQueue = new Queue<SwarmExecutionJob>(
  QUEUE_NAMES.SWARM_EXECUTION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 50,
      removeOnFail: 20,
    },
  }
);

/**
 * Knowledge indexing queue.
 */
export const indexingQueue = new Queue<KnowledgeIndexingJob>(
  QUEUE_NAMES.KNOWLEDGE_INDEXING,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "fixed",
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 20,
    },
  }
);

/**
 * Notification queue.
 */
export const notificationQueue = new Queue<NotificationJob>(
  QUEUE_NAMES.NOTIFICATION,
  {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 200,
      removeOnFail: 100,
    },
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// JOB ADDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a tool execution job to the queue.
 */
export async function addToolExecutionJob(
  data: ToolExecutionJob,
  options?: JobsOptions
): Promise<string> {
  const job = await toolQueue.add("execute-tool", data, {
    priority: 5,
    ...options,
  });
  return job.id!;
}

/**
 * Add a swarm execution job to the queue.
 */
export async function addSwarmExecutionJob(
  data: SwarmExecutionJob,
  options?: JobsOptions
): Promise<string> {
  const job = await swarmQueue.add("execute-swarm", data, {
    priority: 3,
    ...options,
  });
  return job.id!;
}

/**
 * Add a knowledge indexing job to the queue.
 */
export async function addKnowledgeIndexingJob(
  data: KnowledgeIndexingJob,
  options?: JobsOptions
): Promise<string> {
  const job = await indexingQueue.add("index-document", data, {
    priority: 1,
    ...options,
  });
  return job.id!;
}

/**
 * Add a notification job to the queue.
 */
export async function addNotificationJob(
  data: NotificationJob,
  options?: JobsOptions
): Promise<string> {
  const job = await notificationQueue.add("send-notification", data, {
    priority: 10,
    ...options,
  });
  return job.id!;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get queue status summary.
 */
export async function getQueueStatus(): Promise<{
  tool: { waiting: number; active: number; completed: number; failed: number };
  swarm: { waiting: number; active: number; completed: number; failed: number };
  indexing: { waiting: number; active: number; completed: number; failed: number };
  notification: { waiting: number; active: number; completed: number; failed: number };
}> {
  const [
    toolWaiting,
    toolActive,
    toolCompleted,
    toolFailed,
    swarmWaiting,
    swarmActive,
    swarmCompleted,
    swarmFailed,
    indexingWaiting,
    indexingActive,
    indexingCompleted,
    indexingFailed,
    notificationWaiting,
    notificationActive,
    notificationCompleted,
    notificationFailed,
  ] = await Promise.all([
    toolQueue.getWaitingCount(),
    toolQueue.getActiveCount(),
    toolQueue.getCompletedCount(),
    toolQueue.getFailedCount(),
    swarmQueue.getWaitingCount(),
    swarmQueue.getActiveCount(),
    swarmQueue.getCompletedCount(),
    swarmQueue.getFailedCount(),
    indexingQueue.getWaitingCount(),
    indexingQueue.getActiveCount(),
    indexingQueue.getCompletedCount(),
    indexingQueue.getFailedCount(),
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
  ]);

  return {
    tool: {
      waiting: toolWaiting,
      active: toolActive,
      completed: toolCompleted,
      failed: toolFailed,
    },
    swarm: {
      waiting: swarmWaiting,
      active: swarmActive,
      completed: swarmCompleted,
      failed: swarmFailed,
    },
    indexing: {
      waiting: indexingWaiting,
      active: indexingActive,
      completed: indexingCompleted,
      failed: indexingFailed,
    },
    notification: {
      waiting: notificationWaiting,
      active: notificationActive,
      completed: notificationCompleted,
      failed: notificationFailed,
    },
  };
}

/**
 * Clean all queues (use with caution).
 */
export async function cleanAllQueues(): Promise<void> {
  await Promise.all([
    toolQueue.clean(0, 0, "completed"),
    toolQueue.clean(0, 0, "failed"),
    swarmQueue.clean(0, 0, "completed"),
    swarmQueue.clean(0, 0, "failed"),
    indexingQueue.clean(0, 0, "completed"),
    indexingQueue.clean(0, 0, "failed"),
    notificationQueue.clean(0, 0, "completed"),
    notificationQueue.clean(0, 0, "failed"),
  ]);
}

/**
 * Pause all queues.
 */
export async function pauseAllQueues(): Promise<void> {
  await Promise.all([
    toolQueue.pause(),
    swarmQueue.pause(),
    indexingQueue.pause(),
    notificationQueue.pause(),
  ]);
}

/**
 * Resume all queues.
 */
export async function resumeAllQueues(): Promise<void> {
  await Promise.all([
    toolQueue.resume(),
    swarmQueue.resume(),
    indexingQueue.resume(),
    notificationQueue.resume(),
  ]);
}

/**
 * Close all queues (for cleanup).
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    toolQueue.close(),
    swarmQueue.close(),
    indexingQueue.close(),
    notificationQueue.close(),
  ]);
}
