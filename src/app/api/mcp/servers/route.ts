// ═══════════════════════════════════════════════════════════════════════════════
// MCP SERVERS API - MCP Server Management (BYOK)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db/client";
import { mcpServers, mcpTools } from "@/lib/db/schema";
import { mcpServerManager } from "@/lib/mcp/MCPServerManager";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import type { CreateMCPServerPayload } from "@/types/tool";

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/mcp/servers - List MCP servers
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTools = searchParams.get("includeTools") === "true";
    const status = searchParams.get("status");

    const db = await getDB();

    const query = db.query.mcpServers.findMany({
      where: status ? eq(mcpServers.status, status as "connected" | "disconnected" | "error" | "connecting") : undefined,
      with: includeTools
        ? {
            tools: true,
          }
        : undefined,
      orderBy: [desc(mcpServers.updatedAt)],
    });

    const servers = await query;

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("[MCP Servers API] Error listing servers:", error);
    return NextResponse.json(
      { error: "Failed to list servers" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/mcp/servers - Register new MCP server
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateMCPServerPayload;

    // Validation
    if (!body.name || !body.transport) {
      return NextResponse.json(
        { error: "name and transport are required" },
        { status: 400 }
      );
    }

    if (body.transport === "stdio" && !body.command) {
      return NextResponse.json(
        { error: "command is required for stdio transport" },
        { status: 400 }
      );
    }

    if ((body.transport === "sse" || body.transport === "http") && !body.url) {
      return NextResponse.json(
        { error: "url is required for sse/http transport" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Get or create system user profile
    let profile = await db.query.userProfiles.findFirst();
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const serverId = crypto.randomUUID();

    // Create server record
    await db.insert(mcpServers).values({
      id: serverId,
      ownerId: profile.id,
      name: body.name,
      description: body.description ?? null,
      transport: body.transport,
      command: body.command ?? null,
      args: body.args ?? [],
      url: body.url ?? null,
      env: body.env ?? {},
      config: body.config ?? {},
      status: "disconnected",
      isBuiltIn: false,
      isEnabled: true,
    });

    // Attempt to connect and sync tools
    const server = await db.query.mcpServers.findFirst({
      where: eq(mcpServers.id, serverId),
    });

    if (server) {
      try {
        const status = await mcpServerManager.connectServer({
          ...server,
          args: server.args ?? [],
          env: server.env ?? {},
          config: server.config ?? {},
        });

        return NextResponse.json(
          {
            server: {
              ...server,
              connectionStatus: status,
            },
            message:
              status === "connected"
                ? "Server connected and tools synced"
                : "Server registered but connection failed",
          },
          { status: 201 }
        );
      } catch (connectError) {
        // Server created but connection failed - still return success with warning
        return NextResponse.json(
          {
            server,
            message:
              "Server registered but connection failed. Check configuration.",
            error:
              connectError instanceof Error
                ? connectError.message
                : "Connection failed",
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create server" },
      { status: 500 }
    );
  } catch (error) {
    console.error("[MCP Servers API] Error creating server:", error);
    return NextResponse.json(
      { error: "Failed to create server" },
      { status: 500 }
    );
  }
}
