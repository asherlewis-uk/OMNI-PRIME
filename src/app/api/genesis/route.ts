import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { userProfiles } from "@/lib/db/schema";
import { z } from "zod";

// Assuming a schema for validation
const genesisSchema = z.object({
  useCase: z.string(),
  objectives: z.array(z.string()),
  skillLevel: z.string(),
  workStyle: z.string(),
  contentTone: z.string(),
  toolPreferences: z.array(z.string()),
  rawAnswers: z.record(z.any()),
});

export async function POST(request: NextRequest) {
  try {
    const genesisData = await request.json();
    // You can add validation here with genesisSchema if you want
    // const validatedData = genesisSchema.parse(genesisData);

    const db = await getDB();

    // 1. Create user profile
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
      throw new Error("Failed to create profile");
    }

    // Returning just the success and profile ID for now
    return NextResponse.json({
      success: true,
      profileId: profile.id,
    });
  } catch (error) {
    console.error("[Genesis API] Error:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to process genesis request" },
      { status: 500 }
    );
  }
}
