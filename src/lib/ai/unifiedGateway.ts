// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED AI GATEWAY - Hybrid-Engine for Local and Cloud LLMs
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from "openai";
import type { StreamChunk } from "@/types/chat";
import type { MCPTool } from "@/types/tool";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Supported LLM providers.
 */
export type LLMProvider = "ollama" | "openai" | "anthropic" | "custom";

/**
 * Message format for gateway (normalized across providers).
 */
export interface GatewayMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Tool definition for LLM function calling.
 */
export interface GatewayTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Completion request parameters.
 */
export interface CompletionRequest {
  /** Provider to use */
  provider?: LLMProvider;

  /** Model identifier (provider-specific) */
  model: string;

  /** Message history */
  messages: GatewayMessage[];

  /** Available tools for function calling */
  tools?: GatewayTool[];

  /** Whether to require tool calls */
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };

  /** Temperature (0.0 - 1.0) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Top-p sampling */
  topP?: number;

  /** Stop sequences */
  stop?: string[];

  /** Session ID for tracking */
  sessionId?: string;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Completion response (non-streaming).
 */
export interface CompletionResponse {
  content: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: LLMProvider;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter";
}

/**
 * Stream chunk from unified gateway.
 */
export interface GatewayStreamChunk {
  type: "content" | "tool_call" | "usage" | "error" | "done";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
    argumentsDelta?: string;
    isComplete: boolean;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: {
    code: string;
    message: string;
  };
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://host.docker.internal:11434";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED GATEWAY CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class UnifiedGateway {
  private openaiClient: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI client if API key is available
    if (OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
    }
  }

  /**
   * Detect provider from model string.
   */
  private detectProvider(model: string): LLMProvider {
    if (model.startsWith("ollama/") || model.startsWith("local/")) {
      return "ollama";
    }
    if (model.startsWith("gpt-") || model.startsWith("openai/")) {
      return "openai";
    }
    if (model.startsWith("claude-") || model.startsWith("anthropic/")) {
      return "anthropic";
    }
    // Default to Ollama for unknown models
    return "ollama";
  }

  /**
   * Normalize model name (remove provider prefix).
   */
  private normalizeModel(model: string, provider: LLMProvider): string {
    const prefixes = ["ollama/", "local/", "openai/", "anthropic/"];
    for (const prefix of prefixes) {
      if (model.startsWith(prefix)) {
        return model.slice(prefix.length);
      }
    }
    return model;
  }

  /**
   * Convert MCP tools to gateway tool format.
   */
  convertTools(mcpTools: MCPTool[]): GatewayTool[] {
    return mcpTools.map((tool): GatewayTool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Complete a non-streaming request.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const provider = request.provider || this.detectProvider(request.model);
    const model = this.normalizeModel(request.model, provider);

    switch (provider) {
      case "ollama":
        return this.completeOllama({ ...request, model });
      case "openai":
        return this.completeOpenAI({ ...request, model });
      case "anthropic":
        return this.completeAnthropic({ ...request, model });
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Stream a completion request.
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncGenerator<GatewayStreamChunk> {
    const provider = request.provider || this.detectProvider(request.model);
    const model = this.normalizeModel(request.model, provider);

    switch (provider) {
      case "ollama":
        yield* this.streamOllama({ ...request, model });
        break;
      case "openai":
        yield* this.streamOpenAI({ ...request, model });
        break;
      case "anthropic":
        yield* this.streamAnthropic({ ...request, model });
        break;
      default:
        yield {
          type: "error",
          error: {
            code: "UNSUPPORTED_PROVIDER",
            message: `Provider ${provider} is not supported`,
          },
        };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // OLLAMA IMPLEMENTATION
  // ═════════════════════════════════════════════════════════════════════════════

  private async completeOllama(
    request: CompletionRequest & { model: string }
  ): Promise<CompletionResponse> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
          top_p: request.topP,
          stop: request.stop,
        },
        tools: request.tools?.map((t) => ({
          type: "function",
          function: t.function,
        })),
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }

    const data = (await response.json()) as {
      message: {
        content: string;
        role: string;
        tool_calls?: {
          function: {
            name: string;
            arguments: Record<string, unknown>;
          };
        }[];
      };
      done: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message.content,
      toolCalls: data.message.tool_calls?.map((tc, idx) => ({
        id: `call_${idx}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: request.model,
      provider: "ollama",
      finishReason: data.done ? "stop" : "length",
    };
  }

  private async *streamOllama(
    request: CompletionRequest & { model: string }
  ): AsyncGenerator<GatewayStreamChunk> {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens,
          top_p: request.topP,
          stop: request.stop,
        },
        tools: request.tools?.map((t) => ({
          type: "function",
          function: t.function,
        })),
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield {
        type: "error",
        error: {
          code: "OLLAMA_ERROR",
          message: error,
        },
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield {
        type: "error",
        error: {
          code: "STREAM_ERROR",
          message: "Failed to get response reader",
        },
      };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line) as {
              message?: {
                content?: string;
                tool_calls?: {
                  function: {
                    name: string;
                    arguments: Record<string, unknown>;
                  };
                }[];
              };
              done?: boolean;
              prompt_eval_count?: number;
              eval_count?: number;
            };

            if (chunk.message?.content) {
              yield {
                type: "content",
                content: chunk.message.content,
              };
            }

            if (chunk.message?.tool_calls) {
              for (const tc of chunk.message.tool_calls) {
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: `call_${Date.now()}`,
                    name: tc.function.name,
                    arguments: JSON.stringify(tc.function.arguments),
                    isComplete: true,
                  },
                };
              }
            }

            if (chunk.done) {
              yield {
                type: "usage",
                usage: {
                  promptTokens: chunk.prompt_eval_count,
                  completionTokens: chunk.eval_count,
                  totalTokens:
                    (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0),
                },
              };
              yield { type: "done", finishReason: "stop" };
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // OPENAI IMPLEMENTATION
  // ═════════════════════════════════════════════════════════════════════════════

  private async completeOpenAI(
    request: CompletionRequest & { model: string }
  ): Promise<CompletionResponse> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized - API key missing");
    }

    const response = await this.openaiClient.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: request.tools,
      tool_choice: request.toolChoice,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from OpenAI");
    }

    return {
      content: choice.message.content || "",
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      provider: "openai",
      finishReason: choice.finish_reason as CompletionResponse["finishReason"],
    };
  }

  private async *streamOpenAI(
    request: CompletionRequest & { model: string }
  ): AsyncGenerator<GatewayStreamChunk> {
    if (!this.openaiClient) {
      yield {
        type: "error",
        error: {
          code: "OPENAI_NOT_INITIALIZED",
          message: "OpenAI client not initialized - API key missing",
        },
      };
      return;
    }

    const stream = await this.openaiClient.chat.completions.create({
      model: request.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: request.tools,
      tool_choice: request.toolChoice,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: true,
    });

    const toolCallBuffers: Record<string, { name: string; arguments: string }> =
      {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Handle content
      if (delta.content) {
        yield {
          type: "content",
          content: delta.content,
        };
      }

      // Handle tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const id = tc.id || `call_${Date.now()}`;

          if (!toolCallBuffers[id]) {
            toolCallBuffers[id] = { name: "", arguments: "" };
          }

          if (tc.function?.name) {
            toolCallBuffers[id].name += tc.function.name;
          }

          if (tc.function?.arguments) {
            toolCallBuffers[id].arguments += tc.function.arguments;
          }

          const isComplete =
            toolCallBuffers[id].name &&
            toolCallBuffers[id].arguments &&
            tc.function?.arguments?.includes("}");

          yield {
            type: "tool_call",
            toolCall: {
              id,
              name: toolCallBuffers[id].name,
              arguments: toolCallBuffers[id].arguments,
              argumentsDelta: tc.function?.arguments,
              isComplete: !!isComplete,
            },
          };
        }
      }

      // Handle finish reason
      if (chunk.choices[0]?.finish_reason) {
        yield {
          type: "done",
          finishReason: chunk.choices[0]
            .finish_reason as CompletionResponse["finishReason"],
        };
      }

      // Handle usage (only in final chunk for OpenAI)
      if (chunk.usage) {
        yield {
          type: "usage",
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          },
        };
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ANTHROPIC IMPLEMENTATION (Placeholder)
  // ═════════════════════════════════════════════════════════════════════════════

  private async completeAnthropic(
    request: CompletionRequest & { model: string }
  ): Promise<CompletionResponse> {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    // Convert messages to Anthropic format
    const systemMessage = request.messages.find((m) => m.role === "system");
    const chatMessages = request.messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: chatMessages.map((m) => ({
          role: m.role === "tool" ? "user" : m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools?.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        })),
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${error}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text?: string; name?: string; input?: unknown }[];
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const textContent = data.content.find((c) => c.type === "text")?.text || "";
    const toolUseContent = data.content.filter((c) => c.type === "tool_use");

    return {
      content: textContent,
      toolCalls: toolUseContent.map((tc) => ({
        id: `call_${Date.now()}`,
        name: tc.name || "",
        arguments: tc.input as Record<string, unknown>,
      })),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
      provider: "anthropic",
      finishReason:
        data.stop_reason === "tool_use"
          ? "tool_calls"
          : (data.stop_reason as CompletionResponse["finishReason"]),
    };
  }

  private async *streamAnthropic(
    request: CompletionRequest & { model: string }
  ): AsyncGenerator<GatewayStreamChunk> {
    if (!ANTHROPIC_API_KEY) {
      yield {
        type: "error",
        error: {
          code: "ANTHROPIC_NOT_INITIALIZED",
          message: "Anthropic API key not configured",
        },
      };
      return;
    }

    // Placeholder: Anthropic streaming implementation
    yield {
      type: "error",
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Anthropic streaming not yet implemented",
      },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Check if a provider is available.
   */
  isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
      case "ollama":
        return true; // Always attempt Ollama
      case "openai":
        return !!this.openaiClient;
      case "anthropic":
        return !!ANTHROPIC_API_KEY;
      default:
        return false;
    }
  }

  /**
   * List available models for a provider.
   */
  async listModels(provider: LLMProvider): Promise<string[]> {
    switch (provider) {
      case "ollama":
        try {
          const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
          const data = (await response.json()) as {
            models: { name: string }[];
          };
          return data.models.map((m) => m.name);
        } catch {
          return [];
        }
      case "openai":
        if (!this.openaiClient) return [];
        try {
          const models = await this.openaiClient.models.list();
          return models.data
            .filter((m) => m.id.startsWith("gpt-"))
            .map((m) => m.id);
        } catch {
          return [];
        }
      case "anthropic":
        return [
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307",
        ];
      default:
        return [];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const unifiedGateway = new UnifiedGateway();

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════════


