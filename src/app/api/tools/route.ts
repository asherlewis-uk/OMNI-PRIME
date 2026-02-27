// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS API - Aggregated Tool Registry Interface
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { toolRegistry } from "@/lib/mcp/toolRegistry";
import type { ToolCategory } from "@/types/tool";

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/tools - List available tools
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ToolCategory | null;
    const search = searchParams.get("search");
    const serverId = searchParams.get("serverId");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const result = await toolRegistry.getTools({
      category: category ?? undefined,
      searchQuery: search ?? undefined,
      serverId: serverId ?? undefined,
      isEnabled: true,
      limit,
      offset,
    });

    return NextResponse.json({
      tools: result.tools,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("[Tools API] Error listing tools:", error);
    return NextResponse.json(
      { error: "Failed to list tools" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/tools/categories - Get categorized tools
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchCategorizedTools() {
  try {
    const categorized = await toolRegistry.getCategorizedTools();
    return NextResponse.json({ categories: categorized });
  } catch (error) {
    console.error("[Tools API] Error getting categories:", error);
    return NextResponse.json(
      { error: "Failed to get tool categories" },
      { status: 500 }
    );
  }
}
