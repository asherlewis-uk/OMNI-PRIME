// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED AI GATEWAY — Local-First LLM Router
//
// Sovereignty: Ollama is the PRIMARY and DEFAULT provider.
// Cloud providers (OpenAI, Anthropic) are optional BYOK overlays that must be
// explicitly enabled via enableCloudProvider(). They do NOT auto-initialize
// from environment variables alone.
//
// Ollama endpoint: http://host.docker.internal:11434 (ai-stack-net bridge)
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from "openai";
import type { MCPTool } from "@/types/tool";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LLMProvider = "ollama" | "openai" | "anthropic";

export interface GatewayMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

export interface GatewayTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  provider?: LLMProvider;
  model: string;
  messages: GatewayMessage[];
  tools?: GatewayTool[];
  toolChoice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  sessionId?: string;
  signal?: AbortSignal;
}

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
  error?: { code: string; message: string };
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
}

// ─── Configuration ───────────────────────────────────────────────────────────

const OLLAMA_BASE_URL =
  process.env.OLLAMA_URL ?? "http://host.docker.internal:11434";

// ─── Unified Gateway Class ───────────────────────────────────────────────────

export class UnifiedGateway {
  private openaiClient: OpenAI | null = null;
  private openaiEnabled = false;
  private anthropicEnabled = false;
  private anthropicKey = "";

  /**
   * Explicitly enable a cloud provider. Cloud providers do NOT auto-initialize.
   * This is the BYOK opt-in gate.
   */
  enableCloudProvider(provider: "openai" | "anthropic", apiKey: string): void {
    if (!apiKey) return;

    if (provider === "openai") {
      this.openaiClient = new OpenAI({ apiKey });
      this.openaiEnabled = true;
    } else if (provider === "anthropic") {
      this.anthropicKey = apiKey;
      this.anthropicEnabled = true;
    }
  }

  /**
   * Detect provider from model string. Defaults to Ollama (sovereignty).
   */
  private detectProvider(model: string): LLMProvider {
    if (model.startsWith("gpt-") || model.startsWith("openai/"))
      return "openai";
    if (model.startsWith("claude-") || model.startsWith("anthropic/"))
      return "anthropic";
    return "ollama";
  }

  /**
   * Strip provider prefix from model name.
   */
  private normalizeModel(model: string): string {
    const prefixes = ["ollama/", "local/", "openai/", "anthropic/"];
    for (const prefix of prefixes) {
      if (model.startsWith(prefix)) return model.slice(prefix.length);
    }
    return model;
  }

  /**
   * Convert MCP tools to gateway tool format.
   */
  convertTools(mcpTools: MCPTool[]): GatewayTool[] {
    return mcpTools.map(
      (tool): GatewayTool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description ?? `Execute ${tool.name}`,
          parameters: tool.inputSchema,
        },
      }),
    );
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const provider = request.provider ?? this.detectProvider(request.model);
    const model = this.normalizeModel(request.model);

    switch (provider) {
      case "ollama":
        return this.completeOllama({ ...request, model });
      case "openai":
        return this.completeOpenAI({ ...request, model });
      case "anthropic":
        throw new Error(
          "Anthropic provider is not yet implemented. Use Ollama for local-first operation.",
        );
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async *streamCompletion(
    request: CompletionRequest,
  ): AsyncGenerator<GatewayStreamChunk> {
    const provider = request.provider ?? this.detectProvider(request.model);
    const model = this.normalizeModel(request.model);

    switch (provider) {
      case "ollama":
        yield* this.streamOllama({ ...request, model });
        break;
      case "openai":
        yield* this.streamOpenAI({ ...request, model });
        break;
      case "anthropic":
        yield {
          type: "error",
          error: {
            code: "NOT_IMPLEMENTED",
            message:
              "Anthropic streaming is not yet implemented. Route to Ollama.",
          },
        };
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

  // ─── Ollama Implementation ─────────────────────────────────────────────────

  private async completeOllama(
    request: CompletionRequest & { model: string },
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
      const errorText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      message: {
        content: string;
        role: string;
        tool_calls?: {
          function: { name: string; arguments: Record<string, unknown> };
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
    request: CompletionRequest & { model: string },
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
      const errorText = await response.text();
      yield {
        type: "error",
        error: { code: "OLLAMA_ERROR", message: errorText },
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield {
        type: "error",
        error: { code: "STREAM_ERROR", message: "No response body reader" },
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
        buffer = lines.pop() ?? "";

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
              yield { type: "content", content: chunk.message.content };
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
            // Skip malformed NDJSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── OpenAI Implementation (BYOK only) ────────────────────────────────────

  private async completeOpenAI(
    request: CompletionRequest & { model: string },
  ): Promise<CompletionResponse> {
    if (!this.openaiClient || !this.openaiEnabled) {
      throw new Error(
        "OpenAI is not enabled. Call enableCloudProvider('openai', apiKey) first.",
      );
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
    if (!choice) throw new Error("No response from OpenAI");

    return {
      content: choice.message.content ?? "",
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
    request: CompletionRequest & { model: string },
  ): AsyncGenerator<GatewayStreamChunk> {
    if (!this.openaiClient || !this.openaiEnabled) {
      yield {
        type: "error",
        error: {
          code: "OPENAI_NOT_ENABLED",
          message: "OpenAI BYOK not enabled",
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

      if (delta.content) {
        yield { type: "content", content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const id = tc.id ?? `call_${Date.now()}`;
          if (!toolCallBuffers[id])
            toolCallBuffers[id] = { name: "", arguments: "" };
          if (tc.function?.name) toolCallBuffers[id].name += tc.function.name;
          if (tc.function?.arguments)
            toolCallBuffers[id].arguments += tc.function.arguments;

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

      if (chunk.choices[0]?.finish_reason) {
        yield {
          type: "done",
          finishReason: chunk.choices[0]
            .finish_reason as CompletionResponse["finishReason"],
        };
      }

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

  // ─── Utility ───────────────────────────────────────────────────────────────

  isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
      case "ollama":
        return true;
      case "openai":
        return this.openaiEnabled;
      case "anthropic":
        return this.anthropicEnabled;
      default:
        return false;
    }
  }

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
        if (!this.openaiClient || !this.openaiEnabled) return [];
        try {
          const models = await this.openaiClient.models.list();
          return models.data
            .filter((m) => m.id.startsWith("gpt-"))
            .map((m) => m.id);
        } catch {
          return [];
        }
      case "anthropic":
        if (!this.anthropicEnabled) return [];
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

// ─── Singleton ───────────────────────────────────────────────────────────────

export const unifiedGateway = new UnifiedGateway();
