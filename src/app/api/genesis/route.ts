// ═══════════════════════════════════════════════════════════════════════════════
// GENESIS API — Onboarding Completion & Profile Creation
// POST /api/genesis
//
// Accepts: { genesisData: GenesisData }  (from genesisStore.completeOnboarding)
// Returns: CompleteOnboardingResponse
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { userProfiles, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { contextInjector } from "@/lib/ai/contextInjector";
import type { CompleteOnboardingResponse } from "@/types/genesis";

// ─── Validation ──────────────────────────────────────────────────────────────

const genesisPayloadSchema = z.object({
  genesisData: z.object({
    useCase: z.enum([
      "marketer",
      "developer",
      "founder",
      "writer",
      "researcher",
      "designer",
      "student",
      "custom",
    ]),
    objectives: z.array(z.string()).min(1),
    skillLevel: z.enum(["beginner", "intermediate", "expert"]),
    workStyle: z.enum(["solo", "team", "hybrid"]),
    contentTone: z.enum(["professional", "casual", "technical", "creative"]),
    toolPreferences: z.array(z.string()),
    rawAnswers: z.record(z.union([z.string(), z.array(z.string())])),
  }),
});

// ─── Default Agent Templates ─────────────────────────────────────────────────

interface DefaultAgentDef {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
}

function getDefaultAgents(useCase: string): DefaultAgentDef[] {
  const templates: Record<string, DefaultAgentDef[]> = {
    marketer: [
      {
        name: "ContentBot",
        description:
          "Marketing content specialist for copy, emails, and campaigns",
        systemPrompt:
          "You are a marketing content specialist. You create compelling copy, email campaigns, social media posts, and marketing collateral. You understand audience targeting, tone-of-voice, and conversion-focused writing.",
        temperature: 0.8,
      },
      {
        name: "ResearchPal",
        description: "Market research and competitive analysis assistant",
        systemPrompt:
          "You are a market research analyst. You analyze market trends, competitive landscapes, and consumer behavior. You provide data-driven insights and actionable recommendations.",
        temperature: 0.4,
      },
    ],
    developer: [
      {
        name: "CodeGuardian",
        description: "Code review, debugging, and architecture assistant",
        systemPrompt:
          "You are a senior software engineer specializing in code review and architecture. You identify bugs, security vulnerabilities, performance issues, and suggest improvements following best practices.",
        temperature: 0.3,
      },
      {
        name: "DevHelper",
        description: "General-purpose development assistant",
        systemPrompt:
          "You are a helpful software development assistant. You help with writing code, explaining concepts, debugging issues, and suggesting solutions across multiple programming languages and frameworks.",
        temperature: 0.5,
      },
    ],
    founder: [
      {
        name: "StrategyBot",
        description: "Business strategy and planning assistant",
        systemPrompt:
          "You are a startup strategy consultant. You help with business planning, go-to-market strategy, fundraising preparation, pitch deck creation, and competitive analysis.",
        temperature: 0.6,
      },
    ],
    writer: [
      {
        name: "WriterBot",
        description: "Creative writing and editing assistant",
        systemPrompt:
          "You are a professional writer and editor. You help with creative writing, content editing, proofreading, and style improvement. You adapt to various writing styles and genres.",
        temperature: 0.9,
      },
    ],
  };

  return (
    templates[useCase] ?? [
      {
        name: "GeneralAssistant",
        description: "Versatile AI assistant for any task",
        systemPrompt:
          "You are a versatile AI assistant. You help with a wide range of tasks including writing, analysis, research, coding, and creative work. You adapt your communication style to the user's needs.",
        temperature: 0.7,
      },
    ]
  );
}

// ─── POST /api/genesis ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genesisData } = genesisPayloadSchema.parse(body);

    const db = getDB();

    const existingProfile = await db.query.userProfiles.findFirst();
    let profileId: string;

    if (existingProfile) {
      await db
        .update(userProfiles)
        .set({
          useCase: genesisData.useCase,
          objectives: genesisData.objectives,
          skillLevel: genesisData.skillLevel,
          workStyle: genesisData.workStyle,
          contentTone: genesisData.contentTone,
          toolPreferences: genesisData.toolPreferences,
          rawAnswers: genesisData.rawAnswers,
          isOnboardingComplete: true,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, existingProfile.id));
      profileId = existingProfile.id;
    } else {
      const [profile] = await db
        .insert(userProfiles)
        .values({
          useCase: genesisData.useCase,
          objectives: genesisData.objectives,
          skillLevel: genesisData.skillLevel,
          workStyle: genesisData.workStyle,
          contentTone: genesisData.contentTone,
          toolPreferences: genesisData.toolPreferences,
          rawAnswers: genesisData.rawAnswers,
          isOnboardingComplete: true,
        })
        .returning();

      if (!profile) {
        throw new Error("Failed to create user profile");
      }
      profileId = profile.id;
    }

    const defaultAgents = getDefaultAgents(genesisData.useCase);
    const generatedAgents: { id: string; name: string; description: string }[] =
      [];

    for (const def of defaultAgents) {
      const agentId = uuidv4();
      await db.insert(agents).values({
        id: agentId,
        ownerId: profileId,
        name: def.name,
        description: def.description,
        systemPrompt: def.systemPrompt,
        temperature: def.temperature,
        modelPreference: "ollama/qwen2.5-coder:7b",
        status: "active",
        isTemplate: false,
        genesisTag: genesisData.useCase,
      });

      generatedAgents.push({
        id: agentId,
        name: def.name,
        description: def.description,
      });
    }

    contextInjector.setProfile(genesisData);

    const response: CompleteOnboardingResponse = {
      success: true,
      profileId,
      generatedAgents,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[Genesis API] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        profileId: "",
        generatedAgents: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to process genesis request",
      } satisfies CompleteOnboardingResponse,
      { status: 500 },
    );
  }
}
