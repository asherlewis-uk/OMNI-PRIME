// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE DEFINITIONS — Lazy BullMQ Queue Setup
//
// All queues are LAZILY instantiated via getter functions. This prevents the
// Next.js API route module from crashing on import if Redis is unavailable.
// ═══════════════════════════════════════════════════════════════════════════════

import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";

// ─── Queue Names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  TOOL_EXECUTION: "tool-execution",
  SWARM_EXECUTION: "swarm-execution",
  KNOWLEDGE_INDEXING: "knowledge-indexing",
  NOTIFICATION: "notification",
} as const;

// ─── Job Types ───────────────────────────────────────────────────────────────

export interface ToolExecutionJob {
  toolCallId: string;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  sessionId: string;
  messageId: string;
  requestId: string;
}

export interface SwarmExecutionJob {
  swarmId: string;
  sessionId: string;
  userMessage: string;
  entryAgentId: string;
  executionId: string;
  maxIterations: number;
}

export interface KnowledgeIndexingJob {
  docId: string;
  ownerId: string;
  filePath: string;
  fileType: string;
  chunkSize: number;
  chunkOverlap: number;
}

export interface NotificationJob {
  type: "tool_complete" | "swarm_complete" | "agent_message";
  userId: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

export type JobData =
  | { type: "tool"; data: ToolExecutionJob }
  | { type: "swarm"; data: SwarmExecutionJob }
  | { type: "indexing"; data: KnowledgeIndexingJob }
  | { type: "notification"; data: NotificationJob };

// ─── Lazy Queue Singletons ───────────────────────────────────────────────────

let _toolQueue: Queue<ToolExecutionJob> | null = null;
let _swarmQueue: Queue<SwarmExecutionJob> | null = null;
let _indexingQueue: Queue<KnowledgeIndexingJob> | null = null;
let _notificationQueue: Queue<NotificationJob> | null = null;

export function getToolQueue(): Queue<ToolExecutionJob> {
  if (!_toolQueue) {
    _toolQueue = new Queue<ToolExecutionJob>(QUEUE_NAMES.TOOL_EXECUTION, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return _toolQueue;
}

export function getSwarmQueue(): Queue<SwarmExecutionJob> {
  if (!_swarmQueue) {
    _swarmQueue = new Queue<SwarmExecutionJob>(QUEUE_NAMES.SWARM_EXECUTION, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    });
  }
  return _swarmQueue;
}

export function getIndexingQueue(): Queue<KnowledgeIndexingJob> {
  if (!_indexingQueue) {
    _indexingQueue = new Queue<KnowledgeIndexingJob>(
      QUEUE_NAMES.KNOWLEDGE_INDEXING,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: "fixed", delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      },
    );
  }
  return _indexingQueue;
}

export function getNotificationQueue(): Queue<NotificationJob> {
  if (!_notificationQueue) {
    _notificationQueue = new Queue<NotificationJob>(QUEUE_NAMES.NOTIFICATION, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });
  }
  return _notificationQueue;
}

// ─── Job Adders ──────────────────────────────────────────────────────────────

export async function addToolExecutionJob(
  data: ToolExecutionJob,
  options?: JobsOptions,
): Promise<string> {
  const job = await getToolQueue().add("execute-tool", data, {
    priority: 5,
    ...options,
  });
  return job.id ?? "";
}

export async function addSwarmExecutionJob(
  data: SwarmExecutionJob,
  options?: JobsOptions,
): Promise<string> {
  const job = await getSwarmQueue().add("execute-swarm", data, {
    priority: 3,
    ...options,
  });
  return job.id ?? "";
}

export async function addKnowledgeIndexingJob(
  data: KnowledgeIndexingJob,
  options?: JobsOptions,
): Promise<string> {
  const job = await getIndexingQueue().add("index-document", data, {
    priority: 1,
    ...options,
  });
  return job.id ?? "";
}

export async function addNotificationJob(
  data: NotificationJob,
  options?: JobsOptions,
): Promise<string> {
  const job = await getNotificationQueue().add("send-notification", data, {
    priority: 10,
    ...options,
  });
  return job.id ?? "";
}

// ─── Queue Utilities ─────────────────────────────────────────────────────────

export async function getQueueStatus(): Promise<{
  tool: { waiting: number; active: number; completed: number; failed: number };
  swarm: { waiting: number; active: number; completed: number; failed: number };
  indexing: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  notification: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}> {
  const tq = getToolQueue();
  const sq = getSwarmQueue();
  const iq = getIndexingQueue();
  const nq = getNotificationQueue();

  const [tw, ta, tc, tf, sw, sa, sc, sf, iw, ia, ic, iff, nw, na, nc, nf] =
    await Promise.all([
      tq.getWaitingCount(),
      tq.getActiveCount(),
      tq.getCompletedCount(),
      tq.getFailedCount(),
      sq.getWaitingCount(),
      sq.getActiveCount(),
      sq.getCompletedCount(),
      sq.getFailedCount(),
      iq.getWaitingCount(),
      iq.getActiveCount(),
      iq.getCompletedCount(),
      iq.getFailedCount(),
      nq.getWaitingCount(),
      nq.getActiveCount(),
      nq.getCompletedCount(),
      nq.getFailedCount(),
    ]);

  return {
    tool: { waiting: tw, active: ta, completed: tc, failed: tf },
    swarm: { waiting: sw, active: sa, completed: sc, failed: sf },
    indexing: { waiting: iw, active: ia, completed: ic, failed: iff },
    notification: { waiting: nw, active: na, completed: nc, failed: nf },
  };
}

export async function closeQueues(): Promise<void> {
  const queues = [_toolQueue, _swarmQueue, _indexingQueue, _notificationQueue];
  await Promise.all(queues.filter(Boolean).map((q) => q!.close()));
  _toolQueue = null;
  _swarmQueue = null;
  _indexingQueue = null;
  _notificationQueue = null;
}
